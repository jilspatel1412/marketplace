#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --noinput
python manage.py migrate
python manage.py create_admin

# One-time: delete all users except ADMINJILS and mark as verified
python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
User.objects.exclude(username='ADMINJILS').delete()
u = User.objects.get(username='ADMINJILS')
u.is_verified = True
u.save()
print('Cleanup done. Remaining users:', list(User.objects.values_list('username', flat=True)))
"
