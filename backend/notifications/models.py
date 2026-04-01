from django.db import models
from django.conf import settings


class Notification(models.Model):
    TYPE_CHOICES = [
        ('offer_received', 'Offer Received'),
        ('offer_accepted', 'Offer Accepted'),
        ('offer_rejected', 'Offer Rejected'),
        ('outbid', 'Outbid'),
        ('auction_won', 'Auction Won'),
        ('order_paid', 'Order Paid'),
        ('order_shipped', 'Order Shipped'),
        ('order_delivered', 'Order Delivered'),
        ('new_bid', 'New Bid'),
        ('price_drop', 'Price Drop'),
        ('review_received', 'Review Received'),
        ('dispute_opened', 'Dispute Opened'),
        ('dispute_resolved', 'Dispute Resolved'),
        ('search_alert', 'Search Alert'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    title = models.CharField(max_length=200)
    message = models.TextField()
    link = models.CharField(max_length=200, blank=True, default='')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.type} → {self.user.username}: {self.title}'


class EmailLog(models.Model):
    STATUS_CHOICES = [('sent', 'Sent'), ('failed', 'Failed')]
    recipient = models.EmailField()
    subject = models.CharField(max_length=255)
    body = models.TextField(blank=True, default='')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='sent')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'email_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.subject} → {self.recipient} ({self.status})'
