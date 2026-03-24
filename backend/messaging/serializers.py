from rest_framework import serializers
from .models import Message


class MessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source='sender.username', read_only=True)
    recipient_username = serializers.CharField(source='recipient.username', read_only=True)
    listing_title = serializers.CharField(source='listing.title', read_only=True)

    class Meta:
        model = Message
        fields = (
            'id', 'sender', 'sender_username', 'recipient', 'recipient_username',
            'listing', 'listing_title', 'body', 'is_read', 'created_at'
        )
        read_only_fields = ('id', 'sender', 'created_at', 'is_read')
