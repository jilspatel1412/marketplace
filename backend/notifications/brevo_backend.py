"""Custom Django email backend using Brevo (Sendinblue) HTTP API.

Uses HTTPS (port 443) instead of SMTP, so it works on hosts like Render
that block outbound SMTP connections.
"""
import json
import logging
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend
import requests

logger = logging.getLogger(__name__)

BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'


class BrevoEmailBackend(BaseEmailBackend):
    def __init__(self, api_key=None, **kwargs):
        super().__init__(**kwargs)
        self.api_key = api_key or getattr(settings, 'BREVO_API_KEY', '')

    def send_messages(self, email_messages):
        if not self.api_key:
            logger.warning('BREVO_API_KEY not set — emails will not be sent.')
            return 0

        sent = 0
        for msg in email_messages:
            try:
                payload = {
                    'sender': {'email': msg.from_email},
                    'to': [{'email': addr} for addr in msg.to],
                    'subject': msg.subject,
                    'textContent': msg.body,
                }
                # Include HTML if present
                if msg.alternatives:
                    for content, mimetype in msg.alternatives:
                        if mimetype == 'text/html':
                            payload['htmlContent'] = content
                            break

                resp = requests.post(
                    BREVO_API_URL,
                    headers={
                        'api-key': self.api_key,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    data=json.dumps(payload),
                    timeout=10,
                )

                if resp.status_code in (200, 201):
                    sent += 1
                else:
                    logger.error('Brevo API error %s: %s', resp.status_code, resp.text)
            except Exception:
                logger.exception('Failed to send email via Brevo')
                if not self.fail_silently:
                    raise
        return sent
