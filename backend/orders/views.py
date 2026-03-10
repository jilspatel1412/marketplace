import stripe
import json
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from notifications.utils import send_email
from .models import Order, Payment, Receipt
from .serializers import OrderSerializer


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
        return Response({
            'client_secret': _get_intent_secret(order.payment.stripe_payment_intent_id),
            'order_id': order.id,
            'amount': str(order.total_amount),
        })

    amount_cents = int(order.total_amount * 100)
    intent = stripe.PaymentIntent.create(
        amount=amount_cents,
        currency='usd',
        metadata={'order_id': str(order.id)},
    )
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
    intent = stripe.PaymentIntent.retrieve(intent_id)
    return intent.client_secret


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
            send_email(
                recipient=order.seller.email,
                subject=f'You have a new sale — {order.listing.title}',
                body=(
                    f'Hi {order.seller.username},\n\n'
                    f'Great news! {order.buyer.username} has paid for "{order.listing.title}".\n\n'
                    f'Amount: ${order.total_amount}\nOrder #{order.id}\n\n'
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
