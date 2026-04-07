from django.db import models
from django.conf import settings


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(unique=True)
    icon = models.CharField(max_length=50, blank=True, default='')

    class Meta:
        db_table = 'categories'
        verbose_name_plural = 'categories'
        ordering = ['name']

    def __str__(self):
        return self.name


class Listing(models.Model):
    CONDITION_CHOICES = [
        ('new', 'New'),
        ('used', 'Used'),
        ('refurbished', 'Refurbished'),
    ]
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('active', 'Active'),
        ('sold', 'Sold'),
        ('closed', 'Closed'),
    ]

    seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='listings')
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name='listings')
    title = models.CharField(max_length=200)
    description = models.TextField()
    price = models.DecimalField(max_digits=12, decimal_places=2)
    is_negotiable = models.BooleanField(default=False)
    condition = models.CharField(max_length=15, choices=CONDITION_CHOICES, default='used')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active', db_index=True)
    auction_end_time = models.DateTimeField(null=True, blank=True)
    current_bid = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    is_flagged = models.BooleanField(default=False)
    flagged_reason = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'listings'
        ordering = ['-created_at']

    def __str__(self):
        return self.title

    @property
    def is_auction(self):
        return self.auction_end_time is not None

    @property
    def primary_image_url(self):
        img = self.images.order_by('order').first()
        return img.image.url if img and img.image else None


class ListingImage(models.Model):
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='listings/')
    url = models.URLField(max_length=500, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'listing_images'
        ordering = ['order']

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.image and not self.url:
            self.url = self.image.url
            ListingImage.objects.filter(pk=self.pk).update(url=self.url)

    def __str__(self):
        return f'Image {self.order} for {self.listing.title}'


class Offer(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('ACCEPTED', 'Accepted'),
        ('REJECTED', 'Rejected'),
        ('WITHDRAWN', 'Withdrawn'),
    ]

    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name='offers')
    buyer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='offers_made')
    offer_price = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'offers'
        ordering = ['-created_at']

    def __str__(self):
        return f'Offer ${self.offer_price} by {self.buyer.username} on {self.listing.title}'


class Bid(models.Model):
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name='bids')
    bidder = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bids')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'bids'
        ordering = ['-amount']

    def __str__(self):
        return f'Bid ${self.amount} by {self.bidder.username} on {self.listing.title}'


class SearchLog(models.Model):
    keyword = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'search_logs'
        ordering = ['-created_at']


class ListingReport(models.Model):
    REASON_CHOICES = [
        ('fake', 'Fake or counterfeit item'),
        ('spam', 'Spam or misleading'),
        ('inappropriate', 'Inappropriate content'),
        ('sold', 'Already sold / unavailable'),
        ('other', 'Other'),
    ]
    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reports')
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name='reports')
    reason = models.CharField(max_length=20, choices=REASON_CHOICES)
    detail = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'listing_reports'
        unique_together = (('reporter', 'listing'),)

    def __str__(self):
        return f'{self.reporter.username} reported {self.listing.title}'


class SearchAlert(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='search_alerts')
    label = models.CharField(max_length=200)
    query = models.CharField(max_length=200, blank=True, default='')
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    condition = models.CharField(max_length=15, blank=True, default='')
    max_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'search_alerts'
        ordering = ['-created_at']

    def __str__(self):
        return f'Alert "{self.label}" for {self.user.username}'


class UserInteraction(models.Model):
    INTERACTION_CHOICES = [
        ('view', 'View'),
        ('favorite', 'Favorite'),
        ('purchase', 'Purchase'),
    ]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='interactions')
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name='interactions')
    interaction_type = models.CharField(max_length=10, choices=INTERACTION_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_interactions'
        ordering = ['-created_at']
        unique_together = (('user', 'listing', 'interaction_type'),)

    def __str__(self):
        return f'{self.user.username} {self.interaction_type} {self.listing.title}'
