"""Account email delivery, cooldown, and token lifecycle orchestration."""

import uuid
from datetime import timedelta
from urllib.parse import quote

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.db import transaction
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from travel.models import Profile

from .email_service import send_password_reset_message, send_verification_message
from .tokens import make_email_verification_token

User = get_user_model()


def normalize_username(value):
    return (value or "").strip().lower()


def normalize_email(value):
    return (value or "").strip().lower()


def mask_email(value):
    local, separator, domain = normalize_email(value).partition("@")
    if not separator:
        return ""
    visible = local[:2] if len(local) > 2 else local[:1]
    return f"{visible}{'*' * max(2, len(local) - len(visible))}@{domain}"


def cooldown_active(profile, field_name):
    sent_at = getattr(profile, field_name)
    if not sent_at:
        return False
    cooldown = timedelta(seconds=settings.ACCOUNT_EMAIL_COOLDOWN_SECONDS)
    return sent_at > timezone.now() - cooldown


@transaction.atomic
def send_verification_email(user, *, rotate=False):
    profile = Profile.objects.select_for_update().get(user=user)
    if profile.email_verified:
        return False
    if rotate:
        profile.email_verification_nonce = uuid.uuid4()
        profile.save(update_fields=("email_verification_nonce", "updated_at"))
    token = make_email_verification_token(user)
    verification_url = f"{settings.FRONTEND_URL}/verify-email/{quote(token, safe='')}"
    send_verification_message(to=user.email, verification_url=verification_url, token=token)
    profile.email_verification_sent_at = timezone.now()
    profile.save(update_fields=("email_verification_sent_at", "updated_at"))
    return True


@transaction.atomic
def request_verification_email(email):
    user = User.objects.select_related("profile").filter(email__iexact=normalize_email(email), is_active=True).first()
    if not user:
        return False
    profile, _ = Profile.objects.get_or_create(user=user)
    if profile.email_verified or cooldown_active(profile, "email_verification_sent_at"):
        return False
    return send_verification_email(user, rotate=True)


@transaction.atomic
def request_password_reset_email(email):
    user = User.objects.select_related("profile").filter(email__iexact=normalize_email(email), is_active=True).first()
    if not user or not user.has_usable_password():
        return False
    profile, _ = Profile.objects.get_or_create(user=user)
    if cooldown_active(profile, "password_reset_sent_at"):
        return False
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    reset_url = f"{settings.FRONTEND_URL}/reset-password/{uid}/{quote(token, safe='')}"
    send_password_reset_message(to=user.email, reset_url=reset_url, token=token)
    profile.password_reset_sent_at = timezone.now()
    profile.save(update_fields=("password_reset_sent_at", "updated_at"))
    return True


def invalidate_user_refresh_tokens(user):
    """Blacklist every outstanding refresh token after a credential change."""

    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)
