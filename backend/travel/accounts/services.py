"""Account email delivery, cooldown, and token lifecycle orchestration."""

import uuid
from datetime import timedelta
from urllib.parse import quote

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.sessions.models import Session
from django.core.exceptions import PermissionDenied
from django.contrib.auth.tokens import default_token_generator
from django.db import transaction
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from travel.models import Place, Profile, SupportTicket

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


def frontend_action_url(*segments):
    """Build a React-owned emailed action URL from the configured public origin."""

    encoded_path = "/".join(quote(str(segment), safe="") for segment in segments)
    return f"{settings.FRONTEND_URL}/{encoded_path}"


@transaction.atomic
def send_verification_email(user, *, rotate=False):
    profile = Profile.objects.select_for_update().get(user=user)
    if profile.email_verified:
        return False
    if rotate:
        profile.email_verification_nonce = uuid.uuid4()
        profile.save(update_fields=("email_verification_nonce", "updated_at"))
    token = make_email_verification_token(user)
    verification_url = frontend_action_url("verify-email", token)
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
    reset_url = frontend_action_url("reset-password", uid, token)
    send_password_reset_message(to=user.email, reset_url=reset_url, token=token)
    profile.password_reset_sent_at = timezone.now()
    profile.save(update_fields=("password_reset_sent_at", "updated_at"))
    return True


def invalidate_user_refresh_tokens(user):
    """Blacklist every outstanding refresh token after a credential change."""

    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)


def _delete_user_sessions(user_id):
    """Remove Django sessions belonging to one user without touching others."""

    for session in Session.objects.all().iterator():
        try:
            session_user_id = session.get_decoded().get("_auth_user_id")
        except Exception:
            # Corrupt or expired session payloads are not evidence that they
            # belong to this account; Django's normal cleanup handles them.
            continue
        if str(session_user_id) == str(user_id):
            session.delete()


@transaction.atomic
def delete_user_account(user):
    """Permanently delete a normal account while retaining public places."""

    locked_user = User.objects.select_for_update().get(pk=user.pk)
    if locked_user.is_staff or locked_user.is_superuser:
        raise PermissionDenied(
            "Staff or superuser privileges must first be removed by another authorized administrator."
        )

    invalidate_user_refresh_tokens(locked_user)
    _delete_user_sessions(locked_user.pk)

    Place.objects.filter(author=locked_user).update(
        author=None,
        is_platform_managed=True,
    )

    # Support history can remain useful for operational integrity, but it must
    # no longer identify or contact the former account owner. Attachments are
    # removed only after the surrounding database transaction commits.
    tickets = list(
        SupportTicket.objects.select_for_update()
        .filter(user=locked_user)
        .exclude(screenshot="")
    )
    for ticket in tickets:
        storage = ticket.screenshot.storage
        name = ticket.screenshot.name
        transaction.on_commit(
            lambda storage=storage, name=name: storage.delete(name) if storage.exists(name) else None
        )
    SupportTicket.objects.filter(user=locked_user).update(
        user=None,
        registered_email="deleted-user@japan47.invalid",
        contact_email="deleted-user@japan47.invalid",
        subject="Deleted user support request",
        related_url="",
        screenshot="",
        message="User-submitted content removed following account deletion.",
        internal_notes="",
        deduplication_key="deleted-user",
    )

    locked_user.delete()
