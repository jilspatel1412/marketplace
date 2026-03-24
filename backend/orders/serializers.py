from rest_framework import serializers
from .models import Order, Payment, Receipt, Review


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ('id', 'stripe_payment_intent_id', 'amount', 'status', 'created_at')


class ReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Receipt
        fields = ('id', 'issued_at', 'pdf_url')


class ReviewSerializer(serializers.ModelSerializer):
    reviewer_username = serializers.CharField(source='reviewer.username', read_only=True)

    class Meta:
        model = Review
        fields = ('id', 'order', 'reviewer', 'reviewer_username', 'seller', 'rating', 'comment', 'created_at')
        read_only_fields = ('id', 'created_at', 'reviewer', 'seller', 'order')


class OrderSerializer(serializers.ModelSerializer):
    payment = PaymentSerializer(read_only=True)
    receipt = ReceiptSerializer(read_only=True)
    review = ReviewSerializer(read_only=True)
    listing_title = serializers.CharField(source='listing.title', read_only=True)
    buyer_username = serializers.CharField(source='buyer.username', read_only=True)
    seller_username = serializers.CharField(source='seller.username', read_only=True)
    has_review = serializers.SerializerMethodField()

    def get_has_review(self, obj):
        return hasattr(obj, 'review')

    class Meta:
        model = Order
        fields = (
            'id', 'listing', 'listing_title', 'buyer', 'buyer_username',
            'seller', 'seller_username', 'offer', 'total_amount', 'status',
            'tracking_number', 'payment', 'receipt', 'review', 'has_review', 'created_at'
        )
        read_only_fields = ('id', 'created_at')
