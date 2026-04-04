from rest_framework import serializers
from .models import Category, Listing, ListingImage, Offer, Bid, UserInteraction


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ('id', 'name', 'slug', 'icon')


class ListingImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ListingImage
        fields = ('id', 'image_url', 'order')

    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image:
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class ListingSerializer(serializers.ModelSerializer):
    images = ListingImageSerializer(many=True, read_only=True)
    category_detail = CategorySerializer(source='category', read_only=True)
    seller_info = serializers.SerializerMethodField()
    bid_count = serializers.SerializerMethodField()
    watcher_count = serializers.SerializerMethodField()
    is_auction = serializers.BooleanField(read_only=True)
    is_favorited = serializers.SerializerMethodField()

    class Meta:
        model = Listing
        fields = (
            'id', 'title', 'description', 'category', 'category_detail',
            'condition', 'price', 'is_negotiable', 'status',
            'auction_end_time', 'current_bid', 'is_auction',
            'images', 'seller_info', 'bid_count', 'watcher_count', 'is_favorited', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'seller_info', 'created_at', 'updated_at', 'current_bid')

    def _build_seller_info(self, seller, avg_rating, review_count):
        return {
            'id': seller.id,
            'username': seller.username,
            'is_verified': seller.is_verified,
            'is_verified_seller': seller.is_verified_seller,
            'avg_rating': round(avg_rating, 1) if avg_rating else None,
            'review_count': review_count or 0,
        }

    def get_seller_info(self, obj):
        # Use pre-annotated values if available (from optimized querysets)
        if hasattr(obj, '_seller_avg_rating'):
            return self._build_seller_info(obj.seller, obj._seller_avg_rating, obj._seller_review_count)
        # Fallback for single-object serialization
        from django.db.models import Avg, Count
        from orders.models import Review
        stats = Review.objects.filter(seller=obj.seller).aggregate(
            avg=Avg('rating'), count=Count('id')
        )
        return self._build_seller_info(obj.seller, stats['avg'], stats['count'])

    def get_bid_count(self, obj):
        if hasattr(obj, '_bid_count'):
            return obj._bid_count
        return obj.bids.count()

    def get_watcher_count(self, obj):
        if hasattr(obj, '_watcher_count'):
            return obj._watcher_count
        return UserInteraction.objects.filter(listing=obj, interaction_type='favorite').count()

    def get_is_favorited(self, obj):
        if hasattr(obj, '_is_favorited'):
            return obj._is_favorited
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return UserInteraction.objects.filter(
                user=request.user, listing=obj, interaction_type='favorite'
            ).exists()
        return False


class ListingCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Listing
        fields = (
            'id', 'title', 'description', 'category',
            'condition', 'price', 'is_negotiable', 'status',
            'auction_end_time', 'created_at'
        )
        read_only_fields = ('id', 'created_at')

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError('Price must be greater than 0.')
        return value


class OfferSerializer(serializers.ModelSerializer):
    buyer_username = serializers.CharField(source='buyer.username', read_only=True)
    listing_title = serializers.CharField(source='listing.title', read_only=True)

    class Meta:
        model = Offer
        fields = ('id', 'listing', 'listing_title', 'buyer', 'buyer_username', 'offer_price', 'status', 'created_at')
        read_only_fields = ('id', 'buyer', 'listing', 'listing_title', 'status', 'created_at', 'buyer_username')

    def validate_offer_price(self, value):
        if value <= 0:
            raise serializers.ValidationError('Offer price must be greater than 0.')
        return value


class BidSerializer(serializers.ModelSerializer):
    bidder_username = serializers.CharField(source='bidder.username', read_only=True)

    class Meta:
        model = Bid
        fields = ('id', 'listing', 'bidder', 'bidder_username', 'amount', 'created_at')
        read_only_fields = ('id', 'bidder', 'listing', 'created_at', 'bidder_username')

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Bid amount must be greater than 0.')
        return value
