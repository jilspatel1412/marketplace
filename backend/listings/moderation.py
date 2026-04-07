"""Content moderation utilities for listings."""
from django.conf import settings


def check_listing(listing):
    """Check a listing for banned content or suspicious pricing.

    Returns (is_flagged: bool, reason: str).
    """
    text = f'{listing.title} {listing.description}'.lower()

    for keyword in getattr(settings, 'BANNED_KEYWORDS', []):
        if keyword.lower() in text:
            return True, f'Banned keyword detected: "{keyword}"'

    threshold = getattr(settings, 'SUSPICIOUS_PRICE_THRESHOLD', 1)
    if listing.price < threshold:
        return True, f'Suspiciously low price: ${listing.price}'

    return False, ''
