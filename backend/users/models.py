import uuid
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.db import models


class User(AbstractUser):
    ROLE_CHOICES = [
        ('buyer', 'Buyer'),
        ('seller', 'Seller'),
        ('admin', 'Admin'),
    ]
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='buyer')
    is_verified = models.BooleanField(default=False)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    bio = models.TextField(blank=True, default='')
    phone_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    address_line1 = models.CharField(max_length=255, blank=True, default='')
    city = models.CharField(max_length=100, blank=True, default='')
    state_province = models.CharField(max_length=100, blank=True, default='')
    postal_code = models.CharField(max_length=20, blank=True, default='')
    country = models.CharField(max_length=100, blank=True, default='')
    is_verified_seller = models.BooleanField(default=False)
    verification_token = models.UUIDField(default=uuid.uuid4, unique=True, null=True, blank=True)
    password_reset_token = models.UUIDField(null=True, blank=True)
    password_reset_requested_at = models.DateTimeField(null=True, blank=True)

    # 2FA
    totp_secret = models.CharField(max_length=64, blank=True, default='')
    is_2fa_enabled = models.BooleanField(default=False)

    class Meta:
        db_table = 'users'

    def __str__(self):
        return f'{self.username} ({self.role})'

    @property
    def is_seller(self):
        return self.role == 'seller'

    @property
    def is_buyer(self):
        return self.role == 'buyer'

    @property
    def is_admin_user(self):
        return self.role == 'admin'


class ActivityLog(models.Model):
    ACTION_CHOICES = [
        ('login', 'Login'),
        ('login_failed', 'Login Failed'),
        ('register', 'Register'),
        ('password_reset', 'Password Reset'),
        ('profile_update', 'Profile Update'),
        ('2fa_enabled', '2FA Enabled'),
        ('2fa_disabled', '2FA Disabled'),
    ]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='activity_logs')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'activity_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.username} — {self.action} at {self.created_at}'


class BlockedUser(models.Model):
    blocker = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='blocked_users')
    blocked = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='blocked_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'blocked_users'
        unique_together = (('blocker', 'blocked'),)

    def __str__(self):
        return f'{self.blocker.username} blocked {self.blocked.username}'
