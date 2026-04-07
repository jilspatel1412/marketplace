import stripe
from django.core.management.base import BaseCommand
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from listings.models import Listing, Bid
from orders.models import Order, Payment
from notifications.utils import send_email, create_notification


class Command(BaseCommand):
    help = 'Auto-settle expired auctions that have at least one bid'

    def handle(self, *args, **options):
        expired = Listing.objects.filter(
            status='active',
            auction_end_time__isnull=False,
            auction_end_time__lt=timezone.now(),
        ).select_related('seller')

        settled = 0
        for listing in expired:
            top_bid = Bid.objects.filter(listing=listing).order_by('-amount').first()
            if not top_bid:
                # No bids — just close the auction
                listing.status = 'closed'
                listing.save()
                self.stdout.write(f'Closed no-bid auction: {listing.title}')
                continue

            try:
                _settle_auction(listing, top_bid)
                settled += 1
                self.stdout.write(self.style.SUCCESS(f'Settled: {listing.title} → {top_bid.bidder.username} (${top_bid.amount})'))
            except Exception as e:
                self.stderr.write(f'Failed to settle {listing.title}: {e}')

        self.stdout.write(self.style.SUCCESS(f'Done. {settled} auction(s) settled.'))


def _settle_auction(listing, top_bid):
    """Create order + PaymentIntent for an expired auction. Called by management command and lazy view trigger."""
    with transaction.atomic():
        # Lock and re-check to prevent duplicate settlements
        listing = Listing.objects.select_for_update().get(pk=listing.pk)
        if listing.status != 'active':
            return None  # Already settled

        listing.status = 'sold'
        listing.save()

        order = Order.objects.create(
            listing=listing,
            buyer=top_bid.bidder,
            seller=listing.seller,
            total_amount=top_bid.amount,
            status='pending_payment',
        )

        stripe.api_key = settings.STRIPE_SECRET_KEY
        if settings.STRIPE_SECRET_KEY:
            try:
                intent = stripe.PaymentIntent.create(
                    amount=int(top_bid.amount * 100),
                    currency='cad',
                    metadata={'order_id': str(order.id)},
                )
                Payment.objects.create(
                    order=order,
                    stripe_payment_intent_id=intent.id,
                    amount=top_bid.amount,
                    status='pending',
                )
            except Exception:
                import logging
                logging.getLogger(__name__).exception('Stripe PaymentIntent failed for auction order %s', order.id)

        from notifications.emails import auction_won as auction_won_html
        from notifications.emails import auction_ended_seller as auction_ended_html
        from django.conf import settings as django_settings
        frontend_url = getattr(django_settings, 'FRONTEND_URL', 'http://localhost:5173')
        send_email(
            recipient=top_bid.bidder.email,
            subject=f'You won the auction for "{listing.title}"!',
            body=(
                f'Hi {top_bid.bidder.username},\n\n'
                f'The auction for "{listing.title}" has ended and you won with a bid of ${top_bid.amount}!\n\n'
                f'Please log in to complete your payment.\n\nSellIt Team'
            ),
            html=auction_won_html(top_bid.bidder.username, listing.title, top_bid.amount, frontend_url),
        )
        send_email(
            recipient=listing.seller.email,
            subject=f'Your auction for "{listing.title}" ended',
            body=(
                f'Hi {listing.seller.username},\n\n'
                f'Your auction for "{listing.title}" has ended. '
                f'{top_bid.bidder.username} won with a bid of ${top_bid.amount}.\n\n'
                f'SellIt Team'
            ),
            html=auction_ended_html(listing.seller.username, listing.title, top_bid.bidder.username, top_bid.amount, frontend_url),
        )

        create_notification(
            top_bid.bidder, 'auction_won',
            f'You won "{listing.title}"!',
            f'Your bid of ${top_bid.amount} won the auction. Complete your payment.',
            f'/buyer/orders'
        )
        create_notification(
            listing.seller, 'order_paid',
            f'Auction ended: "{listing.title}"',
            f'{top_bid.bidder.username} won with ${top_bid.amount}.',
            f'/seller/orders'
        )

    return order
