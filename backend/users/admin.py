from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'role', 'is_verified', 'is_verified_seller', 'is_active', 'date_joined')
    list_filter = ('role', 'is_verified', 'is_verified_seller', 'is_active')
    search_fields = ('username', 'email')
    ordering = ('-date_joined',)
    fieldsets = BaseUserAdmin.fieldsets + (
        ('SellIt Fields', {'fields': ('role', 'is_verified', 'is_verified_seller', 'bio', 'avatar', 'verification_token', 'password_reset_token')}),
    )
    actions = ['ban_users', 'unban_users', 'grant_verified_seller', 'revoke_verified_seller']

    def ban_users(self, request, queryset):
        queryset.update(is_active=False)
        self.message_user(request, f'{queryset.count()} users banned.')
    ban_users.short_description = 'Ban selected users'

    def unban_users(self, request, queryset):
        queryset.update(is_active=True)
        self.message_user(request, f'{queryset.count()} users unbanned.')
    unban_users.short_description = 'Unban selected users'

    def grant_verified_seller(self, request, queryset):
        queryset.update(is_verified_seller=True)
        self.message_user(request, f'{queryset.count()} sellers granted verified badge.')
    grant_verified_seller.short_description = 'Grant verified seller badge'

    def revoke_verified_seller(self, request, queryset):
        queryset.update(is_verified_seller=False)
        self.message_user(request, f'{queryset.count()} sellers had verified badge revoked.')
    revoke_verified_seller.short_description = 'Revoke verified seller badge'
