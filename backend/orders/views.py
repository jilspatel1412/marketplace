import io
import stripe
import json
from django.conf import settings
from django.db import models
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.http import FileResponse
from reportlab.lib.pagesizes import A6
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfgen import canvas as rl_canvas

from notifications.utils import send_email, create_notification
from .models import Order, Payment, Receipt, Review
from .serializers import OrderSerializer, ReviewSerializer


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
            currency='usd',
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

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except ValueError:
        return HttpResponse(status=400)
    except stripe.error.SignatureVerificationError:
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
            send_email(
                recipient=order.buyer.email,
                subject=f'Order Confirmed — {order.listing.title}',
                body=(
                    f'Hi {order.buyer.username},\n\n'
                    f'Your payment of ${order.total_amount} for "{order.listing.title}" was successful!\n\n'
                    f'Order #{order.id} is now confirmed.\n\n'
                    f'Receipt issued at: {receipt.issued_at}\n\n'
                    f'Thank you for shopping on SellIt!\n\nSellIt Team'
                )
            )
            buyer = order.buyer
            buyer_addr_parts = [
                buyer.address_line1, buyer.city,
                buyer.state_province, buyer.postal_code, buyer.country
            ]
            buyer_addr = ', '.join(p for p in buyer_addr_parts if p and p.strip()) or 'No address on file'
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
            label_url = f'{frontend_url}/buyer/orders/{order.id}/label'
            send_email(
                recipient=order.seller.email,
                subject=f'New sale — {order.listing.title}',
                body=(
                    f'Hi {order.seller.username},\n\n'
                    f'{buyer.username} has paid for "{order.listing.title}".\n\n'
                    f'Amount: ${order.total_amount} | Order #{order.id}\n\n'
                    f'SHIP TO:\n{buyer.username}\n{buyer_addr}\n\n'
                    f'Download your shipping label: {label_url}\n\n'
                    f'SellIt Team'
                )
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

def _build_full_address(user):
    parts = [user.address_line1, user.city, user.state_province, user.postal_code, user.country]
    return ', '.join(p for p in parts if p and p.strip())


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
    w, h = A6  # 105mm x 148mm
    c = rl_canvas.Canvas(buf, pagesize=A6)

    # Outer border
    c.setStrokeColor(colors.HexColor('#0c0c0e'))
    c.setLineWidth(2)
    c.rect(8 * mm, 8 * mm, w - 16 * mm, h - 16 * mm)

    # Header bar
    c.setFillColor(colors.HexColor('#e03d00'))
    c.rect(8 * mm, h - 28 * mm, w - 16 * mm, 20 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont('Helvetica-Bold', 14)
    c.drawString(14 * mm, h - 20 * mm, 'SELLIT')
    c.setFont('Helvetica', 8)
    c.drawRightString(w - 14 * mm, h - 20 * mm, f'ORDER #{order.id}')

    # Divider
    c.setStrokeColor(colors.HexColor('#dcdce8'))
    c.setLineWidth(0.5)
    c.line(8 * mm, h - 30 * mm, w - 8 * mm, h - 30 * mm)

    seller = order.seller
    buyer = order.buyer
    item_title = order.listing.title if order.listing else f'Order #{order.id}'

    # FROM section
    y = h - 40 * mm
    c.setFillColor(colors.HexColor('#9898a8'))
    c.setFont('Helvetica-Bold', 7)
    c.drawString(14 * mm, y, 'FROM')
    y -= 5 * mm
    c.setFillColor(colors.HexColor('#0c0c0e'))
    c.setFont('Helvetica-Bold', 10)
    c.drawString(14 * mm, y, seller.username)
    y -= 5 * mm
    c.setFont('Helvetica', 9)
    seller_addr = _build_full_address(seller)
    if seller_addr:
        c.drawString(14 * mm, y, seller_addr)
        y -= 5 * mm
    c.drawString(14 * mm, y, seller.email)

    # Divider
    y -= 6 * mm
    c.setStrokeColor(colors.HexColor('#dcdce8'))
    c.line(8 * mm, y, w - 8 * mm, y)

    # TO section
    y -= 8 * mm
    c.setFillColor(colors.HexColor('#9898a8'))
    c.setFont('Helvetica-Bold', 7)
    c.drawString(14 * mm, y, 'TO')
    y -= 5 * mm
    c.setFillColor(colors.HexColor('#0c0c0e'))
    c.setFont('Helvetica-Bold', 12)
    c.drawString(14 * mm, y, buyer.username)
    y -= 6 * mm
    c.setFont('Helvetica', 9)
    buyer_addr = _build_full_address(buyer)
    if buyer_addr:
        for line in buyer_addr.split(', '):
            c.drawString(14 * mm, y, line)
            y -= 5 * mm
    c.drawString(14 * mm, y, buyer.email)

    # Divider
    y -= 6 * mm
    c.setStrokeColor(colors.HexColor('#dcdce8'))
    c.line(8 * mm, y, w - 8 * mm, y)

    # Item
    y -= 7 * mm
    c.setFillColor(colors.HexColor('#9898a8'))
    c.setFont('Helvetica-Bold', 7)
    c.drawString(14 * mm, y, 'ITEM')
    y -= 5 * mm
    c.setFillColor(colors.HexColor('#0c0c0e'))
    c.setFont('Helvetica', 9)
    # Truncate long titles
    title = item_title[:48] + ('…' if len(item_title) > 48 else '')
    c.drawString(14 * mm, y, title)
    y -= 5 * mm
    c.setFont('Helvetica-Bold', 9)
    c.setFillColor(colors.HexColor('#e03d00'))
    c.drawString(14 * mm, y, f'Amount: ${order.total_amount}')

    # Footer
    c.setFillColor(colors.HexColor('#9898a8'))
    c.setFont('Helvetica', 7)
    c.drawCentredString(w / 2, 12 * mm, f'SellIt — sellit.com  |  {order.created_at.strftime("%b %d, %Y")}')

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
        send_email(
            recipient=order.buyer.email,
            subject=f'Your order has shipped — {order.listing.title}',
            body=(
                f'Hi {order.buyer.username},\n\n'
                f'Your order for "{order.listing.title}" has been shipped!\n\n'
                + (f'Tracking number: {tracking_number}\n\n' if tracking_number else '')
                + 'SellIt Team'
            )
        )

    # Buyer can mark as delivered
    elif new_status == 'delivered':
        if request.user != order.buyer:
            return Response({'error': 'Only the buyer can mark as delivered.'}, status=status.HTTP_403_FORBIDDEN)
        if order.status != 'shipped':
            return Response({'error': 'Order must be shipped before marking delivered.'}, status=status.HTTP_400_BAD_REQUEST)
        order.status = 'delivered'
        order.save()
        create_notification(
            order.seller, 'order_delivered',
            f'"{order.listing.title}" was delivered',
            f'{order.buyer.username} confirmed delivery.',
            '/seller/orders'
        )

    else:
        return Response({'error': 'Invalid status. Use "shipped" or "delivered".'}, status=status.HTTP_400_BAD_REQUEST)

    return Response(OrderSerializer(order).data)


# ─── Reviews ──────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
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
