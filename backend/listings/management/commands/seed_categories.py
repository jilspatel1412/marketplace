from django.core.management.base import BaseCommand
from listings.models import Category


CATEGORIES = [
    ('Electronics', 'electronics', '⚡'),
    ('Clothing', 'clothing', '👗'),
    ('Books', 'books', '📚'),
    ('Sports', 'sports', '⚽'),
    ('Home & Garden', 'home', '🏡'),
    ('Vehicles', 'vehicles', '🚗'),
    ('Music', 'music', '🎵'),
    ('Art', 'art', '🎨'),
    ('Toys & Games', 'toys', '🎮'),
    ('Jewelry', 'jewelry', '💎'),
    ('Cameras', 'cameras', '📷'),
    ('Other', 'other', '📦'),
]


class Command(BaseCommand):
    help = 'Seed default categories'

    def handle(self, *args, **kwargs):
        created = 0
        for name, slug, icon in CATEGORIES:
            obj, was_created = Category.objects.get_or_create(
                slug=slug,
                defaults={'name': name, 'icon': icon}
            )
            if was_created:
                created += 1
                self.stdout.write(f'  Created: {name}')
        self.stdout.write(self.style.SUCCESS(f'Done. {created} categories created.'))
