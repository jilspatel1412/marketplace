import logging
import uuid
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone

logger = logging.getLogger(__name__)
from rest_framework import serializers as drf_serializers, status, generics
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from notifications.utils import send_email
from .serializers import (
    RegisterSerializer, UserSerializer, UserUpdateSerializer,
    PasswordResetRequestSerializer, PasswordResetConfirmSerializer
)


class VerifiedTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        if not self.user.is_verified:
            raise drf_serializers.ValidationError(
                'Please verify your email before logging in. Check your inbox for the verification link.'
            )
        return data


class VerifiedTokenObtainPairView(TokenObtainPairView):
    serializer_class = VerifiedTokenObtainPairSerializer

User = get_user_model()


def _send_verification_email(user):
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={user.verification_token}"
    send_email(
        recipient=user.email,
        subject='Verify your SellIt account',
        body=f'Hi {user.username},\n\nVerify your email by visiting:\n{verify_url}\n\nSellIt Team',
        html=f'''
<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;border:1px solid #eee;border-radius:8px;overflow:hidden">
  <div style="background:#e03d00;padding:24px;text-align:center">
    <span style="color:#fff;font-size:26px;font-weight:800;letter-spacing:-1px">SellIt</span>
  </div>
  <div style="padding:32px">
    <h2 style="margin:0 0 12px;color:#0c0c0e">Verify your email</h2>
    <p style="color:#555;line-height:1.6;margin:0 0 28px">
      Hi <strong>{user.username}</strong>,<br>
      Click the button below to verify your email address and activate your account.
    </p>
    <div style="text-align:center;margin-bottom:28px">
      <a href="{verify_url}"
         style="background:#e03d00;color:#fff;padding:14px 36px;border-radius:8px;
                text-decoration:none;font-weight:700;font-size:16px;display:inline-block">
        Verify Email Address
      </a>
    </div>
    <p style="color:#999;font-size:12px;margin:0">
      Button not working? Copy and paste this link into your browser:<br>
      <a href="{verify_url}" style="color:#e03d00;word-break:break-all">{verify_url}</a>
    </p>
  </div>
</div>'''
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    email = request.data.get('email', '').strip()

    # If an unverified user with this email exists, resend verification
    if email:
        try:
            existing = User.objects.get(email=email, is_verified=False)
            if not existing.verification_token:
                existing.verification_token = uuid.uuid4()
                existing.save()
            try:
                _send_verification_email(existing)
            except Exception:
                logger.exception('Failed to resend verification email to %s', email)
            return Response({
                'message': 'A verification email has been sent. Please check your inbox.',
                'requires_verification': True,
            }, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            pass

    serializer = RegisterSerializer(data=request.data)
    if not serializer.is_valid():
        logger.warning('Registration validation failed: %s', serializer.errors)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user = serializer.save()

    try:
        _send_verification_email(user)
    except Exception:
        logger.exception('Failed to send verification email to %s', user.email)

    return Response({
        'message': 'Registration successful! Please check your email to verify your account.',
        'requires_verification': True,
    }, status=status.HTTP_201_CREATED)




@api_view(['POST'])
@permission_classes([AllowAny])
def resend_verification(request):
    email = request.data.get('email', '').strip()
    if not email:
        return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        user = User.objects.get(email=email, is_verified=False)
        if not user.verification_token:
            user.verification_token = uuid.uuid4()
            user.save()
        _send_verification_email(user)
    except User.DoesNotExist:
        pass  # Don't reveal whether the email exists
    return Response({'message': 'If that email is awaiting verification, a new link has been sent.'})


@api_view(['GET'])
@permission_classes([AllowAny])
def verify_email(request):
    token = request.query_params.get('token')
    if not token:
        return Response({'error': 'Token is required.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        user = User.objects.get(verification_token=token)
    except Exception:
        return Response({'error': 'Invalid or expired token.'}, status=status.HTTP_400_BAD_REQUEST)

    user.is_verified = True
    user.verification_token = None
    user.save()
    return Response({'message': 'Email verified successfully. You can now log in.'})


@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_request(request):
    serializer = PasswordResetRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data['email']
    try:
        user = User.objects.get(email=email)
        user.password_reset_token = uuid.uuid4()
        user.password_reset_requested_at = timezone.now()
        user.save()
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={user.password_reset_token}"
        send_email(
            recipient=user.email,
            subject='Reset your SellIt password',
            body=f'Hi {user.username},\n\nClick to reset your password:\n{reset_url}\n\nThis link is valid for 24 hours.\n\nThanks,\nSellIt Team'
        )
    except User.DoesNotExist:
        pass  # Don't reveal if email exists
    return Response({'message': 'If that email is registered, you will receive a reset link.'})


@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_confirm(request):
    serializer = PasswordResetConfirmSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    token = serializer.validated_data['token']
    password = serializer.validated_data['password']
    try:
        user = User.objects.get(password_reset_token=token)
    except User.DoesNotExist:
        return Response({'error': 'Invalid or expired token.'}, status=status.HTTP_400_BAD_REQUEST)

    # Check 24-hour expiry
    if user.password_reset_requested_at and (timezone.now() - user.password_reset_requested_at).total_seconds() > 86400:
        user.password_reset_token = None
        user.save()
        return Response({'error': 'This reset link has expired. Please request a new one.'}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(password)
    user.password_reset_token = None
    user.password_reset_requested_at = None
    user.save()
    return Response({'message': 'Password reset successful. You can now log in.'})


@api_view(['GET'])
@permission_classes([AllowAny])
def seller_profile(request, username):
    try:
        seller = User.objects.get(username=username, role='seller')
    except User.DoesNotExist:
        return Response({'error': 'Seller not found.'}, status=status.HTTP_404_NOT_FOUND)

    from django.db.models import Avg
    from listings.models import Listing
    from listings.serializers import ListingSerializer
    from orders.models import Review
    from orders.serializers import ReviewSerializer

    active_listings = (
        Listing.objects.filter(seller=seller, status='active')
        .prefetch_related('images').select_related('category')[:12]
    )
    reviews_qs = Review.objects.filter(seller=seller).select_related('reviewer').order_by('-created_at')[:20]
    avg_data = Review.objects.filter(seller=seller).aggregate(avg=Avg('rating'))
    review_count = Review.objects.filter(seller=seller).count()

    return Response({
        'id': seller.id,
        'username': seller.username,
        'bio': seller.bio,
        'is_verified': seller.is_verified,
        'date_joined': seller.date_joined,
        'avg_rating': round(avg_data['avg'], 1) if avg_data['avg'] else None,
        'review_count': review_count,
        'listings': ListingSerializer(active_listings, many=True, context={'request': request}).data,
        'reviews': ReviewSerializer(reviews_qs, many=True).data,
    })


def _is_admin(user):
    return user.is_staff or user.role == 'admin'


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_users(request):
    if not _is_admin(request.user):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
    users = User.objects.all().order_by('-date_joined')
    data = []
    for u in users:
        data.append({
            'id': u.id,
            'username': u.username,
            'email': u.email,
            'role': u.role,
            'is_verified': u.is_verified,
            'is_active': u.is_active,
            'date_joined': u.date_joined,
        })
    return Response(data)


@api_view(['DELETE', 'PATCH'])
@permission_classes([IsAuthenticated])
def admin_user_detail(request, user_id):
    if not _is_admin(request.user):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
    try:
        target = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    if target.pk == request.user.pk:
        return Response({'error': 'You cannot modify your own account here.'}, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'DELETE':
        target.delete()
        return Response({'message': 'User deleted.'}, status=status.HTTP_204_NO_CONTENT)

    # PATCH — toggle active, verify, change role
    if 'is_active' in request.data:
        target.is_active = request.data['is_active']
    if 'is_verified' in request.data:
        target.is_verified = request.data['is_verified']
    if 'role' in request.data and request.data['role'] in ('buyer', 'seller', 'admin'):
        target.role = request.data['role']
    target.save()
    return Response({
        'id': target.id, 'username': target.username, 'email': target.email,
        'role': target.role, 'is_verified': target.is_verified, 'is_active': target.is_active,
        'date_joined': target.date_joined,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_listings(request):
    if not _is_admin(request.user):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
    from listings.models import Listing
    listings = Listing.objects.select_related('seller', 'category').order_by('-created_at')
    data = []
    for l in listings:
        data.append({
            'id': l.id,
            'title': l.title,
            'price': str(l.price),
            'status': l.status,
            'seller_username': l.seller.username,
            'category': l.category.name if l.category else None,
            'created_at': l.created_at,
        })
    return Response(data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def admin_listing_delete(request, listing_id):
    if not _is_admin(request.user):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
    from listings.models import Listing
    try:
        listing = Listing.objects.get(pk=listing_id)
    except Listing.DoesNotExist:
        return Response({'error': 'Listing not found.'}, status=status.HTTP_404_NOT_FOUND)
    listing.delete()
    return Response({'message': 'Listing deleted.'}, status=status.HTTP_204_NO_CONTENT)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def me(request):
    user = request.user
    if request.method == 'GET':
        serializer = UserSerializer(user, context={'request': request})
        return Response(serializer.data)
    elif request.method == 'PATCH':
        serializer = UserUpdateSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        serializer.instance.refresh_from_db()
        return Response(UserSerializer(serializer.instance, context={'request': request}).data)
