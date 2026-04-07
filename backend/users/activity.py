"""Utilities for logging user activity."""


def get_client_ip(request):
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def log_activity(user, action, request=None):
    """Create an activity log entry."""
    try:
        from .models import ActivityLog
        ip = get_client_ip(request) if request else None
        ua = request.META.get('HTTP_USER_AGENT', '')[:500] if request else ''
        ActivityLog.objects.create(user=user, action=action, ip_address=ip, user_agent=ua)
    except Exception:
        pass  # Never let logging crash the request
