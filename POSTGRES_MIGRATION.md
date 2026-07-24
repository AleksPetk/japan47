# SQLite to PostgreSQL cutover

This is a one-time production operation. Keep the SQLite database and media
directory until PostgreSQL has been verified and backed up. Never run the site
against both databases while users can write data.

## 1. Freeze and back up the source

Stop Django, then create backups outside the repository:

```bash
mkdir -p "$HOME/japan47-backup"
cp -p backend/db.sqlite3 "$HOME/japan47-backup/db.sqlite3"
tar -C backend -czf "$HOME/japan47-backup/media.tar.gz" media
shasum -a 256 backend/db.sqlite3 "$HOME/japan47-backup/db.sqlite3"
find backend/media -type f -print0 | sort -z | xargs -0 shasum -a 256 > "$HOME/japan47-backup/media.sha256"
```

## 2. Export through Django's serialization layer

Using migrations plus `dumpdata`/`loaddata` keeps the transfer independent of
SQLite-specific SQL. Content types and permissions are excluded because Django
recreates them correctly for PostgreSQL.

```bash
cd backend
DJANGO_SETTINGS_MODULE=config.settings.development ../.venv/bin/python manage.py dumpdata \
  --natural-foreign --natural-primary \
  --exclude contenttypes --exclude auth.permission \
  --indent 2 \
  --output "$HOME/japan47-backup/japan47.fixture.json"
```

Keep the existing `DJANGO_SECRET_KEY` only if old sessions and JWTs must remain
valid. For this copied development project, deployment should use a new strong
key; accounts and records remain preserved, but users must sign in again.

## 3. Create the empty PostgreSQL schema

```bash
cp .env.example .env
# Set strong secrets, the real domain, and HTTPS origins in .env.
docker compose build
docker compose up -d db redis
docker compose run --rm backend python manage.py migrate --noinput
```

## 4. Load data exactly once

```bash
docker compose cp "$HOME/japan47-backup/japan47.fixture.json" backend:/tmp/japan47.fixture.json
docker compose exec backend python manage.py loaddata /tmp/japan47.fixture.json
```

Do not load into a database containing user data. If a cutover fails, preserve
the failed database for diagnosis and restore into a newly created database.

## 5. Copy media into the persistent volume

```bash
docker compose up -d backend
docker compose cp backend/media/. backend:/app/media/
```

The copy is additive and does not remove volume contents. Verify permissions by
uploading a new image through the application.

## 6. Verify before opening traffic

```bash
docker compose exec backend python manage.py check --deploy
docker compose exec backend python manage.py showmigrations --plan
docker compose exec backend python manage.py shell -c \
"from django.apps import apps; print({m._meta.label: m.objects.count() for m in apps.get_models() if m._meta.managed})"
docker compose exec backend python manage.py test
docker compose exec db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/japan47.dump
```

Compare the model counts with the source export, check all 91 original media
files, then verify admin login, JWT login/refresh, public pages, reviews, image
display, and a new upload. Only then direct the domain to the VPS.

## Rollback

Stop the new stack and point the previous application back at the untouched
SQLite database and media directory. Never copy partially migrated PostgreSQL
data back into SQLite.

