from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0001_add_shipping_review'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Dispute',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('reason', models.CharField(choices=[('item_not_received', 'Item Not Received'), ('item_not_as_described', 'Item Not as Described'), ('damaged', 'Item Arrived Damaged'), ('wrong_item', 'Wrong Item Sent'), ('other', 'Other')], max_length=30)),
                ('description', models.TextField()),
                ('status', models.CharField(choices=[('open', 'Open'), ('under_review', 'Under Review'), ('resolved_refund', 'Resolved — Refund Issued'), ('resolved_no_refund', 'Resolved — No Refund'), ('closed', 'Closed')], default='open', max_length=25)),
                ('resolution', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('order', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='disputes', to='orders.order')),
                ('opened_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='disputes_opened', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'disputes',
                'ordering': ['-created_at'],
            },
        ),
    ]
