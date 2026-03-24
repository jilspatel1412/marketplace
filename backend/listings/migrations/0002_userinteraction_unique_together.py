from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('listings', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                ALTER TABLE user_interactions
                ADD CONSTRAINT user_interactions_unique_user_listing_type
                UNIQUE (user_id, listing_id, interaction_type);
            """,
            reverse_sql="""
                ALTER TABLE user_interactions
                DROP CONSTRAINT user_interactions_unique_user_listing_type;
            """,
        ),
    ]
