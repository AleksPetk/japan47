"""Reusable services for images, ratings, and contributors."""

from io import BytesIO
from pathlib import Path

from django.core.files.base import ContentFile
from django.db.models import Avg, Count, Exists, OuterRef, Prefetch
from PIL import Image, ImageOps


# Image policy is centralized so every upload path produces consistent output.

MAX_IMAGE_WIDTH = 1200
MAX_IMAGE_HEIGHT = 1200
JPEG_QUALITY = 85
PROFILE_IMAGE_SIZE = 512
THUMBNAIL_SIZE = (480, 320)


BADGE_LEVELS = (
    {"name": "Rookie Traveler", "filename": "rookie_traveler.png", "minimum_points": 0},
    {"name": "Local Explorer", "filename": "local_explorer.png", "minimum_points": 25},
    {"name": "Route Finder", "filename": "route_finder.png", "minimum_points": 75},
    {"name": "Japan Adventurer", "filename": "japan_adventurer.png", "minimum_points": 150},
    {"name": "Prefecture Expert", "filename": "prefecture_expert.png", "minimum_points": 300},
    {"name": "Travel Guide", "filename": "travel_guide.png", "minimum_points": 500},
    {"name": "Japan 47 Legend", "filename": "japan_47_legend.png", "minimum_points": 1000},
)


# Contributor progression

def get_badge_progress(points):
    """Return the badge and within-level progress for a point total."""

    points = max(0, points)
    current_index = 0

    for index, level in enumerate(BADGE_LEVELS):
        if points >= level["minimum_points"]:
            current_index = index
        else:
            break

    current = BADGE_LEVELS[current_index]
    next_level = (
        BADGE_LEVELS[current_index + 1]
        if current_index + 1 < len(BADGE_LEVELS)
        else None
    )

    if next_level is None:
        progress_percent = 100
        points_until_next = 0
    else:
        level_size = next_level["minimum_points"] - current["minimum_points"]
        level_progress = points - current["minimum_points"]
        progress_percent = min(100, max(0, level_progress / level_size * 100))
        points_until_next = max(0, next_level["minimum_points"] - points)

    return {
        "name": current["name"],
        "filename": current["filename"],
        "minimum_points": current["minimum_points"],
        "next_name": next_level["name"] if next_level else None,
        "next_points": next_level["minimum_points"] if next_level else None,
        "points_until_next": points_until_next,
        "progress_percent": round(progress_percent, 1),
    }


def get_contributor_stats(published_place_count, review_count):
    """Build contributor totals once from current valid database counts."""

    points = published_place_count * 5 + review_count
    return {
        "points": points,
        "published_place_count": published_place_count,
        "review_count": review_count,
        "badge": get_badge_progress(points),
    }


# Rating aggregation

def annotate_places_with_ratings(queryset):
    """Add review average and count to every place in a queryset."""

    return queryset.annotate(
        average_rating=Avg("reviews__rating"),
        review_count=Count("reviews", distinct=True),
    )


def personalize_places(queryset, user):
    """Annotate card data and viewer state without per-place queries."""

    from travel.models import Favorite, VisitedPlace

    return annotate_places_with_ratings(queryset).annotate(
        viewer_has_favorite=Exists(
            Favorite.objects.filter(user=user, place_id=OuterRef("pk"))
        ),
        viewer_has_visited=Exists(
            VisitedPlace.objects.filter(user=user, place_id=OuterRef("pk"))
        ),
    )


def bayesian_rating(average, review_count, global_average=3.5, minimum_reviews=5):
    """Stabilize rankings so a single five-star review cannot dominate."""

    if average is None or review_count <= 0:
        return None
    return (
        review_count / (review_count + minimum_reviews) * average
        + minimum_reviews / (review_count + minimum_reviews) * global_average
    )


def prefetch_prefectures_with_rating_data(queryset):
    """Prefetch annotated places used to calculate prefecture ratings."""

    from travel.models import Place

    rated_places = annotate_places_with_ratings(
        Place.objects.filter(status=Place.Status.PUBLISHED)
    ).filter(
        average_rating__isnull=False
    )
    return queryset.prefetch_related(
        Prefetch("places", queryset=rated_places, to_attr="rating_places")
    )


def prefetch_regions_with_rating_data(queryset):
    """Prefetch prefectures and their annotated places for region ratings."""

    from travel.models import Prefecture

    prefectures = prefetch_prefectures_with_rating_data(Prefecture.objects.all())
    return queryset.prefetch_related(
        Prefetch("prefectures", queryset=prefectures)
    )


def apply_prefecture_rating(prefecture):
    """Set the equal-weight average of rated places on a prefecture."""

    ratings = [
        place.average_rating
        for place in getattr(prefecture, "rating_places", ())
        if place.average_rating is not None
    ]
    prefecture.average_rating = sum(ratings) / len(ratings) if ratings else None
    return prefecture.average_rating


def apply_prefecture_ratings(prefectures):
    """Apply equal-weight place averages to an iterable of prefectures."""

    for prefecture in prefectures:
        apply_prefecture_rating(prefecture)
    return prefectures


def apply_region_rating(region):
    """Set the equal-weight average of rated prefectures on a region."""

    prefectures = list(region.prefectures.all())
    apply_prefecture_ratings(prefectures)
    ratings = [
        prefecture.average_rating
        for prefecture in prefectures
        if prefecture.average_rating is not None
    ]
    region.average_rating = sum(ratings) / len(ratings) if ratings else None
    return region.average_rating


def apply_region_ratings(regions):
    """Apply equal-weight prefecture averages to an iterable of regions."""

    for region in regions:
        apply_region_rating(region)
    return regions


# Image processing

def process_model_image(model):
    """Resize and convert a model image after the model is saved."""

    if not model.image:
        return
    
    image_path = Path(model.image.path)

    # Copy into memory so Pillow closes the source before it is overwritten.
    with Image.open(image_path) as source_image:
        image = ImageOps.exif_transpose(source_image)
        image.load()

    should_resize = image.width > MAX_IMAGE_WIDTH or image.height > MAX_IMAGE_HEIGHT

    original_suffix = image_path.suffix.lower()
    should_convert = original_suffix not in (".jpg", ".jpeg", ".webp")

    if should_resize:
        image.thumbnail((MAX_IMAGE_WIDTH, MAX_IMAGE_HEIGHT))

    if should_convert:
        # WebP keeps uploads small while preserving transparency where present.
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA" if "transparency" in image.info else "RGB")

        new_path = image_path.with_suffix(".webp")

        image.save(new_path, "WEBP", quality=JPEG_QUALITY, method=6)

        if image_path != new_path:
            image_path.unlink()

            model.image.name = str(
                Path(model.image.name).with_suffix(".webp")
            )

            """Update only the database field without calling model.save()
                again and restarting the image-processing service."""
            model.__class__.objects.filter(pk=model.pk).update(
                image=model.image.name
            )
    elif should_resize:
        image.save(image_path, quality=JPEG_QUALITY, optimize=True)


def process_profile_image(profile):
    """Crop a profile image to a square and limit it to 512 pixels."""

    if not profile.profile_image:
        return

    image_path = Path(profile.profile_image.path)
    with Image.open(image_path) as source_image:
        image = ImageOps.exif_transpose(source_image)
        image.load()

    square_size = min(PROFILE_IMAGE_SIZE, image.width, image.height)
    image = ImageOps.fit(
        image,
        (square_size, square_size),
        method=Image.Resampling.LANCZOS,
    )

    if image.mode in ("RGBA", "LA") or (
        image.mode == "P" and "transparency" in image.info
    ):
        rgba_image = image.convert("RGBA")
        background = Image.new("RGB", rgba_image.size, "white")
        background.paste(rgba_image, mask=rgba_image.getchannel("A"))
        image = background
    elif image.mode != "RGB":
        image = image.convert("RGB")

    new_path = image_path.with_suffix(".jpg")
    image.save(new_path, "JPEG", quality=JPEG_QUALITY, optimize=True)

    if image_path != new_path:
        image_path.unlink()
        profile.profile_image.name = str(
            Path(profile.profile_image.name).with_suffix(".jpg")
        )
        profile.__class__.objects.filter(pk=profile.pk).update(
            profile_image=profile.profile_image.name
        )


def generate_gallery_thumbnail(place_image):
    """Generate a small WebP derivative while keeping the original upload."""

    if not place_image.image:
        return
    with Image.open(place_image.image.path) as source_image:
        image = ImageOps.exif_transpose(source_image).convert("RGB")
        image = ImageOps.fit(image, THUMBNAIL_SIZE, method=Image.Resampling.LANCZOS)
    output = BytesIO()
    image.save(output, "WEBP", quality=80, method=6)
    output.seek(0)
    place_image.thumbnail.save("thumbnail.webp", ContentFile(output.read()), save=False)
    place_image.__class__.objects.filter(pk=place_image.pk).update(
        thumbnail=place_image.thumbnail.name
    )
