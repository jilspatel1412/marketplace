from django.contrib import admin
from .models import Order, Payment, Receipt, Dispute


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'listing', 'buyer', 'seller', 'total_amount', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('listing__title', 'buyer__username', 'seller__username')
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('order', 'stripe_payment_intent_id', 'amount', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('stripe_payment_intent_id', 'order__id')
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = ('order', 'issued_at')
    ordering = ('-issued_at',)
    readonly_fields = ('issued_at',)


@admin.register(Dispute)
class DisputeAdmin(admin.ModelAdmin):
    list_display = ('id', 'order', 'opened_by', 'reason', 'status', 'created_at')
    list_filter = ('status', 'reason')
    search_fields = ('order__id', 'opened_by__username')
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'updated_at')
