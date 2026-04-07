import io
import logging
import uuid
import pyotp
import qrcode
import base64
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone

logger = logging.getLogger(__name__)
from rest_framework import serializers as drf_serializers, status, generics
from rest_framework.decorators import api_view, permission_classes, parser_classes, throttle_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from listings.throttles import AuthRateThrottle
from .activity import log_activity

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
        # If 2FA is enabled, don't issue tokens yet — require TOTP code
        if self.user.is_2fa_enabled:
            raise drf_serializers.ValidationError({
                '2fa_required': True,
                'message': 'Two-factor authentication code required.',
            })
        return data


class VerifiedTokenObtainPairView(TokenObtainPairView):
    serializer_class = VerifiedTokenObtainPairSerializer
    throttle_classes = [AuthRateThrottle]

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            username = request.data.get('username', '')
            try:
                user = User.objects.get(username=username)
                log_activity(user, 'login', request)
            except User.DoesNotExist:
                pass
        return response

User = get_user_model()


def _send_verification_email(user):
    from notifications.emails import verify_email as verify_email_html
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={user.verification_token}"
    send_email(
        recipient=user.email,
        subject='Verify your SellIt account',
        body=f'Hi {user.username},\n\nVerify your email by visiting:\n{verify_url}\n\nSellIt Team',
        html=verify_email_html(user.username, verify_url),
    )


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthRateThrottle])
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

    try:
        user = serializer.save()
    except Exception as e:
        logger.exception('Registration save failed')
        return Response({'error': f'Registration failed: {type(e).__name__}: {e}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    log_activity(user, 'register', request)

    try:
        _send_verification_email(user)
        logger.info('Verification email sent to %s', user.email)
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
        from notifications.emails import password_reset as password_reset_html
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={user.password_reset_token}"
        send_email(
            recipient=user.email,
            subject='Reset your SellIt password',
            body=f'Hi {user.username},\n\nClick to reset your password:\n{reset_url}\n\nThis link is valid for 24 hours.\n\nThanks,\nSellIt Team',
            html=password_reset_html(user.username, reset_url),
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
        log_activity(user, 'profile_update', request)
        serializer.instance.refresh_from_db()
        return Response(UserSerializer(serializer.instance, context={'request': request}).data)


# ─── Block / Unblock Users ──────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def block_user(request, user_id):
    from .models import BlockedUser
    if user_id == request.user.id:
        return Response({'error': 'You cannot block yourself.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        target = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    _, created = BlockedUser.objects.get_or_create(blocker=request.user, blocked=target)
    if not created:
        return Response({'error': 'User is already blocked.'}, status=status.HTTP_400_BAD_REQUEST)
    return Response({'message': f'{target.username} has been blocked.'})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def unblock_user(request, user_id):
    from .models import BlockedUser
    deleted, _ = BlockedUser.objects.filter(blocker=request.user, blocked_id=user_id).delete()
    if not deleted:
        return Response({'error': 'User is not blocked.'}, status=status.HTTP_400_BAD_REQUEST)
    return Response({'message': 'User unblocked.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def blocked_list(request):
    from .models import BlockedUser
    blocked = BlockedUser.objects.filter(blocker=request.user).select_related('blocked')
    data = [
        {'id': b.blocked.id, 'username': b.blocked.username, 'blocked_at': b.created_at}
        for b in blocked
    ]
    return Response(data)


# ─── Buyer Reputation ────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def buyer_reputation(request, user_id):
    """Compute buyer reputation based on order and dispute history."""
    try:
        buyer = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    from orders.models import Order, Dispute
    total_orders = Order.objects.filter(buyer=buyer, status__in=('paid', 'shipped', 'delivered')).count()
    total_disputes = Dispute.objects.filter(opened_by=buyer).count()
    disputes_lost = Dispute.objects.filter(
        opened_by=buyer, status='resolved_no_refund'
    ).count()

    if total_orders == 0:
        score = 'new'
    elif total_disputes == 0:
        score = 'excellent'
    elif (total_disputes / total_orders) < 0.1:
        score = 'good'
    elif (total_disputes / total_orders) < 0.25:
        score = 'fair'
    else:
        score = 'poor'

    return Response({
        'user_id': buyer.id,
        'username': buyer.username,
        'total_orders': total_orders,
        'total_disputes': total_disputes,
        'disputes_lost': disputes_lost,
        'reputation': score,
    })


# ─── Admin: Activity Logs ────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_activity_logs(request):
    if not _is_admin(request.user):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
    from .models import ActivityLog
    user_id = request.query_params.get('user_id')
    qs = ActivityLog.objects.select_related('user')
    if user_id:
        qs = qs.filter(user_id=user_id)
    qs = qs.order_by('-created_at')[:100]
    data = [
        {
            'id': log.id,
            'user_id': log.user_id,
            'username': log.user.username,
            'action': log.action,
            'ip_address': log.ip_address,
            'user_agent': log.user_agent[:100],
            'created_at': log.created_at.isoformat(),
        }
        for log in qs
    ]
    return Response(data)


# ─── Two-Factor Authentication ───────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def setup_2fa(request):
    """Generate a new TOTP secret and return a QR code for the authenticator app."""
    user = request.user
    if user.is_2fa_enabled:
        return Response({'error': '2FA is already enabled.'}, status=status.HTTP_400_BAD_REQUEST)

    secret = pyotp.random_base32()
    user.totp_secret = secret
    user.save(update_fields=['totp_secret'])

    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(name=user.email, issuer_name='SellIt')

    # Generate QR code as base64 image
    qr = qrcode.make(provisioning_uri)
    buf = io.BytesIO()
    qr.save(buf, format='PNG')
    qr_b64 = base64.b64encode(buf.getvalue()).decode()

    return Response({
        'secret': secret,
        'qr_code': f'data:image/png;base64,{qr_b64}',
        'provisioning_uri': provisioning_uri,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_2fa_setup(request):
    """Verify the TOTP code to confirm 2FA setup."""
    user = request.user
    code = request.data.get('code', '').strip()
    if not code:
        return Response({'error': 'TOTP code is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if not user.totp_secret:
        return Response({'error': 'Run setup first.'}, status=status.HTTP_400_BAD_REQUEST)

    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(code, valid_window=1):
        return Response({'error': 'Invalid code. Please try again.'}, status=status.HTTP_400_BAD_REQUEST)

    user.is_2fa_enabled = True
    user.save(update_fields=['is_2fa_enabled'])
    log_activity(user, '2fa_enabled', request)
    return Response({'message': '2FA enabled successfully.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def disable_2fa(request):
    """Disable 2FA (requires current TOTP code for security)."""
    user = request.user
    if not user.is_2fa_enabled:
        return Response({'error': '2FA is not enabled.'}, status=status.HTTP_400_BAD_REQUEST)

    code = request.data.get('code', '').strip()
    if not code:
        return Response({'error': 'TOTP code is required to disable 2FA.'}, status=status.HTTP_400_BAD_REQUEST)

    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(code, valid_window=1):
        return Response({'error': 'Invalid code.'}, status=status.HTTP_400_BAD_REQUEST)

    user.is_2fa_enabled = False
    user.totp_secret = ''
    user.save(update_fields=['is_2fa_enabled', 'totp_secret'])
    log_activity(user, '2fa_disabled', request)
    return Response({'message': '2FA disabled.'})


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthRateThrottle])
def login_2fa(request):
    """Complete login with 2FA code after credentials were verified."""
    from django.contrib.auth import authenticate
    username = request.data.get('username', '')
    password = request.data.get('password', '')
    code = request.data.get('code', '').strip()

    if not all([username, password, code]):
        return Response({'error': 'Username, password, and 2FA code are required.'}, status=status.HTTP_400_BAD_REQUEST)

    user = authenticate(username=username, password=password)
    if not user:
        return Response({'error': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)
    if not user.is_verified:
        return Response({'error': 'Please verify your email first.'}, status=status.HTTP_403_FORBIDDEN)
    if not user.is_2fa_enabled or not user.totp_secret:
        return Response({'error': '2FA is not enabled for this account.'}, status=status.HTTP_400_BAD_REQUEST)

    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(code, valid_window=1):
        return Response({'error': 'Invalid 2FA code.'}, status=status.HTTP_400_BAD_REQUEST)

    # Issue JWT tokens
    refresh = RefreshToken.for_user(user)
    log_activity(user, 'login', request)
    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    })
