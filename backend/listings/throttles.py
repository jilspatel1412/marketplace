"""Custom DRF throttle classes for rate limiting."""
from rest_framework.throttling import SimpleRateThrottle


class AuthRateThrottle(SimpleRateThrottle):
    """Throttle login/register by IP — 5 attempts per minute."""
    scope = 'auth'

    def get_cache_key(self, request, view):
        return self.cache_format % {
            'scope': self.scope,
            'ident': self.get_ident(request),
        }


class ListingCreateThrottle(SimpleRateThrottle):
    """Throttle listing creation per user — 10 per hour."""
    scope = 'listing_create'

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            ident = request.user.pk
        else:
            ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident,
        }
