from django.db import migrations


def seed_categories(apps, schema_editor):
    Category = apps.get_model('listings', 'Category')
    categories = [
        ('Electronics', 'electronics'),
        ('Clothing & Apparel', 'clothing-apparel'),
        ('Home & Garden', 'home-garden'),
        ('Sports & Outdoors', 'sports-outdoors'),
        ('Books & Media', 'books-media'),
        ('Toys & Games', 'toys-games'),
        ('Vehicles', 'vehicles'),
        ('Furniture', 'furniture'),
        ('Jewelry & Accessories', 'jewelry-accessories'),
        ('Health & Beauty', 'health-beauty'),
        ('Collectibles & Art', 'collectibles-art'),
        ('Musical Instruments', 'musical-instruments'),
        ('Pet Supplies', 'pet-supplies'),
        ('Baby & Kids', 'baby-kids'),
        ('Tools & Hardware', 'tools-hardware'),
        ('Other', 'other'),
    ]
    for name, slug in categories:
        Category.objects.get_or_create(name=name, defaults={'slug': slug})


def reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('listings', '0004_add_search_alert'),
    ]

    operations = [
        migrations.RunPython(seed_categories, reverse),
    ]
