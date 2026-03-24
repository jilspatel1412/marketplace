from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0001_add_notification_model'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('type', models.CharField(choices=[
                    ('offer_received', 'Offer Received'), ('offer_accepted', 'Offer Accepted'),
                    ('offer_rejected', 'Offer Rejected'), ('outbid', 'Outbid'),
                    ('auction_won', 'Auction Won'), ('order_paid', 'Order Paid'),
                    ('order_shipped', 'Order Shipped'), ('order_delivered', 'Order Delivered'),
                    ('new_bid', 'New Bid'),
                ], max_length=20)),
                ('title', models.CharField(max_length=200)),
                ('message', models.TextField()),
                ('link', models.CharField(blank=True, default='', max_length=200)),
                ('is_read', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notifications', to=settings.AUTH_USER_MODEL)),
            ],
            options={'db_table': 'notifications', 'ordering': ['-created_at']},
        ),
    ]
