from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('listings', '0003_listingreport'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SearchAlert',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('label', models.CharField(max_length=200)),
                ('query', models.CharField(blank=True, default='', max_length=200)),
                ('condition', models.CharField(blank=True, default='', max_length=15)),
                ('max_price', models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('category', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='listings.category')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='search_alerts', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'search_alerts',
                'ordering': ['-created_at'],
            },
        ),
    ]
