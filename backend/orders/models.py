from django.db import models
from django.conf import settings


class Order(models.Model):
    STATUS_CHOICES = [
        ('pending_payment', 'Pending Payment'),
        ('paid', 'Paid'),
        ('shipped', 'Shipped'),
        ('delivered', 'Delivered'),
        ('cancelled', 'Cancelled'),
    ]
    ESCROW_CHOICES = [
        ('pending', 'Pending'),
        ('held', 'Held in Escrow'),
        ('released', 'Released to Seller'),
        ('refunded', 'Refunded to Buyer'),
        ('disputed', 'Frozen — Dispute Active'),
    ]

    listing = models.ForeignKey('listings.Listing', on_delete=models.SET_NULL, null=True, related_name='orders')
    buyer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='orders_as_buyer')
    seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='orders_as_seller')
    offer = models.ForeignKey('listings.Offer', on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending_payment')
    escrow_status = models.CharField(max_length=10, choices=ESCROW_CHOICES, default='pending')
    tracking_number = models.CharField(max_length=100, blank=True, default='')
    delivered_at = models.DateTimeField(null=True, blank=True)
    protection_expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'orders'
        ordering = ['-created_at']

    def __str__(self):
        return f'Order #{self.id} - {self.listing} (${self.total_amount})'


class Payment(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('succeeded', 'Succeeded'),
        ('failed', 'Failed'),
    ]

    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='payment')
    stripe_payment_intent_id = models.CharField(max_length=255, unique=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payments'

    def __str__(self):
        return f'Payment for Order #{self.order.id} ({self.status})'


class Review(models.Model):
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='review')
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reviews_given')
    seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reviews_received')
    rating = models.PositiveSmallIntegerField()  # 1-5
    comment = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'reviews'
        ordering = ['-created_at']

    def __str__(self):
        return f'Review {self.rating}★ by {self.reviewer.username} for {self.seller.username}'


class Dispute(models.Model):
    REASON_CHOICES = [
        ('item_not_received', 'Item Not Received'),
        ('item_not_as_described', 'Item Not as Described'),
        ('damaged', 'Item Arrived Damaged'),
        ('wrong_item', 'Wrong Item Sent'),
        ('other', 'Other'),
    ]
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('under_review', 'Under Review'),
        ('resolved_refund', 'Resolved — Refund Issued'),
        ('resolved_no_refund', 'Resolved — No Refund'),
        ('closed', 'Closed'),
    ]

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='disputes')
    opened_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='disputes_opened')
    reason = models.CharField(max_length=30, choices=REASON_CHOICES)
    description = models.TextField()
    status = models.CharField(max_length=25, choices=STATUS_CHOICES, default='open')
    resolution = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'disputes'
        ordering = ['-created_at']

    def __str__(self):
        return f'Dispute #{self.id} on Order #{self.order_id} ({self.status})'


class ReviewImage(models.Model):
    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='reviews/')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'review_images'
        ordering = ['created_at']

    def __str__(self):
        return f'Image for review #{self.review_id}'


class Receipt(models.Model):
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='receipt')
    issued_at = models.DateTimeField(auto_now_add=True)
    pdf_url = models.CharField(max_length=500, blank=True, default='')

    class Meta:
        db_table = 'receipts'

    def __str__(self):
        return f'Receipt for Order #{self.order.id}'
