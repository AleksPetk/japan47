"""Creation and duplicate-protection rules for support requests."""

import hashlib
import re
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from travel.models import SupportTicket, SupportTicketCounter

CONTROL_CHARACTERS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def clean_support_text(value):
    """Trim input and remove invisible control characters without changing prose."""

    return CONTROL_CHARACTERS.sub("", value or "").strip()


def support_deduplication_key(*, category, subject, contact_email, related_url, message):
    """Fingerprint meaningful fields so accidental double-submits can be rejected."""

    normalized = "\x1f".join(
        (
            category.strip().lower(),
            subject.strip().casefold(),
            contact_email.strip().casefold(),
            related_url.strip(),
            message.strip(),
        )
    )
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def has_recent_duplicate(*, user, deduplication_key):
    minutes = int(getattr(settings, "SUPPORT_DUPLICATE_MINUTES", 10))
    cutoff = timezone.now() - timedelta(minutes=minutes)
    return SupportTicket.objects.filter(
        user=user,
        deduplication_key=deduplication_key,
        created_at__gte=cutoff,
    ).exists()


@transaction.atomic
def create_support_ticket(*, user, validated_data):
    """Issue the next daily public reference and persist one immutable request."""

    fingerprint = support_deduplication_key(
        category=validated_data["category"],
        subject=validated_data["subject"],
        contact_email=validated_data["contact_email"],
        related_url=validated_data.get("related_url", ""),
        message=validated_data["message"],
    )
    today = timezone.localdate()
    counter, _ = SupportTicketCounter.objects.select_for_update().get_or_create(date=today)
    # The locked daily row also serializes duplicate checks from simultaneous clicks.
    if has_recent_duplicate(user=user, deduplication_key=fingerprint):
        raise ValueError("duplicate_support_request")
    counter.last_number += 1
    counter.save(update_fields=("last_number",))
    ticket_id = f"SUP-{today:%Y%m%d}-{counter.last_number:04d}"

    return SupportTicket.objects.create(
        ticket_id=ticket_id,
        user=user,
        registered_email=user.email.strip(),
        deduplication_key=fingerprint,
        **validated_data,
    )
