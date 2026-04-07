"""Auto-release escrow for delivered orders past the protection period.

Run periodically via cron or a scheduler:
    python manage.py release_escrow
"""
from django.core.management.base import BaseCommand
from django.utils import timezone

from notifications.utils import create_notification
from orders.models import Order


class Command(BaseCommand):
    help = 'Release escrow for orders past the purchase protection period'

    def handle(self, *args, **options):
        now = timezone.now()
        orders = Order.objects.filter(
            escrow_status='held',
            status='delivered',
            protection_expires_at__isnull=False,
            protection_expires_at__lte=now,
        ).select_related('listing', 'buyer', 'seller')

        released = 0
        for order in orders:
            # Skip if there's an active dispute
            if order.disputes.filter(status__in=('open', 'under_review')).exists():
                continue

            order.escrow_status = 'released'
            order.save(update_fields=['escrow_status'])
            released += 1

            title = order.listing.title if order.listing else f'Order #{order.id}'
            create_notification(
                order.seller, 'escrow_released',
                f'Funds released for "{title}"',
                f'${order.total_amount} has been released to your account.',
                '/seller/orders'
            )
            create_notification(
                order.buyer, 'escrow_released',
                f'Purchase protection ended for "{title}"',
                'The protection period has ended and funds have been released to the seller.',
                '/buyer/orders'
            )

        self.stdout.write(self.style.SUCCESS(f'Released escrow for {released} order(s).'))
