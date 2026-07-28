"""Transactional moderation services for proposed changes to published places."""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from django.utils.text import slugify

from .models import Place, PlaceImage, PlaceRevision

MAX_PLACE_GALLERY_IMAGES = 4


def unique_place_slug(name, prefecture, *, exclude_place=None):
    """Return a stable, URL-safe slug that remains unique inside a prefecture."""

    base = slugify(name, allow_unicode=True)[:160] or "place"
    candidate, counter = base, 1
    queryset = Place.objects.filter(prefecture=prefecture)
    if exclude_place:
        queryset = queryset.exclude(pk=exclude_place.pk)
    while queryset.filter(slug=candidate).exists():
        suffix = str(counter)
        candidate = f"{base[:160-len(suffix)]}{suffix}"
        counter += 1
    return candidate


@transaction.atomic
def approve_place_revision(revision, reviewer):
    """Atomically apply a pending snapshot while retaining the moderation audit."""

    place = Place.objects.select_for_update().get(pk=revision.place_id)
    revision = (
        PlaceRevision.objects.select_for_update()
        .select_related("place", "prefecture")
        .prefetch_related("gallery_images", "removed_gallery_images")
        .get(pk=revision.pk)
    )
    if revision.status != PlaceRevision.Status.PENDING:
        raise ValidationError("Only pending place revisions can be approved.")

    removed_gallery = list(revision.removed_gallery_images.filter(place=place))
    final_gallery_count = place.gallery_images.count() - len(removed_gallery) + revision.gallery_images.count()
    if final_gallery_count > MAX_PLACE_GALLERY_IMAGES:
        raise ValidationError(f"A place can have up to {MAX_PLACE_GALLERY_IMAGES} gallery photos.")

    for field in (
        "prefecture",
        "name",
        "description",
        "city",
        "google_maps_url",
        "official_website",
        "travel_tips",
        "best_season",
        "latitude",
        "longitude",
    ):
        setattr(place, field, getattr(revision, field))
    if revision.remove_image:
        place.image = None
    elif revision.image:
        place.image = revision.image.name
    place.slug = unique_place_slug(place.name, place.prefecture, exclude_place=place)
    place.status = Place.Status.PUBLISHED
    place.reviewed_by = reviewer
    place.reviewed_at = timezone.now()
    place.save()

    for gallery_image in removed_gallery:
        gallery_image.delete()

    next_order = (place.gallery_images.aggregate(max_order=Max("display_order"))["max_order"] or -1) + 1
    for offset, proposed_image in enumerate(revision.gallery_images.all()):
        PlaceImage.objects.create(
            place=place,
            image=proposed_image.image.name,
            caption=proposed_image.caption,
            display_order=next_order + offset,
        )

    reviewed_at = timezone.now()
    PlaceRevision.objects.filter(pk=revision.pk).update(
        status=PlaceRevision.Status.APPROVED,
        reviewed_by=reviewer,
        reviewed_at=reviewed_at,
        updated_at=reviewed_at,
    )
    revision.refresh_from_db()
    return place


@transaction.atomic
def reject_place_revision(revision, reviewer):
    """Reject a proposal without modifying any field on the published place."""

    revision = PlaceRevision.objects.select_for_update().get(pk=revision.pk)
    if revision.status != PlaceRevision.Status.PENDING:
        raise ValidationError("Only pending place revisions can be rejected.")
    reviewed_at = timezone.now()
    PlaceRevision.objects.filter(pk=revision.pk).update(
        status=PlaceRevision.Status.REJECTED,
        reviewed_by=reviewer,
        reviewed_at=reviewed_at,
        updated_at=reviewed_at,
    )
    revision.refresh_from_db()
    return revision
