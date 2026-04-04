from django.contrib.auth import get_user_model
from django.db.models import Q, Max, OuterRef, Subquery
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Message
from .serializers import MessageSerializer

User = get_user_model()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def thread_list(request):
    """Return the latest message per conversation partner."""
    me = request.user

    # Find all distinct partner IDs in one pass
    sent_to = set(Message.objects.filter(sender=me).values_list('recipient_id', flat=True))
    received_from = set(Message.objects.filter(recipient=me).values_list('sender_id', flat=True))
    partner_ids = sent_to | received_from

    if not partner_ids:
        return Response([])

    # Batch-fetch all partner users in one query
    partners = {u.pk: u for u in User.objects.filter(pk__in=partner_ids)}

    # Batch-fetch unread counts per sender
    from django.db.models import Count
    unread_counts = dict(
        Message.objects.filter(sender_id__in=partner_ids, recipient=me, is_read=False)
        .values_list('sender_id').annotate(c=Count('id')).values_list('sender_id', 'c')
    )

    threads = []
    for pid in partner_ids:
        latest = (
            Message.objects.filter(
                Q(sender=me, recipient_id=pid) | Q(sender_id=pid, recipient=me)
            )
            .order_by('-created_at')
            .first()
        )
        if latest and pid in partners:
            threads.append({
                'partner_id': pid,
                'partner_username': partners[pid].username,
                'last_message': MessageSerializer(latest).data,
                'unread': unread_counts.get(pid, 0),
            })

    threads.sort(key=lambda t: t['last_message']['created_at'], reverse=True)
    return Response(threads)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def thread_detail(request, partner_id):
    """GET: fetch all messages with partner. POST: send a message."""
    me = request.user

    try:
        partner = User.objects.get(pk=partner_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    if me.id == partner_id:
        return Response({'error': 'You cannot message yourself.'}, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'GET':
        messages = Message.objects.filter(
            Q(sender=me, recipient=partner) | Q(sender=partner, recipient=me)
        ).select_related('sender', 'recipient', 'listing')

        # Mark incoming as read
        Message.objects.filter(sender=partner, recipient=me, is_read=False).update(is_read=True)

        return Response(MessageSerializer(messages, many=True).data)

    # POST — send message
    body = request.data.get('body', '').strip()
    if not body:
        return Response({'error': 'Message body is required.'}, status=status.HTTP_400_BAD_REQUEST)

    listing_id = request.data.get('listing_id')
    listing = None
    if listing_id:
        from listings.models import Listing
        try:
            listing = Listing.objects.get(pk=listing_id)
        except Listing.DoesNotExist:
            pass

    msg = Message.objects.create(sender=me, recipient=partner, body=body, listing=listing)
    return Response(MessageSerializer(msg).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def unread_count(request):
    count = Message.objects.filter(recipient=request.user, is_read=False).count()
    return Response({'unread': count})
