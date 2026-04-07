from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'phone_number', 'password', 'password2', 'role',
                  'address_line1', 'city', 'state_province', 'postal_code', 'country')
        extra_kwargs = {
            'email': {'required': True},
            'phone_number': {'required': True},
        }

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({'password': 'Passwords do not match.'})
        if User.objects.filter(email=attrs['email']).exists():
            raise serializers.ValidationError({'email': 'Email already registered.'})
        phone = attrs.get('phone_number', '').strip()
        if not phone:
            raise serializers.ValidationError({'phone_number': 'Phone number is required.'})
        if User.objects.filter(phone_number=phone).exists():
            raise serializers.ValidationError({'phone_number': 'Phone number already registered.'})
        attrs['phone_number'] = phone
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'phone_number', 'role', 'is_verified', 'is_verified_seller',
                  'is_2fa_enabled', 'bio', 'avatar_url',
                  'address_line1', 'city', 'state_province', 'postal_code', 'country', 'date_joined')
        read_only_fields = ('id', 'email', 'role', 'is_verified', 'is_verified_seller', 'is_2fa_enabled', 'date_joined')

    def get_avatar_url(self, obj):
        request = self.context.get('request')
        if obj.avatar and hasattr(obj.avatar, 'url'):
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('username', 'bio', 'avatar', 'phone_number',
                  'address_line1', 'city', 'state_province', 'postal_code', 'country')


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.UUIDField()
    password = serializers.CharField(write_only=True, validators=[validate_password])
