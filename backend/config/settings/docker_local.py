"""Docker settings for testing the production stack on a trusted local LAN."""

import os

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403

# Compose injects the ignored root .env. Django never reads backend/.env here,
# which keeps SQLite/runserver development isolated from Docker PostgreSQL.
print("[Japan47 settings] Docker-local environment loaded from root .env")

DEBUG = False

if not os.getenv("DJANGO_SECRET_KEY") or len(SECRET_KEY) < 50:  # noqa: F405
    raise ImproperlyConfigured(
        "Docker-local DJANGO_SECRET_KEY must be set to at least 50 characters."
    )
if DATABASES["default"]["ENGINE"] != "django.db.backends.postgresql":  # noqa: F405
    raise ImproperlyConfigured("Docker-local testing requires PostgreSQL.")
if not FRONTEND_URL.startswith("http://"):  # noqa: F405
    raise ImproperlyConfigured("Docker-local FRONTEND_URL must use http://.")
if not BACKEND_URL.startswith("http://"):  # noqa: F405
    raise ImproperlyConfigured("Docker-local BACKEND_URL must use http://.")

# Local Nginx exposes plain HTTP on the Mac and LAN. These values must never be
# copied into the production environment, which enforces HTTPS independently.
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
SECURE_SSL_REDIRECT = False
SECURE_HSTS_SECONDS = 0
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
SESSION_COOKIE_HTTPONLY = True
