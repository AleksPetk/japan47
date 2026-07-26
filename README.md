# Japan 47

Japan 47 is an API-first community travel guide to Japan's 9 regions and 47 prefectures. Travelers can discover destinations, share recommendations and reviews, and keep a personal record of places they have saved or visited. Django provides a reusable JSON API for the React web application and future native clients such as SwiftUI.

## Main features

- Browse Japan by region, prefecture, destination, rating, and search filters.
- Community destination submissions, reviews, helpful votes, and contributor profiles.
- Saved places, visited places, collections, itineraries, badges, and travel progress.
- Moderated publishing workflow for new places and edits to published places.
- JWT registration and authentication with email verification and password recovery.
- Authenticated support requests with screenshot uploads and reference numbers.
- Django administration with moderation metrics, audit fields, private routing, and mandatory TOTP 2FA for staff.
- Versioned OpenAPI-documented endpoints designed for both web and future mobile clients.
- Responsive React interface with validated image uploads and optimized media variants.

## Tech stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, React Router, Vite, CSS, Vitest, Testing Library, ESLint |
| Backend | Python, Django 6, Django REST Framework, SimpleJWT, django-filter, drf-spectacular |
| Authentication | JWT access/refresh tokens, token blacklist, email verification, django-otp TOTP for admin |
| Data | SQLite for local development; PostgreSQL 17 and Redis for production |
| Media and email | Pillow, pillow-heif, persistent media storage, Resend transactional email |
| Deployment | Docker Compose, Gunicorn, Nginx |

## Screenshots

Portfolio screenshots are stored under `screenshots/`:

```text
screenshots/home.png
screenshots/regions.png
screenshots/region-detail.png
screenshots/prefecture-detail.png
screenshots/places.png
screenshots/place-detail.png
screenshots/search.png
screenshots/my-travel.png
screenshots/profile.png
screenshots/submit-place.png
screenshots/login.png
screenshots/register.png
screenshots/admin-dashboard.png
```

## Architecture

```text
Browser / SwiftUI
        │ JSON + multipart + JWT
        ▼
Nginx ──┬── /, React Router fallback → built React frontend
        ├── /api/, /j47-management/ → Django + Gunicorn
        ├── /media/                  → persistent uploads
        └── /static/                 → collected Django admin/static assets
                                         │
                                         ├── PostgreSQL (production data)
                                         └── Redis (shared cache)
```

The copied SQLite database and all existing uploads remain in `backend/`. Production uses an explicit, backed-up Django fixture cutover described in `POSTGRES_MIGRATION.md`; container restarts never import data. The public UI lives exclusively in React, while Django exposes JSON APIs and the internal Django admin.

## Installation

### Prerequisites

- Python 3.12 or newer (the migrated copy was verified with 3.14.0)
- Node 20.19+ or 22.12+ (verified with 24.18.0)
- npm (verified with 11.16.0)
- Docker with Compose for local full-stack testing and VPS deployment

PostgreSQL is supplied by Docker; local development defaults to the preserved SQLite database.

### Local development

From the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp backend/.env.example backend/.env
cd backend
python manage.py migrate
python manage.py check
python manage.py runserver 0.0.0.0:8000
```

In another terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev -- --host 0.0.0.0
```

Open `http://localhost:5173`. Vite proxies `/api`, `/media`, and `/static` to Django at `http://localhost:8000`; frontend code never hardcodes that host.

Admin: `http://localhost:8000/j47-management/`  
OpenAPI schema: `http://localhost:8000/api/schema/`  
Swagger UI: `http://localhost:8000/api/docs/`

### Test from an iPhone on the same Wi-Fi

Start Django and Vite with the two commands above. Django detects the Mac's
current private IPv4 address at startup and prints the phone-accessible
frontend and API URLs; Vite also prints its `Network` URL. Open
`http://<mac-ip>:5173` on the iPhone. The browser uses that same LAN origin for
API, media, and static requests, while Vite proxies them internally to Django.
No frontend environment value needs to change when the Mac receives a new IP.

Both devices must be connected to the same Wi-Fi, and macOS must allow incoming
connections for Python and Node if the firewall prompts. To find the address
manually, open **System Settings → Wi-Fi → Details → TCP/IP**, or run:

```bash
ipconfig getifaddr en0
```

The automatic server configuration does not assume that the Wi-Fi interface is
always `en0`; that command is only a quick manual check on most Macs. Local LAN
hosts and origins are added only by `config.settings.development`. Production
continues to use its explicit domain allowlists.

## Environment variables

Use `.env.example` for local Docker, `.env.production.example` for the VPS, or
`backend/.env.example` for local Django/runserver. Copy the appropriate template
to its ignored `.env` location and never commit a real `.env`.

| Variable | Purpose |
|---|---|
| `DJANGO_SECRET_KEY` | Required secret; production refuses the development placeholder |
| `DJANGO_ADMIN_PATH` | Normalized private admin prefix; local default `j47-management/` |
| `DEBUG` / `DJANGO_DEBUG` | Development debug toggle; production settings force `False` |
| `ALLOWED_HOSTS` / `DJANGO_ALLOWED_HOSTS` | Comma-separated accepted hosts |
| `DATABASE_URL` | SQLite or PostgreSQL URL |
| `CORS_ALLOWED_ORIGINS` | Comma-separated browser origins |
| `CSRF_TRUSTED_ORIGINS` | Trusted origins for admin/session tools |
| `FRONTEND_URL` | Public React origin used for emailed action links and frontend-owned assets |
| `BACKEND_URL` | Public Django origin for backend/API links; normally the same production domain |
| `VITE_PUBLIC_URL` | Public origin compiled into `sitemap.xml` and `robots.txt` |
| `JWT_ACCESS_MINUTES` / `JWT_REFRESH_DAYS` | JWT lifetimes |
| `API_ANON_THROTTLE` / `API_USER_THROTTLE` | General API rates |
| `AUTH_THROTTLE` | Sensitive authentication endpoint rate |
| `VERIFICATION_RESEND_THROTTLE` / `PASSWORD_RESET_THROTTLE` | Enumeration-safe email endpoint rates |
| `ACCOUNT_DELETION_THROTTLE` | Current-password verification and account-deletion attempt rate |
| `ACCOUNT_EMAIL_COOLDOWN_SECONDS` | Per-account delay between transactional emails |
| `SUPPORT_THROTTLE` | Per-user support endpoint rate, default `5/hour` |
| `SUPPORT_DUPLICATE_MINUTES` | Window used to reject repeated identical support requests |
| `REDIS_URL` / `CACHE_DEFAULT_TIMEOUT` | Shared production cache and default lifetime |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Docker PostgreSQL credentials |
| `VITE_API_BASE_URL` | Browser API prefix, normally `/api/v1` |
| `RESEND_API_KEY` | Secret Resend API key used only by Django |
| `DEFAULT_FROM_EMAIL` | Verified Resend sender, defaulting to the Japan47 sender address |
| `EMAIL_VERIFICATION_TOKEN_MAX_AGE` | Verification-link lifetime in seconds |
| `PASSWORD_RESET_TOKEN_MAX_AGE` | Single-use password-reset lifetime in seconds |
| `EMAIL_*`, `ADMIN_EMAILS` | Optional SMTP delivery and recipients for Django server-error alerts |

Generate a development secret with:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

`base.py` deliberately uses `django-insecure-development-only-change-me` when
`DJANGO_SECRET_KEY` is empty so a fresh local checkout can run. `production.py`
fails fast unless the environment supplies a non-empty key of at least 50
characters. Never copy a deployed production key into local configuration.

## Database and existing data

Local commands operate on `backend/db.sqlite3`, preserving all original records and migration history:

```bash
cd backend
../.venv/bin/python manage.py showmigrations
../.venv/bin/python manage.py migrate
```

Follow [POSTGRES_MIGRATION.md](POSTGRES_MIGRATION.md) for the guarded `dumpdata`/`loaddata` cutover, model-count verification, media copy, backup, and rollback commands. PostgreSQL, Redis, static files, and media use separate named volumes.

## Media and images

- Django owns image metadata and multipart upload validation.
- Files up to 8 MB are accepted; MIME type and pixel count are validated, EXIF orientation is removed, and large images are constrained to 1200 px.
- Non-JPEG/WebP uploads are converted to WebP, and gallery images receive separate 480×320 WebP thumbnails.
- Profile images are EXIF-corrected, square-cropped, converted to JPEG, and limited to 512 px.
- API serializers return absolute media URLs using the request host, so React and SwiftUI receive usable URLs.
- Django serves media only in development. Nginx serves `/media/` in production.
- Support screenshots are limited to one validated image of 5 MB, stored under an opaque generated filename, and never returned in the ticket API response.

Do not rename or remove `backend/media/`. To test an upload, log in, open a prefecture, choose **Suggest a place**, and submit an image.

## Authentication

The API uses short-lived JWT access tokens plus rotating refresh tokens with blacklist support. Registration no longer creates tokens:

1. Register at `POST /api/v1/auth/register/`; the account starts unverified.
2. Open the signed link delivered by Resend, then submit it to `POST /api/v1/auth/verify-email/`.
3. Obtain tokens at `POST /api/v1/auth/login/` only after verification.
4. Send `Authorization: Bearer <access>`.
5. Refresh at `POST /api/v1/auth/refresh/`; inactive or newly-unverified accounts are rejected.
6. Revoke the refresh token at `POST /api/v1/auth/logout/`.

Existing accounts are marked verified by migration `0011`, preserving access. New and changed email addresses require confirmation. Email addresses are normalized and protected by a case-insensitive database index. Verification links use Django timestamp signing and a rotating nonce; reset links use Django's password-reset generator and become invalid after a password change. Recovery responses are intentionally generic to prevent account enumeration.

New registrations must explicitly accept the current Terms of Use and Privacy
Policy. Django records each accepted policy version and the shared acceptance
timestamp on the profile; existing accounts are intentionally left with null
consent fields. A future forced re-consent flow can compare those stored
versions with `CURRENT_TERMS_VERSION` and `CURRENT_PRIVACY_POLICY_VERSION`, then
restrict only the features that require a newer acceptance until the user opts
in. That comparison is deliberately not enforced in this release.

Authenticated users can permanently delete their own account from profile
settings after password verification and an exact `DELETE` confirmation. JWT
refresh tokens and Django sessions are invalidated, personal travel/community
data is removed, and submitted places remain as platform-managed content under
“Japan47 Community.” Staff and superuser accounts must first have their elevated
privileges removed by another authorized administrator.

### Resend setup

1. Open `backend/.env` for local Django/runserver or the root `.env` used by Docker.
2. Set `DJANGO_SECRET_KEY` and `RESEND_API_KEY` without committing either file.
3. Verify `japan47.alekspetk.com` in Resend and keep `DEFAULT_FROM_EMAIL=Japan47 <noreply@japan47.alekspetk.com>`.
4. Configure both public origins. Verification and password-reset links use the React origin because their landing pages are React routes:

   ```env
   # Local runserver + Vite on the Mac
   FRONTEND_URL=http://localhost:5173
   BACKEND_URL=http://localhost:8000

   # Local runserver + Vite from a phone (replace with the Mac LAN address)
   FRONTEND_URL=http://192.168.1.25:5173
   BACKEND_URL=http://192.168.1.25:8000

   # Local Docker through its public Nginx port (no port 8000)
   FRONTEND_URL=http://192.168.0.206
   BACKEND_URL=http://192.168.0.206

   # Production behind Nginx
   FRONTEND_URL=https://japan47.alekspetk.com
   BACKEND_URL=https://japan47.alekspetk.com
   ```

`localhost` remains only the safe development fallback. Production settings
require HTTPS for both values and fail during startup if either resolves to an
HTTP development default.

The verification/reset service calls Resend only from Django. Provider errors are logged without keys or complete tokens and public recovery responses remain generic. Registration leaves a safe pending account if delivery is temporarily unavailable, so the resend page can retry later.

The React client stores tokens locally for this portfolio deployment and automatically attempts one refresh after a 401. For a hardened public web deployment, consider keeping the refresh token in an HttpOnly secure same-site cookie. Native SwiftUI should store tokens in Keychain.

### Django admin security and Google Authenticator

Admin authentication is separate from the React/JWT flow. Every active staff
member and superuser must complete TOTP verification for each new Django
session. The private route reduces scanner noise; password authentication,
mandatory 2FA, HTTPS, and Django permissions remain the security controls.

First enrollment:

1. Start Django and open `http://localhost:8000/j47-management/`.
2. Sign in with the staff username and password.
3. Accounts without a confirmed device are redirected to protected setup.
4. Scan the in-memory QR code with Google Authenticator and enter its current six-digit code.
5. Save the ten recovery codes in a password manager or secure offline location. They are shown once and each works once.

Later password logins redirect to the authenticator-code page. Select **Use a
recovery code** when the phone is unavailable. A verified administrator can use
**Manage recovery codes** on the dashboard; regeneration deletes every old
unused code before creating a new set.

If the phone and all recovery codes are lost, an operator with server access
can reset only that administrator's devices. Replace `ADMIN_USERNAME` and run
this from `backend/`:

```bash
../.venv/bin/python manage.py shell -c "from django.contrib.auth import get_user_model; from django_otp.plugins.otp_totp.models import TOTPDevice; from django_otp.plugins.otp_static.models import StaticDevice; u=get_user_model().objects.get(username='ADMIN_USERNAME', is_staff=True); TOTPDevice.objects.filter(user=u).delete(); StaticDevice.objects.filter(user=u).delete(); print('2FA devices cleared; password login now requires fresh enrollment')"
```

This procedure requires database/server access and creates no public bypass.
Verify the intended username before running it. The next password login is
restricted to fresh enrollment until a valid TOTP code confirms the new device.

Example:

```bash
curl -X POST http://localhost:8000/api/v1/auth/login/ \
  -H 'Content-Type: application/json' \
  -d '{"username":"your-user","password":"your-password"}'

curl http://localhost:8000/api/v1/profile/ \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

Validation failures use one stable envelope:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Please correct the highlighted fields.",
    "fields": { "email": ["Enter a valid email address."] }
  }
}
```

## API v1 summary

| Endpoint | Access and purpose |
|---|---|
| `GET /api/v1/health/` | Public health check |
| `GET /api/v1/home/` | Latest, ranked, and contributor homepage data |
| `GET /api/v1/regions/`, `/{name}/` | Region list/detail with computed ratings |
| `GET /api/v1/prefectures/`, `/{name}/` | Search/filter/order and detail previews |
| `/api/v1/places/`, `/{id}/` | Public reads; authenticated create; owner/staff mutation |
| `GET /api/v1/places/trending/` | Places with the most review activity in the last 30 days |
| `POST /api/v1/places/{id}/images/` | Owner/staff gallery upload with generated thumbnail |
| `GET /api/v1/places/?search=&prefecture=&region=&min_rating=&ordering=&page=` | Filtered, ordered, paginated discovery |
| `/api/v1/reviews/`, `/{id}/` | Public reads; authenticated owner-scoped writes |
| `GET/PATCH /api/v1/profile/` | Current private profile and multipart update |
| `GET /api/v1/contributors/{user_id}/` | Public profile without email/login identifier |
| `GET /api/v1/badges/` | Badge thresholds and assets |
| `GET /api/v1/search/?q=` | Unified published-content search |
| `/api/v1/favorites/`, `/visited-places/` | Authenticated personal travel tracking |
| `/api/v1/collections/`, `/itineraries/` | Personal collections and itinerary planning |
| `POST/DELETE /api/v1/places/{id}/favorite/`, `/visited/` | Toggle personal place state |
| `POST/DELETE /api/v1/reviews/{id}/helpful/` | Helpful review voting |
| `/api/v1/reports/` | Authenticated moderation reports |
| `GET/POST /api/v1/support/` | Authenticated form metadata and multipart support-ticket submission |
| `/api/v1/auth/...` | Register, login, refresh, logout |
| `POST /api/v1/auth/account/verify-password/` | Verify the current password before the final deletion warning |
| `POST /api/v1/auth/account/delete/` | Permanently delete the authenticated account after password and `DELETE` confirmation |
| `POST /api/v1/auth/verify-email/` | Consume a signed, expiring verification token |
| `POST /api/v1/auth/resend-verification/` | Generic, throttled verification resend request |
| `POST /api/v1/auth/password-reset/request/` | Generic, throttled password-reset request |
| `POST /api/v1/auth/password-reset/confirm/` | Validate a reset token and change the password |

Place writes accept JSON or multipart fields: `prefecture_id`, `name`, `description`, `image`, `city`, `google_maps_url`, `official_website`, `travel_tips`, `best_season`, `latitude`, and `longitude`. New submissions are pending. A non-staff edit to published content returns it to moderation.

Support submissions accept `category`, `subject`, `contact_email`, `related_url`, `screenshot`, and `message`. Django snapshots the registered account email, rate-limits requests, rejects recent duplicates, and returns a reference such as `SUP-20260724-0001`. The public `/contact` route is protected by the existing JWT flow; Django admin is the staff-only workflow for assignment, internal notes, and status updates.

## Tests and quality checks

```bash
# Backend
cd backend
DJANGO_SETTINGS_MODULE=config.settings.test ../.venv/bin/python manage.py check
../.venv/bin/python manage.py test
../.venv/bin/python manage.py spectacular --file /tmp/japan47-schema.yml --validate

# Frontend
cd ../frontend
npm run lint
npm test
npm run build
```

The backend suite covers serializers through endpoint behavior, verification-aware auth/refresh, signed token expiry and reuse, case-insensitive email uniqueness, generic recovery responses, Resend request construction, password changes, permissions, moderation, CRUD, throttling, uploads, and admin behavior. Frontend tests cover registration confirmation, unverified login guidance, verification results, forgot/reset password, protected contact routing, loading, errors, and submissions.

## Local Docker and VPS deployment

### Local Docker on Mac and phone

```bash
cp .env.example .env
# Replace secret placeholders. If the Mac LAN IP changed, update all LAN values.
docker compose config --quiet
docker compose up -d --build
```

Open `http://localhost` on the Mac or `http://192.168.0.206` on a phone connected
to the same Wi-Fi. Docker uses `config.settings.docker_local`, PostgreSQL, and
the root `.env`; it never reads `backend/.env`. Emailed React links use the LAN
origin, so they open from either device. If the Mac IP changes, update root
`.env` and recreate the stack.

Useful commands:

```bash
docker compose ps
docker compose logs -f backend nginx
docker compose exec backend python manage.py check
docker compose exec backend python manage.py createsuperuser
docker compose exec db pg_dump -U japan47 -d japan47 -Fc -f /tmp/japan47.dump
docker compose down
```

`docker compose down` preserves named volumes. `docker compose down -v` destroys PostgreSQL and persistent media and should only be used intentionally after a backup.

### VPS production

On the VPS, copy `.env.production.example` to the ignored root `.env`, replace
every secret placeholder, and keep the production domain/HTTPS allowlists. The
template explicitly selects `config.settings.production`; those settings fail
closed when the secret key, PostgreSQL, Resend, or HTTPS origins are invalid.
Never use localhost or a LAN address in the VPS `.env`.

Place a TLS-aware load balancer in front or add certificate/listen configuration
to Nginx before enabling public traffic. Production enables secure redirects,
cookies, and HSTS independently from local Docker.

### Hetzner deployment handoff

1. Create a VPS, restrict SSH to keys, enable a firewall for ports 22, 80, and 443, and install Docker Engine plus its Compose plugin.
2. Point the chosen domain's A/AAAA records at the VPS. The domain name and DNS credentials are intentionally not stored in this repository.
3. Clone the repository, copy `.env.production.example` to `.env`, replace every placeholder, and run the PostgreSQL cutover in `POSTGRES_MIGRATION.md`.
4. Put a TLS terminator such as Hetzner Load Balancer, Caddy, or a Certbot-managed Nginx listener in front of this HTTP stack. Only enable Django's secure redirect/cookies after HTTPS is reachable.
5. Run `docker compose up -d --build`, then execute the deploy checks and manual smoke test below.

Back up both database and media. For example, schedule `pg_dump -Fc` to encrypted off-server storage and snapshot the `media_data` volume daily; retain multiple generations and rehearse restoration. Container health checks cover PostgreSQL, Redis, Django, and React. Forward stdout logs and `/api/v1/health/` to the operator's monitoring provider, and configure SMTP variables so uncaught Django request errors reach `ADMIN_EMAILS`.

### Production smoke test

```bash
curl -fsS https://YOUR_DOMAIN/api/v1/health/
curl -fsS https://YOUR_DOMAIN/api/schema/ -o /tmp/japan47-openapi.yml
curl -fsS https://YOUR_DOMAIN/regions -o /dev/null
curl -fsS https://YOUR_DOMAIN/regions/kanto -o /dev/null
curl -fsS https://YOUR_DOMAIN/sitemap.xml -o /dev/null
docker compose exec backend python manage.py check --deploy
docker compose exec backend python manage.py showmigrations --plan
```

Also verify admin login, registration/login/refresh/logout, a direct React-route refresh, filters, review permissions, an existing image, a new cover/gallery upload, generated thumbnails, and persistence after `docker compose restart`. Do not use `docker compose down -v` during verification.

## SwiftUI client guidance

SwiftUI can use the same `/api/v1/` resources without React:

- Generate `Codable` models from `/api/schema/` or model the documented JSON directly.
- Use `URLSession` for JSON and multipart requests.
- Store access and refresh tokens in Keychain; refresh once after a 401.
- Use stable numeric place/user IDs for identity and API writes; display names and slugs are presentation data.
- Render the absolute `image_url` values returned by Django.
- Respect pagination (`count`, `page`, `pages`, `next`, `previous`, `results`) and structured field errors.

The mobile client therefore needs no Django rewrite or React-specific response parsing.

## Folder structure

```text
.
├── backend/
│   ├── config/                 # API settings, URLs, ASGI/WSGI
│   ├── requirements/           # base/development/production pins
│   ├── travel/
│   │   ├── api/                # serializers, responsibility-split views, filters, permissions
│   │   ├── migrations/         # preserved migrations
│   │   ├── tests/              # backend API, service, upload, and admin tests
│   │   ├── templates/admin/    # internal admin dashboard only; no public Django UI
│   │   └── services.py         # ratings, badges, and image processing
│   ├── media/                  # preserved uploads
│   ├── db.sqlite3              # preserved local database (Git-ignored)
│   └── Dockerfile
├── frontend/
│   ├── public/                 # logo, favicon, badge assets
│   ├── src/                    # API, components, layouts, pages, routes, styles
│   ├── Dockerfile
│   └── vite.config.js
├── nginx/nginx.conf
├── docker-compose.yml
├── MIGRATION_CHECKLIST.md
├── POSTGRES_MIGRATION.md
├── .env.example              # ignored local-Docker .env template
└── .env.production.example   # safe VPS template; contains no real secrets
```

## Known limitations

- Image processing currently uses filesystem paths and the production stack intentionally uses a persistent local media volume. Object storage would require a storage-compatible image processing refactor.
- The legal text remains project-provided informational text; obtain professional legal review before a public commercial launch.
- Live TLS termination and VPS firewall/DNS behavior still require a deployment smoke test on the actual server.
- Buying/configuring a domain, recording a demo video, taking final deployment screenshots, publishing to a GitHub portfolio, and editing a CV require the owner's accounts and final deployed URL; the repository cannot perform those external actions safely.

## Future roadmap

- Add a native SwiftUI client using the existing versioned API and OpenAPI schema.
- Move production uploads to object storage while retaining Django-managed metadata and validation.
- Store web refresh tokens in secure HttpOnly cookies as an additional browser hardening step.
- Add privacy-friendly production traffic analytics after deployment.
- Add automated deployment and backup verification after the first VPS release.

## License

No open-source license has been added yet. Until a license is selected, normal copyright rules apply and the source is not automatically available for reuse. For this portfolio project, the recommended choice is the **MIT License**: it is short, widely understood, portfolio-friendly, and permits learning and reuse while preserving the copyright and warranty disclaimer.
