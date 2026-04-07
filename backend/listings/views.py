import logging
import stripe
from decimal import Decimal
from django.conf import settings as django_settings
from django.db import transaction

logger = logging.getLogger(__name__)
from django.db.models import Q, Avg, Count, Exists, OuterRef, BooleanField, Value
from django.utils import timezone
from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes, parser_classes, throttle_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from .moderation import check_listing
from .throttles import ListingCreateThrottle

from notifications.utils import send_email, create_notification
from orders.models import Order, Payment
from users.models import BlockedUser
from .models import Category, Listing, ListingImage, Offer, Bid, SearchLog, UserInteraction, ListingReport, SearchAlert
from .serializers import (
    CategorySerializer, ListingSerializer, ListingCreateSerializer,
    ListingImageSerializer, OfferSerializer, BidSerializer
)


def _annotate_listings(qs, user=None):
    """Add annotations to avoid N+1 queries in ListingSerializer."""
    qs = qs.annotate(
        _bid_count=Count('bids', distinct=True),
        _watcher_count=Count('interactions', filter=Q(interactions__interaction_type='favorite'), distinct=True),
        _seller_avg_rating=Avg('seller__reviews_received__rating'),
        _seller_review_count=Count('seller__reviews_received', distinct=True),
    )
    if user and user.is_authenticated:
        qs = qs.annotate(
            _is_favorited=Exists(
                UserInteraction.objects.filter(
                    user=user, listing=OuterRef('pk'), interaction_type='favorite'
                )
            )
        )
    else:
        qs = qs.annotate(_is_favorited=Value(False, output_field=BooleanField()))
    return qs

# ─── Categories ───────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def category_list(request):
    categories = Category.objects.all()
    return Response(CategorySerializer(categories, many=True).data)


# ─── Listings ─────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticatedOrReadOnly])
def listing_list_create(request):
    if request.method == 'GET':
        qs = _annotate_listings(
            Listing.objects.filter(status='active').select_related('seller', 'category').prefetch_related('images'),
            request.user
        )

        # Search & Filter
        keyword = request.query_params.get('q', '').strip()
        if keyword:
            qs = qs.filter(Q(title__icontains=keyword) | Q(description__icontains=keyword))
            SearchLog.objects.create(keyword=keyword.lower())

        category = request.query_params.get('category')
        if category:
            qs = qs.filter(category__slug=category)

        condition = request.query_params.get('condition')
        if condition:
            qs = qs.filter(condition=condition)

        listing_type = request.query_params.get('listing_type')
        if listing_type == 'auction':
            qs = qs.filter(auction_end_time__isnull=False)
        elif listing_type == 'fixed':
            qs = qs.filter(auction_end_time__isnull=True)

        min_price = request.query_params.get('min_price')
        max_price = request.query_params.get('max_price')
        if min_price:
            qs = qs.filter(price__gte=min_price)
        if max_price:
            qs = qs.filter(price__lte=max_price)

        sort = request.query_params.get('sort', 'newest')
        if sort == 'price_asc':
            qs = qs.order_by('price')
        elif sort == 'price_desc':
            qs = qs.order_by('-price')
        elif sort == 'ending_soon':
            qs = qs.filter(auction_end_time__isnull=False).order_by('auction_end_time')
        else:
            qs = qs.order_by('-created_at')

        total = qs.count()
        try:
            page = max(1, int(request.query_params.get('page', 1)))
        except ValueError:
            page = 1
        page_size = 20
        start = (page - 1) * page_size
        serializer = ListingSerializer(qs[start:start + page_size], many=True, context={'request': request})
        return Response({
            'results': serializer.data,
            'count': total,
            'page': page,
            'total_pages': max(1, (total + page_size - 1) // page_size),
        })

    # POST - seller only
    if request.user.role != 'seller':
        return Response({'error': 'Only sellers can create listings.'}, status=status.HTTP_403_FORBIDDEN)

    # Rate limit listing creation
    throttle = ListingCreateThrottle()
    if not throttle.allow_request(request, None):
        return Response(
            {'error': 'Too many listings created. Please wait before creating more.'},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    serializer = ListingCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    listing = serializer.save(seller=request.user)

    # Content moderation check
    flagged, reason = check_listing(listing)
    if flagged:
        listing.is_flagged = True
        listing.flagged_reason = reason
        listing.save(update_fields=['is_flagged', 'flagged_reason'])

    # Fire matching search alerts
    if listing.status == 'active':
        from notifications.utils import create_notification
        alerts = SearchAlert.objects.filter(is_active=True).exclude(user=request.user).select_related('user', 'category')
        for alert in alerts:
            if alert.query and alert.query.lower() not in listing.title.lower() + ' ' + listing.description.lower():
                continue
            if alert.category and alert.category != listing.category:
                continue
            if alert.condition and alert.condition != listing.condition:
                continue
            if alert.max_price and listing.price > alert.max_price:
                continue
            create_notification(
                alert.user, 'search_alert',
                f'New match for "{alert.label}"',
                f'"{listing.title}" — ${listing.price}',
                f'/listings/{listing.id}'
            )

    return Response(ListingSerializer(listing, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticatedOrReadOnly])
def listing_detail(request, pk):
    try:
        listing = Listing.objects.select_related('seller', 'category').prefetch_related('images').get(pk=pk)
    except Listing.DoesNotExist:
        return Response({'error': 'Listing not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        if request.user.is_authenticated:
            if not UserInteraction.objects.filter(
                user=request.user, listing=listing, interaction_type='view'
            ).exists():
                UserInteraction.objects.create(
                    user=request.user, listing=listing, interaction_type='view'
                )
        # Lazy auto-settle: if auction expired with bids, settle it now
        if (listing.is_auction and listing.status == 'active'
                and listing.auction_end_time and listing.auction_end_time < timezone.now()):
            top_bid = Bid.objects.filter(listing=listing).order_by('-amount').first()
            if top_bid:
                try:
                    from listings.management.commands.settle_auctions import _settle_auction
                    _settle_auction(listing, top_bid)
                    listing.refresh_from_db()
                except Exception:
                    pass
            else:
                listing.status = 'closed'
                listing.save()
                listing.refresh_from_db()
        return Response(ListingSerializer(listing, context={'request': request}).data)

    # Mutations require ownership
    if listing.seller != request.user:
        return Response({'error': 'You do not own this listing.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method in ('PUT', 'PATCH'):
        old_price = listing.price
        partial = request.method == 'PATCH'
        serializer = ListingCreateSerializer(listing, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        serializer.instance.refresh_from_db()

        # Re-run content moderation on edit
        flagged, reason = check_listing(serializer.instance)
        if flagged and not serializer.instance.is_flagged:
            serializer.instance.is_flagged = True
            serializer.instance.flagged_reason = reason
            serializer.instance.save(update_fields=['is_flagged', 'flagged_reason'])

        # Price drop notification: notify all users who favourited this listing
        new_price = serializer.instance.price
        if new_price < old_price:
            watchers = UserInteraction.objects.filter(
                listing=serializer.instance, interaction_type='favorite'
            ).select_related('user')
            for interaction in watchers:
                create_notification(
                    interaction.user, 'price_drop',
                    f'Price drop on "{serializer.instance.title}"',
                    f'Price dropped from ${old_price} to ${new_price}.',
                    f'/listings/{serializer.instance.id}'
                )

        return Response(ListingSerializer(serializer.instance, context={'request': request}).data)

    if request.method == 'DELETE':
        listing.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_listing_image(request, pk):
    try:
        listing = Listing.objects.get(pk=pk, seller=request.user)
    except Listing.DoesNotExist:
        return Response({'error': 'Listing not found or not yours.'}, status=status.HTTP_404_NOT_FOUND)

    if listing.images.count() >= 5:
        return Response({'error': 'Maximum 5 images per listing.'}, status=status.HTTP_400_BAD_REQUEST)

    image = request.FILES.get('image')
    if not image:
        return Response({'error': 'No image provided.'}, status=status.HTTP_400_BAD_REQUEST)

    order = listing.images.count()
    li = ListingImage.objects.create(listing=listing, image=image, order=order)
    return Response(ListingImageSerializer(li, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([AllowAny])
def related_listings(request, pk):
    try:
        listing = Listing.objects.get(pk=pk)
    except Listing.DoesNotExist:
        return Response({'error': 'Listing not found.'}, status=status.HTTP_404_NOT_FOUND)

    price = listing.price
    price_min = price * Decimal('0.8')
    price_max = price * Decimal('1.2')

    related = _annotate_listings(
        Listing.objects.filter(
            category=listing.category,
            status='active',
            price__gte=price_min,
            price__lte=price_max,
        ).exclude(pk=pk).prefetch_related('images').select_related('seller', 'category'),
        request.user
    )[:6]

    return Response(ListingSerializer(related, many=True, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([AllowAny])
def batch_listings(request):
    """Fetch multiple listings by IDs in a single request."""
    ids = request.data.get('ids', [])
    if not isinstance(ids, list):
        return Response({'error': 'ids must be a list.'}, status=status.HTTP_400_BAD_REQUEST)
    ids = [int(i) for i in ids[:12] if str(i).isdigit()]
    if not ids:
        return Response([])
    qs = _annotate_listings(
        Listing.objects.filter(id__in=ids, status='active').select_related('seller', 'category').prefetch_related('images'),
        request.user
    )
    return Response(ListingSerializer(qs, many=True, context={'request': request}).data)


# ─── Offers ───────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def offer_list_create(request, pk):
    try:
        listing = Listing.objects.get(pk=pk)
    except Listing.DoesNotExist:
        return Response({'error': 'Listing not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        # Only seller can see offers on their listing
        if listing.seller != request.user:
            return Response({'error': 'Only the seller can view offers.'}, status=status.HTTP_403_FORBIDDEN)
        offers = Offer.objects.filter(listing=listing).select_related('buyer')
        return Response(OfferSerializer(offers, many=True).data)

    # POST: Buyer submits offer
    if request.user.role != 'buyer':
        return Response({'error': 'Only buyers can submit offers.'}, status=status.HTTP_403_FORBIDDEN)
    if listing.seller == request.user:
        return Response({'error': 'You cannot offer on your own listing.'}, status=status.HTTP_400_BAD_REQUEST)
    if listing.is_auction:
        return Response({'error': 'Use bidding for auction listings.'}, status=status.HTTP_400_BAD_REQUEST)
    if BlockedUser.objects.filter(blocker=listing.seller, blocked=request.user).exists():
        return Response({'error': 'You cannot make offers to this seller.'}, status=status.HTTP_403_FORBIDDEN)

    # Check for existing pending offer
    if Offer.objects.filter(listing=listing, buyer=request.user, status='PENDING').exists():
        return Response({'error': 'You already have a pending offer on this listing.'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = OfferSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    offer = serializer.save(listing=listing, buyer=request.user)

    # Notify seller (don't let notification failure block the offer)
    try:
        from notifications.emails import new_offer as new_offer_html
        frontend_url = getattr(django_settings, 'FRONTEND_URL', 'http://localhost:5173')
        send_email(
            recipient=listing.seller.email,
            subject=f'New offer on "{listing.title}"',
            body=f'Hi {listing.seller.username},\n\n{request.user.username} submitted an offer of ${offer.offer_price} on your listing "{listing.title}".\n\nLog in to review it.\n\nSellIt Team',
            html=new_offer_html(listing.seller.username, request.user.username, listing.title, offer.offer_price, frontend_url),
        )
        create_notification(
            listing.seller, 'offer_received',
            f'New offer on "{listing.title}"',
            f'{request.user.username} offered ${offer.offer_price}.',
            '/seller/offers'
        )
    except Exception:
        pass

    return Response(OfferSerializer(offer).data, status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def offer_update(request, offer_id):
    try:
        offer = Offer.objects.select_related('listing__seller', 'buyer').get(pk=offer_id)
    except Offer.DoesNotExist:
        return Response({'error': 'Offer not found.'}, status=status.HTTP_404_NOT_FOUND)

    listing = offer.listing

    # Only the listing's seller can accept/reject
    if listing.seller != request.user:
        return Response({'error': 'Only the listing seller can respond to offers.'}, status=status.HTTP_403_FORBIDDEN)

    if offer.status != 'PENDING':
        return Response({'error': 'Offer is no longer pending.'}, status=status.HTTP_400_BAD_REQUEST)

    new_status = request.data.get('status')
    if new_status not in ('ACCEPTED', 'REJECTED'):
        return Response({'error': 'Status must be ACCEPTED or REJECTED.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        # Lock listing to prevent two offers being accepted simultaneously
        listing = Listing.objects.select_for_update().get(pk=listing.pk)
        if listing.status != 'active':
            return Response({'error': 'Listing is no longer available.'}, status=status.HTTP_400_BAD_REQUEST)

        offer.status = new_status
        offer.save()

        if new_status == 'ACCEPTED':
            # Reject all other pending offers
            Offer.objects.filter(listing=listing, status='PENDING').exclude(pk=offer.pk).update(status='REJECTED')

            # Mark listing as sold
            listing.status = 'sold'
            listing.save()

            # Create order + Stripe PaymentIntent
            stripe.api_key = django_settings.STRIPE_SECRET_KEY

            order = Order.objects.create(
                listing=listing,
                buyer=offer.buyer,
                seller=listing.seller,
                offer=offer,
                total_amount=offer.offer_price,
                status='pending_payment',
            )

            amount_cents = int(offer.offer_price * 100)
            intent = None
            if django_settings.STRIPE_SECRET_KEY:
                try:
                    intent = stripe.PaymentIntent.create(
                        amount=amount_cents,
                        currency='cad',
                        metadata={'order_id': str(order.id)},
                    )
                    Payment.objects.create(
                        order=order,
                        stripe_payment_intent_id=intent.id,
                        amount=offer.offer_price,
                        status='pending',
                    )
                except Exception:
                    logger.exception('Stripe PaymentIntent failed for offer order %s', order.id)

            # Notify buyer
            from notifications.emails import offer_accepted as offer_accepted_html
            frontend_url = getattr(django_settings, 'FRONTEND_URL', 'http://localhost:5173')
            send_email(
                recipient=offer.buyer.email,
                subject=f'Your offer on "{listing.title}" was accepted!',
                body=f'Hi {offer.buyer.username},\n\nYour offer of ${offer.offer_price} on "{listing.title}" was accepted!\n\nProceed to payment to complete your purchase.\n\nSellIt Team',
                html=offer_accepted_html(offer.buyer.username, listing.title, offer.offer_price, frontend_url),
            )
            create_notification(
                offer.buyer, 'offer_accepted',
                f'Offer accepted on "{listing.title}"',
                f'Your offer of ${offer.offer_price} was accepted. Pay now to complete.',
                '/buyer/orders'
            )

            response_data = OfferSerializer(offer).data
            if intent:
                response_data['client_secret'] = intent.client_secret
                response_data['order_id'] = order.id
            return Response(response_data)

    # Rejected
    from notifications.emails import offer_rejected as offer_rejected_html
    frontend_url = getattr(django_settings, 'FRONTEND_URL', 'http://localhost:5173')
    send_email(
        recipient=offer.buyer.email,
        subject=f'Your offer on "{listing.title}" was declined',
        body=f'Hi {offer.buyer.username},\n\nUnfortunately your offer of ${offer.offer_price} on "{listing.title}" was declined.\n\nSellIt Team',
        html=offer_rejected_html(offer.buyer.username, listing.title, offer.offer_price, listing.id, frontend_url),
    )
    create_notification(
        offer.buyer, 'offer_rejected',
        f'Offer declined on "{listing.title}"',
        f'Your offer of ${offer.offer_price} was not accepted.',
        f'/listings/{listing.id}'
    )
    return Response(OfferSerializer(offer).data)


# ─── Bids ─────────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticatedOrReadOnly])
def bid_list_create(request, pk):
    try:
        listing = Listing.objects.get(pk=pk)
    except Listing.DoesNotExist:
        return Response({'error': 'Listing not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        bids = Bid.objects.filter(listing=listing).select_related('bidder')
        return Response(BidSerializer(bids, many=True).data)

    # POST: place bid
    if request.user.role != 'buyer':
        return Response({'error': 'Only buyers can place bids.'}, status=status.HTTP_403_FORBIDDEN)
    if listing.seller == request.user:
        return Response({'error': 'You cannot bid on your own listing.'}, status=status.HTTP_400_BAD_REQUEST)
    if not listing.is_auction:
        return Response({'error': 'This listing is not an auction.'}, status=status.HTTP_400_BAD_REQUEST)
    if listing.auction_end_time and listing.auction_end_time < timezone.now():
        return Response({'error': 'This auction has ended.'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = BidSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    amount = serializer.validated_data['amount']

    with transaction.atomic():
        # Lock the listing row
        listing = Listing.objects.select_for_update().get(pk=pk)
        min_bid = listing.current_bid or listing.price
        if amount <= min_bid:
            return Response(
                {'error': f'Bid must be greater than ${min_bid}.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Find previous top bidder to notify them they've been outbid
        prev_top = Bid.objects.filter(listing=listing).order_by('-amount').first()

        bid = serializer.save(listing=listing, bidder=request.user)
        listing.current_bid = amount
        listing.save()

    # Notify seller of new bid
    create_notification(
        listing.seller, 'new_bid',
        f'New bid on "{listing.title}"',
        f'{request.user.username} bid ${amount}.',
        f'/listings/{listing.id}'
    )
    # Notify previous top bidder they've been outbid
    if prev_top and prev_top.bidder != request.user:
        create_notification(
            prev_top.bidder, 'outbid',
            f'You were outbid on "{listing.title}"',
            f'Someone bid ${amount}. Bid again to stay in the lead.',
            f'/listings/{listing.id}'
        )

    return Response(BidSerializer(bid).data, status=status.HTTP_201_CREATED)


# ─── User Interactions ────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def log_view(request, pk):
    try:
        listing = Listing.objects.get(pk=pk)
    except Listing.DoesNotExist:
        return Response({'error': 'Listing not found.'}, status=status.HTTP_404_NOT_FOUND)
    if not UserInteraction.objects.filter(
        user=request.user, listing=listing, interaction_type='view'
    ).exists():
        UserInteraction.objects.create(
            user=request.user, listing=listing, interaction_type='view'
        )
    return Response({'status': 'ok'})


@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def toggle_favorite(request, pk):
    try:
        listing = Listing.objects.get(pk=pk)
    except Listing.DoesNotExist:
        return Response({'error': 'Listing not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'POST':
        obj, created = UserInteraction.objects.get_or_create(
            user=request.user, listing=listing, interaction_type='favorite'
        )
        return Response({'favorited': True, 'created': created})
    else:
        UserInteraction.objects.filter(user=request.user, listing=listing, interaction_type='favorite').delete()
        return Response({'favorited': False})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_favorites(request):
    fav_ids = UserInteraction.objects.filter(
        user=request.user, interaction_type='favorite'
    ).values_list('listing_id', flat=True)
    listings = Listing.objects.filter(id__in=fav_ids, status='active').prefetch_related('images').select_related('seller', 'category')
    return Response(ListingSerializer(listings, many=True, context={'request': request}).data)


# ─── Contact Seller ───────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def contact_seller(request, pk):
    try:
        listing = Listing.objects.select_related('seller').get(pk=pk)
    except Listing.DoesNotExist:
        return Response({'error': 'Listing not found.'}, status=status.HTTP_404_NOT_FOUND)

    if listing.seller == request.user:
        return Response({'error': 'You cannot contact yourself.'}, status=status.HTTP_400_BAD_REQUEST)

    message = request.data.get('message', '').strip()
    if not message:
        return Response({'error': 'Message is required.'}, status=status.HTTP_400_BAD_REQUEST)

    from notifications.emails import listing_inquiry as listing_inquiry_html
    frontend_url = getattr(django_settings, 'FRONTEND_URL', 'http://localhost:5173')
    send_email(
        recipient=listing.seller.email,
        subject=f'Message about your listing "{listing.title}"',
        body=(
            f'Hi {listing.seller.username},\n\n'
            f'{request.user.username} sent you a message about your listing "{listing.title}":\n\n'
            f'{message}\n\nSellIt Team'
        ),
        html=listing_inquiry_html(listing.seller.username, request.user.username, listing.title, message, frontend_url),
    )
    return Response({'status': 'Message sent.'})


# ─── Seller Dashboard ────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def seller_listings(request):
    if request.user.role != 'seller':
        return Response({'error': 'Sellers only.'}, status=status.HTTP_403_FORBIDDEN)
    listings = Listing.objects.filter(seller=request.user).prefetch_related('images').select_related('category')
    return Response(ListingSerializer(listings, many=True, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def seller_offers(request):
    if request.user.role != 'seller':
        return Response({'error': 'Sellers only.'}, status=status.HTTP_403_FORBIDDEN)
    offers = Offer.objects.filter(listing__seller=request.user).select_related('buyer', 'listing')
    return Response(OfferSerializer(offers, many=True).data)


# ─── Buy Now ──────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def buy_now(request, pk):
    try:
        listing = Listing.objects.select_related('seller').get(pk=pk)
    except Listing.DoesNotExist:
        return Response({'error': 'Listing not found.'}, status=status.HTTP_404_NOT_FOUND)

    if listing.seller == request.user:
        return Response({'error': 'You cannot buy your own listing.'}, status=status.HTTP_400_BAD_REQUEST)
    if listing.is_auction:
        return Response({'error': 'Use bidding for auction listings.'}, status=status.HTTP_400_BAD_REQUEST)
    if BlockedUser.objects.filter(blocker=listing.seller, blocked=request.user).exists():
        return Response({'error': 'You cannot purchase from this seller.'}, status=status.HTTP_403_FORBIDDEN)

    with transaction.atomic():
        # Re-fetch with lock to prevent two buyers purchasing the same listing simultaneously
        listing = Listing.objects.select_for_update().get(pk=pk)
        if listing.status != 'active':
            return Response({'error': 'Listing is no longer available.'}, status=status.HTTP_400_BAD_REQUEST)

        listing.status = 'sold'
        listing.save()

        order = Order.objects.create(
            listing=listing,
            buyer=request.user,
            seller=listing.seller,
            total_amount=listing.price,
            status='pending_payment',
        )

        stripe.api_key = django_settings.STRIPE_SECRET_KEY
        intent = None
        client_secret = None
        if django_settings.STRIPE_SECRET_KEY:
            try:
                intent = stripe.PaymentIntent.create(
                    amount=int(listing.price * 100),
                    currency='cad',
                    metadata={'order_id': str(order.id)},
                )
                from orders.models import Payment as PaymentModel
                PaymentModel.objects.create(
                    order=order,
                    stripe_payment_intent_id=intent.id,
                    amount=listing.price,
                    status='pending',
                )
                client_secret = intent.client_secret
            except Exception:
                logger.exception('Stripe PaymentIntent failed for buy_now order %s', order.id)

    return Response({
        'order_id': order.id,
        'client_secret': client_secret,
        'amount': str(listing.price),
    }, status=status.HTTP_201_CREATED)


# ─── Accept Auction Bid ───────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_auction_bid(request, pk):
    try:
        listing = Listing.objects.select_related('seller').get(pk=pk)
    except Listing.DoesNotExist:
        return Response({'error': 'Listing not found.'}, status=status.HTTP_404_NOT_FOUND)

    if listing.seller != request.user:
        return Response({'error': 'Only the seller can accept a bid.'}, status=status.HTTP_403_FORBIDDEN)
    if not listing.is_auction:
        return Response({'error': 'This listing is not an auction.'}, status=status.HTTP_400_BAD_REQUEST)
    if listing.status != 'active':
        return Response({'error': 'Listing is not active.'}, status=status.HTTP_400_BAD_REQUEST)

    # Get the highest bid
    top_bid = Bid.objects.filter(listing=listing).order_by('-amount').first()
    if not top_bid:
        return Response({'error': 'No bids have been placed yet.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        listing.status = 'sold'
        listing.save()

        order = Order.objects.create(
            listing=listing,
            buyer=top_bid.bidder,
            seller=listing.seller,
            total_amount=top_bid.amount,
            status='pending_payment',
        )

        stripe.api_key = django_settings.STRIPE_SECRET_KEY
        client_secret = None
        if django_settings.STRIPE_SECRET_KEY:
            try:
                intent = stripe.PaymentIntent.create(
                    amount=int(top_bid.amount * 100),
                    currency='cad',
                    metadata={'order_id': str(order.id)},
                )
                from orders.models import Payment as PaymentModel
                PaymentModel.objects.create(
                    order=order,
                    stripe_payment_intent_id=intent.id,
                    amount=top_bid.amount,
                    status='pending',
                )
                client_secret = intent.client_secret
            except Exception:
                logger.exception('Stripe PaymentIntent failed for auction order %s', order.id)

        # Notify winner
        from notifications.emails import auction_won as auction_won_html
        frontend_url = getattr(django_settings, 'FRONTEND_URL', 'http://localhost:5173')
        send_email(
            recipient=top_bid.bidder.email,
            subject=f'You won the auction for "{listing.title}"!',
            body=(
                f'Hi {top_bid.bidder.username},\n\n'
                f'Congratulations! The seller accepted your bid of ${top_bid.amount} '
                f'for "{listing.title}".\n\n'
                f'Please complete your payment to confirm the purchase.\n\nSellIt Team'
            ),
            html=auction_won_html(top_bid.bidder.username, listing.title, top_bid.amount, frontend_url),
        )

    return Response({
        'order_id': order.id,
        'client_secret': client_secret,
        'winner': top_bid.bidder.username,
        'amount': str(top_bid.amount),
    })


# ─── Report Listing ───────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def report_listing(request, pk):
    try:
        listing = Listing.objects.get(pk=pk)
    except Listing.DoesNotExist:
        return Response({'error': 'Listing not found.'}, status=status.HTTP_404_NOT_FOUND)

    if listing.seller == request.user:
        return Response({'error': 'You cannot report your own listing.'}, status=status.HTTP_400_BAD_REQUEST)

    reason = request.data.get('reason', '').strip()
    valid_reasons = [r[0] for r in ListingReport.REASON_CHOICES]
    if reason not in valid_reasons:
        return Response({'error': f'Reason must be one of: {", ".join(valid_reasons)}'}, status=status.HTTP_400_BAD_REQUEST)

    _, created = ListingReport.objects.get_or_create(
        reporter=request.user, listing=listing,
        defaults={'reason': reason, 'detail': request.data.get('detail', '').strip()}
    )
    if not created:
        return Response({'error': 'You have already reported this listing.'}, status=status.HTTP_400_BAD_REQUEST)

    # Auto-escalation: hide listing after threshold reports
    threshold = getattr(django_settings, 'REPORT_AUTO_HIDE_THRESHOLD', 3)
    report_count = ListingReport.objects.filter(listing=listing).count()
    if report_count >= threshold and listing.status == 'active':
        listing.status = 'closed'
        listing.is_flagged = True
        listing.flagged_reason = f'Auto-hidden: {report_count} reports received'
        listing.save(update_fields=['status', 'is_flagged', 'flagged_reason'])
        create_notification(
            listing.seller, 'listing_flagged',
            f'Your listing "{listing.title}" has been hidden',
            f'It received {report_count} reports and was automatically hidden pending admin review.',
            f'/listings/{listing.id}'
        )

    return Response({'status': 'Report submitted. Thanks for letting us know.'}, status=status.HTTP_201_CREATED)


# ─── Admin: List Reports ─────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_reports(request):
    if not request.user.is_staff and request.user.role != 'admin':
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    reports = ListingReport.objects.select_related('reporter', 'listing', 'listing__seller').order_by('-created_at')
    data = [
        {
            'id': r.id,
            'reporter_username': r.reporter.username,
            'listing_id': r.listing.id,
            'listing_title': r.listing.title,
            'seller_username': r.listing.seller.username,
            'reason': r.reason,
            'reason_display': r.get_reason_display(),
            'detail': r.detail,
            'created_at': r.created_at.isoformat(),
        }
        for r in reports
    ]
    return Response(data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def admin_delete_report(request, report_id):
    if not request.user.is_staff and request.user.role != 'admin':
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
    try:
        report = ListingReport.objects.get(pk=report_id)
    except ListingReport.DoesNotExist:
        return Response({'error': 'Report not found.'}, status=status.HTTP_404_NOT_FOUND)
    report.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ─── Delete Listing Image ─────────────────────────────────────────────────────

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_listing_image(request, pk, image_id):
    try:
        listing = Listing.objects.get(pk=pk, seller=request.user)
    except Listing.DoesNotExist:
        return Response({'error': 'Listing not found or not yours.'}, status=status.HTTP_404_NOT_FOUND)

    try:
        image = ListingImage.objects.get(pk=image_id, listing=listing)
    except ListingImage.DoesNotExist:
        return Response({'error': 'Image not found.'}, status=status.HTTP_404_NOT_FOUND)

    image.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ─── Search Alerts ────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def search_alert_list_create(request):
    if request.method == 'GET':
        alerts = SearchAlert.objects.filter(user=request.user)
        data = [
            {
                'id': a.id,
                'label': a.label,
                'query': a.query,
                'category': a.category.name if a.category else '',
                'condition': a.condition,
                'max_price': str(a.max_price) if a.max_price else '',
                'is_active': a.is_active,
                'created_at': a.created_at.isoformat(),
            }
            for a in alerts
        ]
        return Response(data)

    label = request.data.get('label', '').strip()
    if not label:
        return Response({'error': 'label is required.'}, status=status.HTTP_400_BAD_REQUEST)

    category_id = request.data.get('category') or None
    category = None
    if category_id:
        try:
            category = Category.objects.get(pk=category_id)
        except Category.DoesNotExist:
            pass

    max_price = request.data.get('max_price') or None
    alert = SearchAlert.objects.create(
        user=request.user,
        label=label,
        query=request.data.get('query', '').strip(),
        category=category,
        condition=request.data.get('condition', '').strip(),
        max_price=max_price,
    )
    return Response({'id': alert.id, 'label': alert.label}, status=status.HTTP_201_CREATED)


@api_view(['DELETE', 'PATCH'])
@permission_classes([IsAuthenticated])
def search_alert_detail(request, alert_id):
    try:
        alert = SearchAlert.objects.get(pk=alert_id, user=request.user)
    except SearchAlert.DoesNotExist:
        return Response({'error': 'Alert not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        alert.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # PATCH: toggle active
    alert.is_active = request.data.get('is_active', alert.is_active)
    alert.save()
    return Response({'id': alert.id, 'is_active': alert.is_active})
