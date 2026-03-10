from django.db import models


class EmailLog(models.Model):
    STATUS_CHOICES = [('sent', 'Sent'), ('failed', 'Failed')]
    recipient = models.EmailField()
    subject = models.CharField(max_length=255)
    body = models.TextField(blank=True, default='')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='sent')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'email_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.subject} → {self.recipient} ({self.status})'
