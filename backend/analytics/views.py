from django.db.models import Sum, Count
from django.db.models.functions import TruncWeek
from django.utils import timezone
from datetime import timedelta
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from listings.models import Listing, SearchLog
from orders.models import Order


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_trends(request):
    if request.user.role != 'seller':
        return Response({'error': 'Sellers only.'}, status=403)

    # Last 7 weeks of search trends
    since = timezone.now() - timedelta(weeks=7)
    trends = (
        SearchLog.objects.filter(created_at__gte=since)
        .values('keyword')
        .annotate(count=Count('keyword'))
        .order_by('-count')[:10]
    )

    # Weekly aggregation
    weekly = (
        SearchLog.objects.filter(created_at__gte=since)
        .annotate(week=TruncWeek('created_at'))
        .values('week')
        .annotate(count=Count('id'))
        .order_by('week')
    )

    return Response({
        'top_keywords': list(trends),
        'weekly_volume': [
            {'week': item['week'].strftime('%Y-%m-%d'), 'count': item['count']}
            for item in weekly
        ]
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def revenue(request):
    if request.user.role != 'seller':
        return Response({'error': 'Sellers only.'}, status=403)

    user = request.user
    paid_orders = Order.objects.filter(seller=user, status='paid')
    total_revenue = paid_orders.aggregate(total=Sum('total_amount'))['total'] or 0

    active_count = Listing.objects.filter(seller=user, status='active').count()
    sold_count = Listing.objects.filter(seller=user, status='sold').count()
    draft_count = Listing.objects.filter(seller=user, status='draft').count()

    recent_orders = paid_orders.select_related('listing', 'buyer').order_by('-created_at')[:5]
    orders_data = [
        {
            'id': o.id,
            'listing_title': o.listing.title if o.listing else 'Deleted',
            'buyer': o.buyer.username,
            'amount': str(o.total_amount),
            'date': o.created_at.strftime('%Y-%m-%d'),
        }
        for o in recent_orders
    ]

    return Response({
        'total_revenue': str(total_revenue),
        'active_listings': active_count,
        'sold_listings': sold_count,
        'draft_listings': draft_count,
        'recent_orders': orders_data,
    })
