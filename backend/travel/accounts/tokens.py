"""Short-lived, signed email-verification tokens."""

import secrets

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from django.db import transaction
from django.utils import timezone
from travel.models import Profile

User = get_user_model()
VERIFICATION_SALT = "travel.accounts.email-verification.v1"


def make_email_verification_token(user):
    profile, _ = Profile.objects.get_or_create(user=user)
    return signing.dumps(
        {"uid": user.pk, "nonce": str(profile.email_verification_nonce)},
        salt=VERIFICATION_SALT,
        compress=True,
    )


def consume_email_verification_token(token):
    """Return success/already_verified/expired/invalid without leaking details."""

    try:
        payload = signing.loads(
            token,
            salt=VERIFICATION_SALT,
            max_age=settings.EMAIL_VERIFICATION_TOKEN_MAX_AGE,
        )
    except signing.SignatureExpired:
        return "expired"
    except (signing.BadSignature, TypeError, ValueError):
        return "invalid"

    try:
        user_id = int(payload["uid"])
        token_nonce = str(payload["nonce"])
    except (KeyError, TypeError, ValueError):
        return "invalid"

    with transaction.atomic():
        try:
            profile = (
                Profile.objects.select_for_update().select_related("user").get(user_id=user_id)
            )
        except Profile.DoesNotExist:
            return "invalid"
        if profile.email_verified:
            return "already_verified"
        if not secrets.compare_digest(str(profile.email_verification_nonce), token_nonce):
            return "invalid"
        if not profile.user.is_active:
            return "invalid"
        profile.email_verified = True
        profile.email_verified_at = timezone.now()
        # Rotating the nonce makes every previously issued link unusable.
        import uuid

        profile.email_verification_nonce = uuid.uuid4()
        profile.save(
            update_fields=(
                "email_verified",
                "email_verified_at",
                "email_verification_nonce",
                "updated_at",
            )
        )
    return "success"
