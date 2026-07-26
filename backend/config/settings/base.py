"""Shared settings for the Japan 47 API backend."""

import os
import re
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlsplit

import dj_database_url
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parents[2]
# Environment-specific modules own configuration loading. Keeping shared
# settings file-agnostic prevents a production root .env from leaking into a
# local runserver process, or local values from entering a Docker container.


def env_bool(name, default=False):
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def env_list(name, default=""):
    return [value.strip() for value in os.getenv(name, default).split(",") if value.strip()]


def env_base_url(name, default):
    """Load one public HTTP(S) origin and remove only its trailing slash."""

    value = (os.getenv(name) or default).strip().rstrip("/")
    parsed = urlsplit(value)
    if (
        parsed.scheme.lower() not in {"http", "https"}
        or not parsed.netloc
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
    ):
        raise ImproperlyConfigured(f"{name} must be a valid public HTTP(S) base URL.")
    return value


def normalized_admin_path(value):
    """Return a safe URL prefix without ever treating obscurity as authentication."""

    value = (value or "").strip().strip("/")
    segments = value.split("/") if value else []
    reserved = {"api", "media", "static", "__debug__"}
    if (
        not segments
        or segments[0].lower() in reserved
        or any(not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", segment) for segment in segments)
    ):
        raise ImproperlyConfigured(
            "DJANGO_ADMIN_PATH must contain safe URL segments and cannot overlap API or asset routes."
        )
    return "/".join(segments) + "/"


SECRET_KEY = os.getenv("DJANGO_SECRET_KEY") or "django-insecure-development-only-change-me"
ADMIN_PATH = normalized_admin_path(os.getenv("DJANGO_ADMIN_PATH", "j47-management/"))
DEBUG = False
ALLOWED_HOSTS = env_list(
    "DJANGO_ALLOWED_HOSTS",
    os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1,backend"),
)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django_otp",
    "django_otp.plugins.otp_totp",
    "django_otp.plugins.otp_static",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "drf_spectacular",
    "travel.apps.TravelConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django_otp.middleware.OTPMiddleware",
    "travel.admin_2fa.AdminTwoFactorMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    # Project-level admin overrides must precede Django's app templates.
    "DIRS": [BASE_DIR / "templates"],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASE_URL = os.getenv("DATABASE_URL", "").strip() or f"sqlite:///{BASE_DIR / 'db.sqlite3'}"
DATABASES = {
    "default": dj_database_url.parse(
        DATABASE_URL,
        conn_max_age=60,
        conn_health_checks=True,
    )
}

# Redis provides a cache shared by every Gunicorn worker. Development remains
# dependency-free by falling back to a small per-process in-memory cache.
REDIS_URL = os.getenv("REDIS_URL", "")
CACHES = {
    "default": {
        "BACKEND": (
            "django.core.cache.backends.redis.RedisCache"
            if REDIS_URL
            else "django.core.cache.backends.locmem.LocMemCache"
        ),
        "LOCATION": REDIS_URL or "japan47-development-cache",
        "TIMEOUT": int(os.getenv("CACHE_DEFAULT_TIMEOUT", "300")),
        "KEY_PREFIX": "japan47",
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("DJANGO_TIME_ZONE", "Asia/Tokyo")
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:5173")
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", "http://localhost:5173")
CORS_ALLOW_CREDENTIALS = False
FRONTEND_URL = env_base_url("FRONTEND_URL", "http://localhost:5173")
BACKEND_URL = env_base_url("BACKEND_URL", "http://localhost:8000")
OTP_TOTP_ISSUER = "Japan 47 administration"

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ("rest_framework.renderers.JSONRenderer",),
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.AllowAny",),
    "DEFAULT_PAGINATION_CLASS": "travel.api.pagination.StandardPagination",
    "PAGE_SIZE": 12,
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "travel.api.exceptions.api_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": os.getenv("API_ANON_THROTTLE", "120/hour"),
        "user": os.getenv("API_USER_THROTTLE", "1000/hour"),
        "auth": os.getenv("AUTH_THROTTLE", "10/minute"),
        "support": os.getenv("SUPPORT_THROTTLE", "5/hour"),
        "verification_resend": os.getenv("VERIFICATION_RESEND_THROTTLE", "5/hour"),
        "password_reset": os.getenv("PASSWORD_RESET_THROTTLE", "5/hour"),
        "account_deletion": os.getenv("ACCOUNT_DELETION_THROTTLE", "5/hour"),
    },
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
}

# Prevent rapid duplicate requests even when the general throttle has capacity.
SUPPORT_DUPLICATE_MINUTES = int(os.getenv("SUPPORT_DUPLICATE_MINUTES", "10"))
ACCOUNT_EMAIL_COOLDOWN_SECONDS = int(os.getenv("ACCOUNT_EMAIL_COOLDOWN_SECONDS", "60"))

# Registration records the exact legal text accepted by each new account.
# Incrementing either value later enables a deliberate re-consent flow without
# rewriting or falsely backfilling historical consent.
CURRENT_TERMS_VERSION = "2026-07-26"
CURRENT_PRIVACY_POLICY_VERSION = "2026-07-26"

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("JWT_ACCESS_MINUTES", "15"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("JWT_REFRESH_DAYS", "7"))),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Japan 47 API",
    "DESCRIPTION": "Versioned API for the Japan 47 React web app and future mobile clients.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "ENUM_NAME_OVERRIDES": {
        "PlaceStatusEnum": "travel.models.Place.Status",
        "ReportStatusEnum": "travel.models.ContentReport.Status",
    },
}

EMAIL_VERIFICATION_TOKEN_MAX_AGE = int(os.getenv("EMAIL_VERIFICATION_TOKEN_MAX_AGE", "86400"))
PASSWORD_RESET_TOKEN_MAX_AGE = int(os.getenv("PASSWORD_RESET_TOKEN_MAX_AGE", "3600"))
# Django's built-in reset token generator reads this setting directly.
PASSWORD_RESET_TIMEOUT = PASSWORD_RESET_TOKEN_MAX_AGE
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
RESEND_TIMEOUT_SECONDS = int(os.getenv("RESEND_TIMEOUT_SECONDS", "10"))
EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "Japan47 <noreply@japan47.alekspetk.com>")
SERVER_EMAIL = os.getenv("SERVER_EMAIL", DEFAULT_FROM_EMAIL)
EMAIL_HOST = os.getenv("EMAIL_HOST", "")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
ADMINS = [("Japan 47 admin", email) for email in env_list("ADMIN_EMAILS")]

# Container logs go to stdout/stderr so Docker can rotate and collect them.
LOG_LEVEL = os.getenv("DJANGO_LOG_LEVEL", "INFO")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": "{asctime} {levelname} {name} {message}",
            "style": "{",
        }
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "standard"},
        "mail_admins": {
            "class": "django.utils.log.AdminEmailHandler",
            "level": "ERROR",
        },
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {
        "django.security": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "django.request": {
            "handlers": ["console", "mail_admins"],
            "level": "ERROR",
            "propagate": False,
        },
    },
}
