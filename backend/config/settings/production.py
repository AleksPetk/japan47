import os

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403

# Django does not read an env file in production. Docker Compose injects the
# root .env into the container and labels the source for a safe startup message.
ENVIRONMENT_SOURCE = os.getenv(
    "JAPAN47_ENV_SOURCE",
    "process environment (no .env file loaded by Django)",
)
print(f"[Japan47 settings] Production environment loaded from {ENVIRONMENT_SOURCE}")

DEBUG = False

# Fail closed rather than accidentally deploying development defaults.
if not os.getenv("DJANGO_SECRET_KEY") or len(SECRET_KEY) < 50:  # noqa: F405
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set to at least 50 characters.")
if not (os.getenv("DJANGO_ALLOWED_HOSTS") or os.getenv("ALLOWED_HOSTS")):
    raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS or ALLOWED_HOSTS must be set in production.")
if DATABASES["default"]["ENGINE"] != "django.db.backends.postgresql":  # noqa: F405
    raise ImproperlyConfigured("Production requires a PostgreSQL DATABASE_URL.")
if not RESEND_API_KEY:  # noqa: F405
    raise ImproperlyConfigured("RESEND_API_KEY must be configured in production.")
if not FRONTEND_URL.startswith("https://"):  # noqa: F405
    raise ImproperlyConfigured("Production FRONTEND_URL must use HTTPS.")
if not BACKEND_URL.startswith("https://"):  # noqa: F405
    raise ImproperlyConfigured("Production BACKEND_URL must use HTTPS.")

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = env_bool("DJANGO_SECURE_COOKIES", True)  # noqa: F405
CSRF_COOKIE_SECURE = SESSION_COOKIE_SECURE
SECURE_SSL_REDIRECT = env_bool("DJANGO_SECURE_SSL_REDIRECT", True)  # noqa: F405
SECURE_HSTS_SECONDS = int(os.getenv("DJANGO_HSTS_SECONDS", "31536000"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
SESSION_COOKIE_HTTPONLY = True
