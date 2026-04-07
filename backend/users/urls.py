from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('register/', views.register, name='register'),
    path('login/', views.VerifiedTokenObtainPairView.as_view(), name='login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('verify-email/', views.verify_email, name='verify_email'),
    path('resend-verification/', views.resend_verification, name='resend_verification'),
    path('password-reset/', views.password_reset_request, name='password_reset_request'),
    path('password-reset/confirm/', views.password_reset_confirm, name='password_reset_confirm'),
    path('me/', views.me, name='me'),
    path('login/2fa/', views.login_2fa, name='login_2fa'),
    path('2fa/setup/', views.setup_2fa, name='setup_2fa'),
    path('2fa/verify/', views.verify_2fa_setup, name='verify_2fa_setup'),
    path('2fa/disable/', views.disable_2fa, name='disable_2fa'),
    path('sellers/<str:username>/', views.seller_profile, name='seller_profile'),
    # Block / unblock
    path('users/<int:user_id>/block/', views.block_user, name='block_user'),
    path('users/<int:user_id>/unblock/', views.unblock_user, name='unblock_user'),
    path('blocked/', views.blocked_list, name='blocked_list'),
    # Buyer reputation
    path('users/<int:user_id>/reputation/', views.buyer_reputation, name='buyer_reputation'),
    # Admin
    path('admin/users/', views.admin_users, name='admin_users'),
    path('admin/users/<int:user_id>/', views.admin_user_detail, name='admin_user_detail'),
    path('admin/listings/', views.admin_listings, name='admin_listings'),
    path('admin/listings/<int:listing_id>/', views.admin_listing_delete, name='admin_listing_delete'),
    path('admin/activity-logs/', views.admin_activity_logs, name='admin_activity_logs'),
]
