#!/bin/sh
set -eu

# Schema changes and admin assets must be ready before Gunicorn accepts traffic.
# Data imports are deliberately excluded: production data migration is an
# explicit, operator-controlled operation documented in POSTGRES_MIGRATION.md.
python manage.py migrate --noinput
python manage.py collectstatic --noinput

exec "$@"

