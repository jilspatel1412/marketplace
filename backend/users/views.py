import uuid
from django.conf import settings
from django.contrib.auth import get_user_model
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
        if not self.user.is_verified and not self.user.is_staff:
            raise drf_serializers.ValidationError(
                {'detail': 'Please verify your email before logging in.'}
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
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    _send_verification_email(user)
    return Response({'message': 'Registration successful. Please check your email to verify your account.'}, status=status.HTTP_201_CREATED)


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

    user.set_password(password)
    user.password_reset_token = None
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
