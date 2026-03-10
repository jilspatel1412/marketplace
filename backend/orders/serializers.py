from rest_framework import serializers
from .models import Order, Payment, Receipt


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ('id', 'stripe_payment_intent_id', 'amount', 'status', 'created_at')


class ReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Receipt
        fields = ('id', 'issued_at', 'pdf_url')


class OrderSerializer(serializers.ModelSerializer):
    payment = PaymentSerializer(read_only=True)
    receipt = ReceiptSerializer(read_only=True)
    listing_title = serializers.CharField(source='listing.title', read_only=True)
    buyer_username = serializers.CharField(source='buyer.username', read_only=True)
    seller_username = serializers.CharField(source='seller.username', read_only=True)

    class Meta:
        model = Order
        fields = (
            'id', 'listing', 'listing_title', 'buyer', 'buyer_username',
            'seller', 'seller_username', 'offer', 'total_amount', 'status',
            'payment', 'receipt', 'created_at'
        )
        read_only_fields = ('id', 'created_at')
