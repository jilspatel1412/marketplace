from django.core.mail import send_mail
from django.conf import settings


def create_notification(user, notif_type, title, message, link=''):
    try:
        from .models import Notification
        Notification.objects.create(
            user=user, type=notif_type, title=title, message=message, link=link
        )
    except Exception:
        pass  # Don't let notification failures crash the calling view


def send_email(recipient: str, subject: str, body: str, html: str = None) -> bool:
    """Send an email (optionally HTML) and log it."""
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient],
            fail_silently=False,
            html_message=html,
        )
        status_val = 'sent'
    except Exception:
        status_val = 'failed'

    try:
        from .models import EmailLog
        EmailLog.objects.create(recipient=recipient, subject=subject, body=body, status=status_val)
    except Exception:
        pass  # Don't crash if logging fails

    return status_val == 'sent'
