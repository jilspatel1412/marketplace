from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_add_address_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='is_verified_seller',
            field=models.BooleanField(default=False),
        ),
    ]
