"""Transactional decisions for user-requested place deletion."""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .models import Place, PlaceDeletionRequest


@transaction.atomic
def approve_place_deletion(deletion_request, reviewer):
    """Approve once and permanently cascade-delete the associated place."""

    # Lock nullable rows separately. PostgreSQL rejects FOR UPDATE when a
    # select_related() outer join attempts to lock the nullable Place side.
    deletion_request = PlaceDeletionRequest.objects.select_for_update().get(
        pk=deletion_request.pk
    )
    if deletion_request.status != PlaceDeletionRequest.Status.PENDING:
        raise ValidationError("This deletion request has already been reviewed.")
    if deletion_request.place is None:
        raise ValidationError("The requested place no longer exists.")

    place = Place.objects.select_for_update().get(pk=deletion_request.place_id)
    deletion_request.status = PlaceDeletionRequest.Status.APPROVED
    deletion_request.reviewed_by = reviewer
    deletion_request.reviewed_at = timezone.now()
    deletion_request.save(
        update_fields=("status", "reviewed_by", "reviewed_at", "updated_at")
    )
    place.delete()
    return deletion_request


@transaction.atomic
def reject_place_deletion(deletion_request, reviewer):
    """Reject once while leaving the place and all related content untouched."""

    deletion_request = PlaceDeletionRequest.objects.select_for_update().get(
        pk=deletion_request.pk
    )
    if deletion_request.status != PlaceDeletionRequest.Status.PENDING:
        raise ValidationError("This deletion request has already been reviewed.")

    deletion_request.status = PlaceDeletionRequest.Status.REJECTED
    deletion_request.reviewed_by = reviewer
    deletion_request.reviewed_at = timezone.now()
    deletion_request.save(
        update_fields=("status", "reviewed_by", "reviewed_at", "updated_at")
    )
    return deletion_request
