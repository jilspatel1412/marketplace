from rest_framework import serializers
from .models import Order, Payment, Receipt, Review, ReviewImage, Dispute


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ('id', 'stripe_payment_intent_id', 'amount', 'status', 'created_at')


class ReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Receipt
        fields = ('id', 'issued_at', 'pdf_url')


class ReviewImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ReviewImage
        fields = ('id', 'image_url', 'created_at')

    def get_image_url(self, obj):
        if obj.image and hasattr(obj.image, 'url'):
            return obj.image.url
        return None


class ReviewSerializer(serializers.ModelSerializer):
    reviewer_username = serializers.CharField(source='reviewer.username', read_only=True)
    images = ReviewImageSerializer(many=True, read_only=True)

    class Meta:
        model = Review
        fields = ('id', 'order', 'reviewer', 'reviewer_username', 'seller', 'rating', 'comment', 'images', 'created_at')
        read_only_fields = ('id', 'created_at', 'reviewer', 'seller', 'order')


class DisputeSerializer(serializers.ModelSerializer):
    opened_by_username = serializers.CharField(source='opened_by.username', read_only=True)
    order_listing = serializers.CharField(source='order.listing.title', read_only=True)

    class Meta:
        model = Dispute
        fields = ('id', 'order', 'order_listing', 'opened_by', 'opened_by_username',
                  'reason', 'description', 'status', 'resolution', 'created_at', 'updated_at')
        read_only_fields = ('id', 'opened_by', 'status', 'resolution', 'created_at', 'updated_at',
                            'opened_by_username', 'order_listing')


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

    escrow_status_display = serializers.CharField(source='get_escrow_status_display', read_only=True)

    class Meta:
        model = Order
        fields = (
            'id', 'listing', 'listing_title', 'buyer', 'buyer_username',
            'seller', 'seller_username', 'offer', 'total_amount', 'status',
            'escrow_status', 'escrow_status_display', 'tracking_number',
            'delivered_at', 'protection_expires_at',
            'payment', 'receipt', 'review', 'has_review', 'created_at'
        )
        read_only_fields = ('id', 'created_at')
