from django.contrib import admin
from .models import Category, Listing, ListingImage, Offer, Bid, UserInteraction


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}
    search_fields = ('name',)


class ListingImageInline(admin.TabularInline):
    model = ListingImage
    extra = 0
    readonly_fields = ('url',)


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = ('title', 'seller', 'category', 'price', 'condition', 'status', 'created_at')
    list_filter = ('status', 'condition', 'category')
    search_fields = ('title', 'description', 'seller__username')
    ordering = ('-created_at',)
    inlines = [ListingImageInline]
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Offer)
class OfferAdmin(admin.ModelAdmin):
    list_display = ('listing', 'buyer', 'offer_price', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('listing__title', 'buyer__username')
    ordering = ('-created_at',)


@admin.register(Bid)
class BidAdmin(admin.ModelAdmin):
    list_display = ('listing', 'bidder', 'amount', 'created_at')
    search_fields = ('listing__title', 'bidder__username')
    ordering = ('-created_at',)


@admin.register(UserInteraction)
class UserInteractionAdmin(admin.ModelAdmin):
    list_display = ('user', 'listing', 'interaction_type', 'created_at')
    list_filter = ('interaction_type',)
    ordering = ('-created_at',)
