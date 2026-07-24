import uuid

from django.contrib.auth.models import User
from django.core.cache import cache
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from travel.models import Place, PlaceImage, Profile, Review, SupportTicket


@receiver(pre_save, sender=User)
def normalize_user_email(sender, instance, **kwargs):
    """Keep every write path compatible with the case-insensitive DB index."""

    instance.email = (instance.email or "").strip().lower()
    instance._japan47_email_changed = False
    if instance.pk:
        previous = User.objects.filter(pk=instance.pk).values_list("email", flat=True).first()
        instance._japan47_email_changed = previous is not None and previous.casefold() != instance.email.casefold()


@receiver(post_save, sender=User)
def create_profile_for_new_user(sender, instance, created, **kwargs):
    # Fixture loading must reproduce stored profiles instead of creating an
    # extra profile while users are being restored into PostgreSQL.
    if kwargs.get("raw"):
        return
    if created:
        Profile.objects.get_or_create(user=instance)
    elif getattr(instance, "_japan47_email_changed", False):
        Profile.objects.filter(user=instance).update(
            email_verified=False,
            email_verified_at=None,
            email_verification_nonce=uuid.uuid4(),
            email_verification_sent_at=None,
        )


@receiver(post_delete, sender=Profile)
def delete_profile_image(sender, instance, **kwargs):
    if instance.profile_image:
        storage = instance.profile_image.storage
        if storage.exists(instance.profile_image.name):
            storage.delete(instance.profile_image.name)


@receiver(post_delete, sender=PlaceImage)
def delete_gallery_files(sender, instance, **kwargs):
    """Cascade deletion bypasses model.delete(), so clean both media files here."""

    for image in (instance.image, instance.thumbnail):
        if image and image.storage.exists(image.name):
            image.storage.delete(image.name)


@receiver(post_delete, sender=SupportTicket)
def delete_support_screenshot(sender, instance, **kwargs):
    """Remove a private support attachment if its database record is deleted."""

    if instance.screenshot and instance.screenshot.storage.exists(instance.screenshot.name):
        instance.screenshot.storage.delete(instance.screenshot.name)


@receiver([post_save, post_delete], sender=Place)
@receiver([post_save, post_delete], sender=Review)
def clear_public_content_cache(sender, instance, **kwargs):
    """Published discovery data changes often enough to invalidate as a group."""

    cache.delete("api:v1:home")
