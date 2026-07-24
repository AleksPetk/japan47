"""Custom validators for uploaded files."""
from django.core.exceptions import ValidationError

MAX_IMAGE_SIZE = 8 * 1024 * 1024
MAX_SUPPORT_SCREENSHOT_SIZE = 5 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}


def validate_image_size(image):
    """Reject uploaded images larger than 8 MB."""

    if image.size > MAX_IMAGE_SIZE:
        raise ValidationError(
            "Image should be lower than 8 Mb."
        )


def validate_support_screenshot_size(image):
    """Keep support attachments small enough for safe admin review."""

    if image.size > MAX_SUPPORT_SCREENSHOT_SIZE:
        raise ValidationError("Screenshot must be 5 MB or smaller.")


def validate_image_safety(image):
    """Reject unexpected formats and decompression-bomb-sized images."""

    content_type = getattr(image, "content_type", None)
    if content_type and content_type.lower() not in ALLOWED_IMAGE_TYPES:
        raise ValidationError("Use a JPEG, PNG, WebP, HEIC, or HEIF image.")
    width, height = getattr(image, "width", 0), getattr(image, "height", 0)
    if width and height and width * height > MAX_IMAGE_PIXELS:
        raise ValidationError("Image dimensions are too large.")
