from rest_framework import serializers
from .models import Category, Listing, ListingImage, Offer, Bid, UserInteraction
from users.serializers import UserSerializer


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
    is_auction = serializers.BooleanField(read_only=True)

    class Meta:
        model = Listing
        fields = (
            'id', 'title', 'description', 'category', 'category_detail',
            'condition', 'price', 'is_negotiable', 'status',
            'auction_end_time', 'current_bid', 'is_auction',
            'images', 'seller_info', 'bid_count', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'seller_info', 'created_at', 'updated_at', 'current_bid')

    def get_seller_info(self, obj):
        return {
            'id': obj.seller.id,
            'username': obj.seller.username,
            'is_verified': obj.seller.is_verified,
        }

    def get_bid_count(self, obj):
        return obj.bids.count()


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

    class Meta:
        model = Offer
        fields = ('id', 'listing', 'buyer', 'buyer_username', 'offer_price', 'status', 'created_at')
        read_only_fields = ('id', 'buyer', 'listing', 'status', 'created_at', 'buyer_username')

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
