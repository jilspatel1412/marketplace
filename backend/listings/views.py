from decimal import Decimal
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from notifications.utils import send_email
from .models import Category, Listing, ListingImage, Offer, Bid, SearchLog, UserInteraction
from .serializers import (
    CategorySerializer, ListingSerializer, ListingCreateSerializer,
    ListingImageSerializer, OfferSerializer, BidSerializer
)
from .permissions import IsSeller, IsBuyer, IsListingOwner


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
        qs = Listing.objects.filter(status='active').select_related('seller', 'category').prefetch_related('images')

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

        min_price = request.query_params.get('min_price')
        max_price = request.query_params.get('max_price')
        if min_price:
            qs = qs.filter(price__gte=min_price)
        if max_price:
            qs = qs.filter(price__lte=max_price)

        serializer = ListingSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    # POST - seller only
    if request.user.role != 'seller':
        return Response({'error': 'Only sellers can create listings.'}, status=status.HTTP_403_FORBIDDEN)

    serializer = ListingCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    listing = serializer.save(seller=request.user)
    return Response(ListingSerializer(listing, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticatedOrReadOnly])
def listing_detail(request, pk):
    try:
        listing = Listing.objects.select_related('seller', 'category').prefetch_related('images').get(pk=pk)
    except Listing.DoesNotExist:
        return Response({'error': 'Listing not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        # Log view interaction for authenticated users
        if request.user.is_authenticated:
            UserInteraction.objects.get_or_create(
                user=request.user, listing=listing, interaction_type='view'
            )
        return Response(ListingSerializer(listing, context={'request': request}).data)

    # Mutations require ownership
    if listing.seller != request.user:
        return Response({'error': 'You do not own this listing.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method in ('PUT', 'PATCH'):
        partial = request.method == 'PATCH'
        serializer = ListingCreateSerializer(listing, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ListingSerializer(listing, context={'request': request}).data)

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

    related = Listing.objects.filter(
        category=listing.category,
        status='active',
        price__gte=price_min,
        price__lte=price_max,
    ).exclude(pk=pk).prefetch_related('images').select_related('seller', 'category')[:6]

    return Response(ListingSerializer(related, many=True, context={'request': request}).data)


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
    if not listing.is_negotiable:
        return Response({'error': 'This listing does not accept offers.'}, status=status.HTTP_400_BAD_REQUEST)

    # Check for existing pending offer
    if Offer.objects.filter(listing=listing, buyer=request.user, status='PENDING').exists():
        return Response({'error': 'You already have a pending offer on this listing.'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = OfferSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    offer = serializer.save(listing=listing, buyer=request.user)

    # Notify seller
    send_email(
        recipient=listing.seller.email,
        subject=f'New offer on "{listing.title}"',
        body=f'Hi {listing.seller.username},\n\n{request.user.username} submitted an offer of ${offer.offer_price} on your listing "{listing.title}".\n\nLog in to review it.\n\nSellIt Team'
    )

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
        offer.status = new_status
        offer.save()

        if new_status == 'ACCEPTED':
            # Reject all other pending offers
            Offer.objects.filter(listing=listing, status='PENDING').exclude(pk=offer.pk).update(status='REJECTED')

            # Mark listing as sold
            listing.status = 'sold'
            listing.save()

            # Create order + Stripe PaymentIntent
            import stripe
            from django.conf import settings as django_settings
            from orders.models import Order, Payment

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
                        currency='usd',
                        metadata={'order_id': str(order.id)},
                    )
                    Payment.objects.create(
                        order=order,
                        stripe_payment_intent_id=intent.id,
                        amount=offer.offer_price,
                        status='pending',
                    )
                except Exception:
                    pass

            # Notify buyer
            send_email(
                recipient=offer.buyer.email,
                subject=f'Your offer on "{listing.title}" was accepted!',
                body=f'Hi {offer.buyer.username},\n\nYour offer of ${offer.offer_price} on "{listing.title}" was accepted!\n\nProceed to payment to complete your purchase.\n\nSellIt Team'
            )

            response_data = OfferSerializer(offer).data
            if intent:
                response_data['client_secret'] = intent.client_secret
                response_data['order_id'] = order.id
            return Response(response_data)

    # Rejected
    send_email(
        recipient=offer.buyer.email,
        subject=f'Your offer on "{listing.title}" was declined',
        body=f'Hi {offer.buyer.username},\n\nUnfortunately your offer of ${offer.offer_price} on "{listing.title}" was declined.\n\nSellIt Team'
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

        bid = serializer.save(listing=listing, bidder=request.user)
        listing.current_bid = amount
        listing.save()

    return Response(BidSerializer(bid).data, status=status.HTTP_201_CREATED)


# ─── User Interactions ────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def log_view(request, pk):
    try:
        listing = Listing.objects.get(pk=pk)
    except Listing.DoesNotExist:
        return Response({'error': 'Listing not found.'}, status=status.HTTP_404_NOT_FOUND)
    UserInteraction.objects.get_or_create(user=request.user, listing=listing, interaction_type='view')
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
