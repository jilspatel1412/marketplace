import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Create the support admin account from env vars'

    def handle(self, *args, **options):
        username = os.environ.get('ADMIN_USERNAME', '').strip()
        email = os.environ.get('ADMIN_EMAIL', '').strip()
        password = os.environ.get('ADMIN_PASSWORD', '').strip()

        if not all([username, email, password]):
            self.stdout.write('ADMIN_USERNAME, ADMIN_EMAIL, or ADMIN_PASSWORD not set — skipping.')
            return

        if User.objects.filter(username=username).exists():
            user = User.objects.get(username=username)
            user.role = 'admin'
            user.is_staff = True
            user.is_verified = True
            user.save()
            self.stdout.write(f'Admin user "{username}" already exists — ensured role=admin, is_staff=True.')
            return

        User.objects.create_user(
            username=username,
            email=email,
            password=password,
            role='admin',
            is_staff=True,
            is_verified=True,
        )
        self.stdout.write(f'Admin user "{username}" created successfully.')
