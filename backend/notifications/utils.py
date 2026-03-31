from django.core.mail import send_mail
from django.conf import settings


def create_notification(user, notif_type, title, message, link=''):
    from .models import Notification
    Notification.objects.create(
        user=user, type=notif_type, title=title, message=message, link=link
    )


def send_email(recipient: str, subject: str, body: str, html: str = None) -> bool:
    """Send an email (optionally HTML) and log it."""
    from .models import EmailLog
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient],
            fail_silently=False,
            html_message=html,
        )
        EmailLog.objects.create(recipient=recipient, subject=subject, body=body, status='sent')
        return True
    except Exception:
        EmailLog.objects.create(recipient=recipient, subject=subject, body=body, status='failed')
        return False
