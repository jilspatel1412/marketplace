from django.contrib import admin
from .models import EmailLog


@admin.register(EmailLog)
class EmailLogAdmin(admin.ModelAdmin):
    list_display = ('subject', 'recipient', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('recipient', 'subject')
    ordering = ('-created_at',)
    readonly_fields = ('recipient', 'subject', 'body', 'status', 'created_at')
