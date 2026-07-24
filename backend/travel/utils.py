import uuid
from pathlib import Path


def region_image_upload_path(instance, filename):
    """Region image path processing function."""

    extension = Path(filename).suffix.lower()
    return f"region_images/{instance.name}{extension}"



def prefecture_image_upload_path(instance, filename):
    """Prefecture image path processing function."""

    extension = Path(filename).suffix.lower()
    return f"prefecture_images/{instance.name}{extension}"

def place_image_upload_path(instance, filename):
    """Generate a unique upload for a post image."""

    extension = Path(filename).suffix
    new_filename = f"{uuid.uuid4()}{extension}"
    return f"place_images/user_{instance.author.id}/{new_filename}"


def place_gallery_upload_path(instance, filename):
    """Keep gallery files beside the owning contributor's place uploads."""

    extension = Path(filename).suffix.lower()
    return f"place_images/user_{instance.place.author_id}/{uuid.uuid4()}{extension}"


def place_thumbnail_upload_path(instance, filename):
    """Store generated thumbnails separately from original gallery files."""

    return f"place_images/user_{instance.place.author_id}/thumbnails/{uuid.uuid4()}.webp"


def place_revision_image_upload_path(instance, filename):
    """Keep proposed cover images separate until a revision is approved."""

    extension = Path(filename).suffix.lower()
    return f"place_revisions/user_{instance.place.author_id}/{uuid.uuid4()}{extension}"


def place_revision_gallery_upload_path(instance, filename):
    """Store gallery additions against their pending place revision."""

    extension = Path(filename).suffix.lower()
    return f"place_revisions/user_{instance.revision.place.author_id}/gallery/{uuid.uuid4()}{extension}"


def place_revision_thumbnail_upload_path(instance, filename):
    """Store preview thumbnails for proposed gallery additions."""

    return f"place_revisions/user_{instance.revision.place.author_id}/thumbnails/{uuid.uuid4()}.webp"


def profile_image_upload_path(instance, filename):
    """Generate a unique media path for a user's profile image."""

    extension = Path(filename).suffix.lower()
    new_filename = f"{uuid.uuid4()}{extension}"
    return f"profile_images/user_{instance.user_id}/{new_filename}"


def support_screenshot_upload_path(instance, filename):
    """Store support screenshots under an opaque, non-user-supplied name."""

    extension = Path(filename).suffix.lower()
    if extension not in {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}:
        extension = ".img"
    return f"support_screenshots/{uuid.uuid4()}{extension}"
