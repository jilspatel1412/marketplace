import io
import logging
import stripe
import json
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)
from django.db import models
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.http import FileResponse
from reportlab.lib.pagesizes import A6
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfgen import canvas as rl_canvas

from notifications.utils import send_email, create_notification
from .models import Order, Payment, Receipt, Review, ReviewImage, Dispute
from .serializers import OrderSerializer, ReviewSerializer, DisputeSerializer


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def order_list(request):
    user = request.user
    if user.role == 'seller':
        orders = Order.objects.filter(seller=user).select_related('listing', 'buyer', 'seller')
    else:
        orders = Order.objects.filter(buyer=user).select_related('listing', 'buyer', 'seller')
    return Response(OrderSerializer(orders, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def order_detail(request, order_id):
    try:
        order = Order.objects.select_related('listing', 'buyer', 'seller').get(pk=order_id)
    except Order.DoesNotExist:
        return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.user not in (order.buyer, order.seller):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    return Response(OrderSerializer(order).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_payment_intent(request):
    order_id = request.data.get('order_id')
    if not order_id:
        return Response({'error': 'order_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        order = Order.objects.get(pk=order_id, buyer=request.user)
    except Order.DoesNotExist:
        return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

    if order.status != 'pending_payment':
        return Response({'error': 'Order is not awaiting payment.'}, status=status.HTTP_400_BAD_REQUEST)

    stripe.api_key = settings.STRIPE_SECRET_KEY

    # Reuse existing payment intent if exists
    if hasattr(order, 'payment'):
        client_secret = _get_intent_secret(order.payment.stripe_payment_intent_id)
        if not client_secret:
            return Response({'error': 'Payment service unavailable. Please try again.'}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({
            'client_secret': client_secret,
            'order_id': order.id,
            'amount': str(order.total_amount),
        })

    amount_cents = int(order.total_amount * 100)
    try:
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency='cad',
            metadata={'order_id': str(order.id)},
        )
    except stripe.error.StripeError:
        return Response({'error': 'Payment service unavailable. Please try again.'}, status=status.HTTP_502_BAD_GATEWAY)
    Payment.objects.create(
        order=order,
        stripe_payment_intent_id=intent.id,
        amount=order.total_amount,
        status='pending',
    )
    return Response({
        'client_secret': intent.client_secret,
        'order_id': order.id,
        'amount': str(order.total_amount),
    })


def _get_intent_secret(intent_id):
    stripe.api_key = settings.STRIPE_SECRET_KEY
    try:
        intent = stripe.PaymentIntent.retrieve(intent_id)
        return intent.client_secret
    except stripe.error.StripeError:
        return None


@csrf_exempt
@require_POST
def stripe_webhook(request):
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE', '')
    webhook_secret = settings.STRIPE_WEBHOOK_SECRET

    if webhook_secret:
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
        except ValueError:
            return HttpResponse(status=400)
        except stripe.error.SignatureVerificationError:
            return HttpResponse(status=400)
    elif settings.DEBUG:
        # No webhook secret configured — trust the event for local development
        try:
            event = json.loads(payload)
        except json.JSONDecodeError:
            return HttpResponse(status=400)
    else:
        return HttpResponse(status=400)

    if event['type'] == 'payment_intent.succeeded':
        payment_intent = event['data']['object']
        intent_id = payment_intent['id']
        order_id = payment_intent.get('metadata', {}).get('order_id')

        try:
            payment = Payment.objects.select_related('order__buyer', 'order__seller', 'order__listing').get(
                stripe_payment_intent_id=intent_id
            )
            payment.status = 'succeeded'
            payment.save()

            order = payment.order
            order.status = 'paid'
            order.escrow_status = 'held'
            order.save()

            # Create receipt
            receipt = Receipt.objects.get_or_create(order=order)[0]

            # In-app notifications
            create_notification(
                order.buyer, 'order_paid',
                f'Payment confirmed for "{order.listing.title}"',
                f'Your payment of ${order.total_amount} was successful. Order #{order.id}.',
                '/buyer/orders'
            )
            create_notification(
                order.seller, 'order_paid',
                f'New sale: "{order.listing.title}"',
                f'{order.buyer.username} paid ${order.total_amount}. Ship the item.',
                '/seller/orders'
            )

            # Send confirmation emails
            from notifications.emails import order_confirmed_buyer, order_confirmed_seller
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
            send_email(
                recipient=order.buyer.email,
                subject=f'Order Confirmed — {order.listing.title}',
                body=(
                    f'Hi {order.buyer.username},\n\n'
                    f'Your payment of ${order.total_amount} for "{order.listing.title}" was successful!\n\n'
                    f'Order #{order.id} is now confirmed.\n\n'
                    f'Thank you for shopping on SellIt!\n\nSellIt Team'
                ),
                html=order_confirmed_buyer(
                    order.buyer.username, order.listing.title,
                    order.total_amount, order.id, frontend_url,
                ),
            )
            buyer = order.buyer
            buyer_addr_parts = [
                buyer.address_line1, buyer.city,
                buyer.state_province, buyer.postal_code, buyer.country
            ]
            buyer_addr = ', '.join(p for p in buyer_addr_parts if p and p.strip()) or 'No address on file'
            send_email(
                recipient=order.seller.email,
                subject=f'New sale — {order.listing.title}',
                body=(
                    f'Hi {order.seller.username},\n\n'
                    f'{buyer.username} has paid for "{order.listing.title}".\n\n'
                    f'Amount: ${order.total_amount} | Order #{order.id}\n\n'
                    f'SHIP TO:\n{buyer.username}\n{buyer_addr}\n\n'
                    f'SellIt Team'
                ),
                html=order_confirmed_seller(
                    order.seller.username, buyer.username, order.listing.title,
                    order.total_amount, order.id, buyer_addr, frontend_url,
                ),
            )
        except Payment.DoesNotExist:
            pass

    elif event['type'] == 'payment_intent.payment_failed':
        payment_intent = event['data']['object']
        intent_id = payment_intent['id']
        try:
            payment = Payment.objects.get(stripe_payment_intent_id=intent_id)
            payment.status = 'failed'
            payment.save()
        except Payment.DoesNotExist:
            pass

    return HttpResponse(status=200)


# ─── Shipping Label ───────────────────────────────────────────────────────────

def _address_lines(user):
    """Return a list of address lines, or a fallback message if nothing is set."""
    lines = []
    if user.address_line1 and user.address_line1.strip():
        lines.append(user.address_line1.strip())
    city_state = ', '.join(p for p in [user.city, user.state_province] if p and p.strip())
    postal = user.postal_code.strip() if user.postal_code else ''
    if city_state and postal:
        lines.append(f'{city_state}  {postal}')
    elif city_state:
        lines.append(city_state)
    elif postal:
        lines.append(postal)
    if user.country and user.country.strip():
        lines.append(user.country.strip())
    if not lines:
        lines = ['[No address — update profile]']
    return lines


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def shipping_label(request, order_id):
    try:
        order = Order.objects.select_related('listing', 'buyer', 'seller').get(pk=order_id)
    except Order.DoesNotExist:
        return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.user not in (order.buyer, order.seller):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    buf = io.BytesIO()
    # Standard 4×6 inch shipping label (101.6mm × 152.4mm)
    W = 101.6 * mm
    H = 152.4 * mm
    c = rl_canvas.Canvas(buf, pagesize=(W, H))

    BLACK   = colors.HexColor('#000000')
    WHITE   = colors.white
    ORANGE  = colors.HexColor('#e03d00')
    GREY    = colors.HexColor('#555555')
    LTGREY  = colors.HexColor('#cccccc')

    seller = order.seller
    buyer  = order.buyer
    item_title = order.listing.title if order.listing else f'Order #{order.id}'
    date_str   = order.created_at.strftime('%b %d, %Y')

    # ── Outer border ──────────────────────────────────────────────────
    c.setStrokeColor(BLACK)
    c.setLineWidth(1.5)
    c.rect(3 * mm, 3 * mm, W - 6 * mm, H - 6 * mm, stroke=1, fill=0)

    # ── Header bar ────────────────────────────────────────────────────
    header_h = 14 * mm
    c.setFillColor(BLACK)
    c.rect(3 * mm, H - 3 * mm - header_h, W - 6 * mm, header_h, fill=1, stroke=0)

    # "SellIt" in orange inside black header
    c.setFillColor(ORANGE)
    c.setFont('Helvetica-Bold', 16)
    c.drawString(7 * mm, H - 3 * mm - header_h + 4 * mm, 'SellIt')

    # Service + date right-aligned
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 7)
    c.drawRightString(W - 7 * mm, H - 3 * mm - header_h + 8 * mm, 'STANDARD SHIPPING')
    c.setFont('Helvetica', 7)
    c.drawRightString(W - 7 * mm, H - 3 * mm - header_h + 3.5 * mm, date_str)

    # ── FROM section ──────────────────────────────────────────────────
    y = H - 3 * mm - header_h - 5 * mm

    c.setFillColor(GREY)
    c.setFont('Helvetica-Bold', 6.5)
    c.drawString(7 * mm, y, 'FROM:')
    y -= 4.5 * mm

    c.setFillColor(BLACK)
    c.setFont('Helvetica-Bold', 8)
    c.drawString(7 * mm, y, seller.username)
    y -= 4 * mm

    c.setFont('Helvetica', 7.5)
    for line in _address_lines(seller):
        c.drawString(7 * mm, y, line)
        y -= 3.8 * mm
    c.setFillColor(GREY)
    c.drawString(7 * mm, y, seller.email)
    y -= 3 * mm

    # ── Thick divider ─────────────────────────────────────────────────
    c.setStrokeColor(BLACK)
    c.setLineWidth(2)
    c.line(3 * mm, y, W - 3 * mm, y)
    y -= 6 * mm

    # ── SHIP TO label ─────────────────────────────────────────────────
    c.setFillColor(GREY)
    c.setFont('Helvetica-Bold', 7)
    c.drawString(7 * mm, y, 'SHIP TO:')
    y -= 6 * mm

    # Buyer name – large
    c.setFillColor(BLACK)
    c.setFont('Helvetica-Bold', 15)
    c.drawString(7 * mm, y, buyer.username.upper())
    y -= 7 * mm

    # Buyer address lines – medium
    buyer_lines = _address_lines(buyer)
    # Separate postal code for the box (last word of city-province-postal line)
    postal_code = (buyer.postal_code or '').strip().upper()

    c.setFont('Helvetica', 10)
    for line in buyer_lines:
        c.drawString(7 * mm, y, line)
        y -= 5.5 * mm

    # ── Postal code box (Canada Post style) ───────────────────────────
    if postal_code:
        y -= 3 * mm
        box_w, box_h = 35 * mm, 18 * mm
        box_x = W - 7 * mm - box_w
        box_y = y - box_h
        c.setStrokeColor(BLACK)
        c.setLineWidth(1.5)
        c.rect(box_x, box_y, box_w, box_h, stroke=1, fill=0)
        c.setFont('Helvetica-Bold', 14)
        c.drawCentredString(box_x + box_w / 2, box_y + 5 * mm, postal_code)
        c.setFont('Helvetica', 5.5)
        c.setFillColor(GREY)
        c.drawCentredString(box_x + box_w / 2, box_y + 2 * mm, 'POSTAL CODE / CODE POSTAL')
        y = box_y - 4 * mm
    else:
        y -= 6 * mm

    # ── Divider ───────────────────────────────────────────────────────
    c.setStrokeColor(LTGREY)
    c.setLineWidth(0.5)
    c.line(3 * mm, y, W - 3 * mm, y)
    y -= 5 * mm

    # ── Item + amount ─────────────────────────────────────────────────
    c.setFillColor(GREY)
    c.setFont('Helvetica-Bold', 6.5)
    c.drawString(7 * mm, y, 'ITEM:')
    y -= 4 * mm

    c.setFillColor(BLACK)
    c.setFont('Helvetica', 8)
    title = item_title[:52] + ('...' if len(item_title) > 52 else '')
    c.drawString(7 * mm, y, title)
    y -= 4.5 * mm

    c.setFont('Helvetica-Bold', 8)
    c.setFillColor(ORANGE)
    c.drawString(7 * mm, y, f'Amount: CAD ${order.total_amount}')
    c.setFillColor(BLACK)
    c.drawRightString(W - 7 * mm, y, f'Order #{order.id}')

    # ── Footer bar ────────────────────────────────────────────────────
    footer_h = 7 * mm
    c.setFillColor(colors.HexColor('#f0f0f0'))
    c.rect(3 * mm, 3 * mm, W - 6 * mm, footer_h, fill=1, stroke=0)
    c.setFillColor(GREY)
    c.setFont('Helvetica', 6)
    c.drawCentredString(W / 2, 3 * mm + 2.5 * mm, 'SellIt Marketplace  —  sellit.com  |  Keep this label for your records')

    c.save()
    buf.seek(0)
    filename = f'shipping-label-order-{order.id}.pdf'
    response = FileResponse(buf, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


# ─── Order Status Update ──────────────────────────────────────────────────────

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_order_status(request, order_id):
    try:
        order = Order.objects.select_related('listing', 'buyer', 'seller').get(pk=order_id)
    except Order.DoesNotExist:
        return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

    new_status = request.data.get('status')
    tracking_number = request.data.get('tracking_number', '').strip()

    # Seller can mark as shipped
    if new_status == 'shipped':
        if request.user != order.seller:
            return Response({'error': 'Only the seller can mark as shipped.'}, status=status.HTTP_403_FORBIDDEN)
        if order.status != 'paid':
            return Response({'error': 'Order must be paid before marking shipped.'}, status=status.HTTP_400_BAD_REQUEST)
        order.status = 'shipped'
        if tracking_number:
            order.tracking_number = tracking_number
        order.save()
        create_notification(
            order.buyer, 'order_shipped',
            f'"{order.listing.title}" has been shipped!',
            f'Your order is on the way.' + (f' Tracking: {tracking_number}' if tracking_number else ''),
            '/buyer/orders'
        )
        from notifications.emails import order_shipped as order_shipped_html
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        send_email(
            recipient=order.buyer.email,
            subject=f'Your order has shipped — {order.listing.title}',
            body=(
                f'Hi {order.buyer.username},\n\n'
                f'Your order for "{order.listing.title}" has been shipped!\n\n'
                + (f'Tracking number: {tracking_number}\n\n' if tracking_number else '')
                + 'SellIt Team'
            ),
            html=order_shipped_html(
                order.buyer.username, order.listing.title,
                tracking_number, frontend_url, order.id,
            ),
        )

    # Buyer can mark as delivered
    elif new_status == 'delivered':
        if request.user != order.buyer:
            return Response({'error': 'Only the buyer can mark as delivered.'}, status=status.HTTP_403_FORBIDDEN)
        if order.status != 'shipped':
            return Response({'error': 'Order must be shipped before marking delivered.'}, status=status.HTTP_400_BAD_REQUEST)

        from datetime import timedelta
        protection_days = getattr(settings, 'PURCHASE_PROTECTION_DAYS', 7)
        now = timezone.now()

        order.status = 'delivered'
        order.delivered_at = now
        order.protection_expires_at = now + timedelta(days=protection_days)
        order.save(update_fields=['status', 'delivered_at', 'protection_expires_at'])

        create_notification(
            order.seller, 'order_delivered',
            f'"{order.listing.title}" was delivered',
            f'{order.buyer.username} confirmed delivery. Funds will be released in {protection_days} days.',
            '/seller/orders'
        )
        create_notification(
            order.buyer, 'order_delivered',
            f'Delivery confirmed — purchase protection active',
            f'You have {protection_days} days to open a dispute if there\'s an issue.',
            '/buyer/orders'
        )

    else:
        return Response({'error': 'Invalid status. Use "shipped" or "delivered".'}, status=status.HTTP_400_BAD_REQUEST)

    return Response(OrderSerializer(order).data)


# ─── Reviews ──────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def create_review(request, order_id):
    try:
        order = Order.objects.select_related('buyer', 'seller', 'listing').get(pk=order_id)
    except Order.DoesNotExist:
        return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.user != order.buyer:
        return Response({'error': 'Only the buyer can leave a review.'}, status=status.HTTP_403_FORBIDDEN)
    if order.status not in ('paid', 'shipped', 'delivered'):
        return Response({'error': 'Can only review after payment.'}, status=status.HTTP_400_BAD_REQUEST)
    if hasattr(order, 'review'):
        return Response({'error': 'You have already reviewed this order.'}, status=status.HTTP_400_BAD_REQUEST)

    rating = request.data.get('rating')
    comment = request.data.get('comment', '').strip()

    try:
        rating = int(rating)
        if not (1 <= rating <= 5):
            raise ValueError
    except (TypeError, ValueError):
        return Response({'error': 'Rating must be 1–5.'}, status=status.HTTP_400_BAD_REQUEST)

    review = Review.objects.create(
        order=order,
        reviewer=request.user,
        seller=order.seller,
        rating=rating,
        comment=comment,
    )

    # Save review images (up to 3)
    images = request.FILES.getlist('images')
    for img in images[:3]:
        ReviewImage.objects.create(review=review, image=img)

    create_notification(
        order.seller, 'review_received',
        f'New review from {request.user.username}',
        f'{rating}★ — {comment[:80] if comment else "No comment."}',
        '/seller/orders'
    )
    return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([AllowAny])
def seller_reviews(request, seller_id):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    try:
        seller = User.objects.get(pk=seller_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
    reviews = Review.objects.filter(seller=seller).select_related('reviewer')
    avg = reviews.aggregate(avg=models.Avg('rating'))['avg']
    return Response({
        'reviews': ReviewSerializer(reviews, many=True).data,
        'average_rating': round(avg, 1) if avg else None,
        'count': reviews.count(),
    })


# ─── Disputes ─────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def dispute_list_create(request):
    if request.method == 'GET':
        # Admin/staff can see all disputes
        if request.user.is_staff or request.user.role == 'admin':
            disputes = Dispute.objects.all().select_related('order__listing', 'opened_by', 'order__buyer', 'order__seller')
        else:
            disputes = Dispute.objects.filter(
                models.Q(order__buyer=request.user) | models.Q(order__seller=request.user)
            ).select_related('order__listing', 'opened_by')
        return Response(DisputeSerializer(disputes, many=True).data)

    # POST: open a dispute
    order_id = request.data.get('order')
    if not order_id:
        return Response({'error': 'order is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        order = Order.objects.get(pk=order_id)
    except Order.DoesNotExist:
        return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.user not in (order.buyer, order.seller):
        return Response({'error': 'You are not party to this order.'}, status=status.HTTP_403_FORBIDDEN)

    if order.status not in ('paid', 'shipped', 'delivered'):
        return Response({'error': 'Can only dispute paid or shipped orders.'}, status=status.HTTP_400_BAD_REQUEST)

    if Dispute.objects.filter(order=order, status__in=('open', 'under_review')).exists():
        return Response({'error': 'An active dispute already exists for this order.'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = DisputeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    dispute = serializer.save(order=order, opened_by=request.user)

    # Freeze escrow release while dispute is active
    if order.escrow_status == 'held':
        order.escrow_status = 'disputed'
        order.save()

    # Notify the other party
    other_party = order.seller if request.user == order.buyer else order.buyer
    create_notification(
        other_party, 'dispute_opened',
        f'Dispute opened on Order #{order.id}',
        f'{request.user.username} opened a dispute: {dispute.reason}.',
        '/buyer/orders' if other_party == order.buyer else '/seller/orders'
    )
    return Response(DisputeSerializer(dispute).data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def dispute_detail(request, dispute_id):
    try:
        dispute = Dispute.objects.select_related('order__buyer', 'order__seller', 'order__listing', 'opened_by').get(pk=dispute_id)
    except Dispute.DoesNotExist:
        return Response({'error': 'Dispute not found.'}, status=status.HTTP_404_NOT_FOUND)

    order = dispute.order
    if request.user not in (order.buyer, order.seller) and not request.user.is_staff:
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        return Response(DisputeSerializer(dispute).data)

    # PATCH: admin/staff resolves, or parties can close
    new_status = request.data.get('status')
    resolution = request.data.get('resolution', '').strip()

    allowed_transitions = []
    if request.user.is_staff or request.user.role == 'admin':
        allowed_transitions = ['under_review', 'resolved_refund', 'resolved_no_refund', 'closed']
    elif request.user in (order.buyer, order.seller):
        allowed_transitions = ['closed']

    if new_status not in allowed_transitions:
        return Response({'error': f'You cannot set status to "{new_status}".'}, status=status.HTTP_403_FORBIDDEN)

    dispute.status = new_status
    if resolution:
        dispute.resolution = resolution
    dispute.save()

    # Process Stripe refund if resolving with refund
    if new_status == 'resolved_refund':
        try:
            payment = Payment.objects.get(order=order, status='succeeded')
            stripe.api_key = settings.STRIPE_SECRET_KEY
            stripe.Refund.create(payment_intent=payment.stripe_payment_intent_id)
            payment.status = 'refunded'
            payment.save()
        except Payment.DoesNotExist:
            pass
        except Exception:
            logger.exception('Stripe refund failed for order %s', order.id)
        order.escrow_status = 'refunded'
        order.save()
    elif new_status in ('resolved_no_refund', 'closed'):
        if order.escrow_status in ('held', 'disputed'):
            order.escrow_status = 'released'
            order.save()

    # Notify both parties on resolution
    if new_status in ('resolved_refund', 'resolved_no_refund', 'closed'):
        for party in (order.buyer, order.seller):
            if party != request.user:
                create_notification(
                    party, 'dispute_resolved',
                    f'Dispute #{dispute.id} resolved',
                    f'Status: {dispute.get_status_display()}.' + (f' Resolution: {resolution}' if resolution else ''),
                    '/buyer/orders' if party == order.buyer else '/seller/orders'
                )

    return Response(DisputeSerializer(dispute).data)


# ─── Admin Stats ─────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_stats(request):
    if not request.user.is_staff and request.user.role != 'admin':
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    from django.contrib.auth import get_user_model
    from listings.models import ListingReport, Listing
    User = get_user_model()

    open_disputes = Dispute.objects.filter(status__in=('open', 'under_review')).count()
    total_disputes = Dispute.objects.count()
    open_reports = ListingReport.objects.count()
    total_orders = Order.objects.count()
    total_users = User.objects.count()
    total_listings = Listing.objects.filter(status='active').count()

    return Response({
        'open_disputes': open_disputes,
        'total_disputes': total_disputes,
        'open_reports': open_reports,
        'total_orders': total_orders,
        'total_users': total_users,
        'total_listings': total_listings,
    })
