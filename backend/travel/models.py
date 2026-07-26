import uuid

from django.db import models
from pillow_heif import register_heif_opener
from django.core.exceptions import ValidationError
from django.core.validators import MaxLengthValidator, MaxValueValidator, MinValueValidator
from django.contrib.auth.models import User

from .validators import validate_image_safety, validate_image_size, validate_support_screenshot_size
from .utils import (
    place_image_upload_path,
    place_gallery_upload_path,
    place_thumbnail_upload_path,
    place_revision_gallery_upload_path,
    place_revision_image_upload_path,
    place_revision_thumbnail_upload_path,
    prefecture_image_upload_path,
    profile_image_upload_path,
    region_image_upload_path,
    support_screenshot_upload_path,
)
from .services import generate_gallery_thumbnail, process_model_image, process_profile_image

register_heif_opener()

class Region(models.Model):
    """Japan Regions Model."""

    class RegionName(models.TextChoices):
        """Japan's nine site regions."""

        HOKKAIDO = "hokkaido", "Hokkaido"
        TOHOKU = "tohoku", "Tohoku"
        KANTO = "kanto", "Kanto"
        CHUBU = "chubu", "Chubu"
        KANSAI = "kansai", "Kansai"
        CHUGOKU = "chugoku", "Chugoku"
        SHIKOKU = "shikoku", "Shikoku"
        KYUSHU = "kyushu", "Kyushu"
        OKINAWA = "okinawa", "Okinawa"

    name = models.CharField(
        max_length=20,
        choices=RegionName.choices,
        unique=True,
    )
    description = models.TextField(blank=True)
    image = models.ImageField(
        upload_to=region_image_upload_path,
        blank=True,
        null=True,
        verbose_name="Region Image",
        validators=[validate_image_size, validate_image_safety]
    )
    display_order = models.PositiveSmallIntegerField(unique=True)

    class Meta:
        ordering = ["display_order"]

    def __str__(self):
        return self.get_name_display()
    
    def save(self, *args, **kwargs):
        """Save the model, clean replaced image, and process the new image."""

        old_image = None

        # Retrieve the currently saved image before updating this region.
        if self.pk:
            old_region = Region.objects.filter(pk=self.pk).first()
            if old_region:
                old_image = old_region.image

        super().save(*args, **kwargs)

        # Delete the previous file when the image is replaced or cleared.
        if old_image and old_image != self.image:
            if old_image.storage.exists(old_image.name):
                old_image.delete(save=False)

        process_model_image(self)

    def delete(self, *args, **kwargs):
        """Delete the image before deleting the region."""

        if self.image:
            if self.image.storage.exists(self.image.name):
                self.image.delete(save=False)
        super().delete(*args, **kwargs)


class Prefecture(models.Model):
    PREFECTURE_REGION = {
        "Hokkaido": "Hokkaido",

        "Aomori": "Tohoku",
        "Iwate": "Tohoku",
        "Miyagi": "Tohoku",
        "Akita": "Tohoku",
        "Yamagata": "Tohoku",
        "Fukushima": "Tohoku",

        "Ibaraki": "Kanto",
        "Tochigi": "Kanto",
        "Gunma": "Kanto",
        "Saitama": "Kanto",
        "Chiba": "Kanto",
        "Tokyo": "Kanto",
        "Kanagawa": "Kanto",

        "Niigata": "Chubu",
        "Toyama": "Chubu",
        "Ishikawa": "Chubu",
        "Fukui": "Chubu",
        "Yamanashi": "Chubu",
        "Nagano": "Chubu",
        "Gifu": "Chubu",
        "Shizuoka": "Chubu",
        "Aichi": "Chubu",

        "Mie": "Kansai",
        "Shiga": "Kansai",
        "Kyoto": "Kansai",
        "Osaka": "Kansai",
        "Hyogo": "Kansai",
        "Nara": "Kansai",
        "Wakayama": "Kansai",

        "Tottori": "Chugoku",
        "Shimane": "Chugoku",
        "Okayama": "Chugoku",
        "Hiroshima": "Chugoku",
        "Yamaguchi": "Chugoku",

        "Tokushima": "Shikoku",
        "Kagawa": "Shikoku",
        "Ehime": "Shikoku",
        "Kochi": "Shikoku",

        "Fukuoka": "Kyushu",
        "Saga": "Kyushu",
        "Nagasaki": "Kyushu",
        "Kumamoto": "Kyushu",
        "Oita": "Kyushu",
        "Miyazaki": "Kyushu",
        "Kagoshima": "Kyushu",

        "Okinawa": "Okinawa",
    }

    region = models.ForeignKey(
        Region,
        on_delete=models.PROTECT,
        related_name="prefectures",
    )

    name = models.CharField(
        max_length=40,
        unique=True,
    )

    description = models.TextField(blank=True)

    image = models.ImageField(
        upload_to=prefecture_image_upload_path,
        blank=True,
        null=True,
        verbose_name="Prefecture Image",
        validators=[validate_image_size, validate_image_safety],
    )

    display_order = models.PositiveSmallIntegerField(unique=True)

    class Meta:
        ordering = ["display_order"]

    def __str__(self):
        return self.name

    def clean(self):
        super().clean()

        expected_region = self.PREFECTURE_REGION.get(self.name)

        if expected_region is None:
            raise ValidationError(
                {"name": "Unknown prefecture."}
            )

        if self.region.get_name_display() != expected_region:
            raise ValidationError(
                {
                    "region": (
                        f"{self.name} must belong to "
                        f"{expected_region}."
                    )
                }
            )

    def save(self, *args, **kwargs):
        self.full_clean()

        old_image = None

        if self.pk:
            old_prefecture = Prefecture.objects.filter(
                pk=self.pk
            ).first()

            if old_prefecture:
                old_image = old_prefecture.image

        super().save(*args, **kwargs)

        if old_image and old_image != self.image:
            if old_image.storage.exists(old_image.name):
                old_image.delete(save=False)

        process_model_image(self)

    def delete(self, *args, **kwargs):
        if self.image:
            if self.image.storage.exists(self.image.name):
                self.image.delete(save=False)

        super().delete(*args, **kwargs)



class Place(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending Review"
        PUBLISHED = "published", "Published"
        REJECTED = "rejected", "Rejected"

    class Season(models.TextChoices):
        YEAR_ROUND = "year_round", "Year-round"
        SPRING = "spring", "Spring"
        SUMMER = "summer", "Summer"
        AUTUMN = "autumn", "Autumn"
        WINTER = "winter", "Winter"

    author = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="places",
        blank=True,
        null=True,
    )
    is_platform_managed = models.BooleanField(default=False, db_index=True)
    prefecture = models.ForeignKey(
        Prefecture,
        on_delete=models.PROTECT,
        related_name="places",
    )
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=160)
    description = models.TextField()
    image = models.ImageField(
        blank=True,
        null=True,
        verbose_name="Place Image",
        upload_to=place_image_upload_path,
        validators=[validate_image_size, validate_image_safety],
    )

    city = models.CharField(max_length=100, blank=True)
    google_maps_url = models.URLField(blank=True)
    official_website = models.URLField(blank=True)
    travel_tips = models.TextField(blank=True)
    best_season = models.CharField(
        max_length=20,
        choices=Season.choices,
        default=Season.YEAR_ROUND,
    )
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
        validators=[MinValueValidator(-90), MaxValueValidator(90)],
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
        validators=[MinValueValidator(-180), MaxValueValidator(180)],
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="reviewed_places",
        blank=True,
        null=True,
        editable=False,
    )
    reviewed_at = models.DateTimeField(blank=True, null=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-created_at"], name="place_status_created_idx"),
            models.Index(fields=["prefecture", "status"], name="place_pref_status_idx"),
            models.Index(fields=["status", "best_season"], name="place_status_season_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["prefecture", "slug"],
                name="unique_place_slug_per_prefecture",
            )
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        old_image = None

        if self.pk:
            old_place = Place.objects.filter(pk=self.pk).first()
            if old_place:
                old_image = old_place.image

        super().save(*args, **kwargs)

        if old_image and old_image != self.image:
            if old_image.storage.exists(old_image.name):
                old_image.delete(save=False)

        process_model_image(self)

    def delete(self, *args, **kwargs):
        if self.image:
            if self.image.storage.exists(self.image.name):
                self.image.delete(save=False)

        super().delete(*args, **kwargs)


class PlaceRevision(models.Model):
    """A proposed edit that never mutates its published place before approval."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending Review"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    place = models.ForeignKey(Place, on_delete=models.CASCADE, related_name="revisions")
    submitted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="submitted_place_revisions",
        blank=True,
        null=True,
    )
    prefecture = models.ForeignKey(Prefecture, on_delete=models.PROTECT, related_name="place_revisions")
    name = models.CharField(max_length=120)
    description = models.TextField()
    image = models.ImageField(
        blank=True,
        null=True,
        upload_to=place_revision_image_upload_path,
        validators=[validate_image_size, validate_image_safety],
        help_text="Optional replacement for the currently published cover image.",
    )
    city = models.CharField(max_length=100, blank=True)
    google_maps_url = models.URLField(blank=True)
    official_website = models.URLField(blank=True)
    travel_tips = models.TextField(blank=True)
    best_season = models.CharField(
        max_length=20,
        choices=Place.Season.choices,
        default=Place.Season.YEAR_ROUND,
    )
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
        validators=[MinValueValidator(-90), MaxValueValidator(90)],
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
        validators=[MinValueValidator(-180), MaxValueValidator(180)],
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    review_note = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="reviewed_place_revisions",
        blank=True,
        null=True,
        editable=False,
    )
    reviewed_at = models.DateTimeField(blank=True, null=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at", "-pk")
        indexes = [models.Index(fields=("status", "-updated_at"), name="revision_status_updated_idx")]
        constraints = [
            models.UniqueConstraint(
                fields=("place",),
                condition=models.Q(status="pending"),
                name="unique_pending_revision_per_place",
            )
        ]

    def __str__(self):
        return f"Proposed changes to {self.place}"

    def save(self, *args, **kwargs):
        old_image = None
        if self.pk:
            old_image = PlaceRevision.objects.filter(pk=self.pk).values_list("image", flat=True).first()
        super().save(*args, **kwargs)
        process_model_image(self)
        if old_image and old_image != self.image.name and self.image.storage.exists(old_image):
            self.image.storage.delete(old_image)


class PlaceRevisionImage(models.Model):
    """A gallery image held with a revision until the edit is approved."""

    revision = models.ForeignKey(PlaceRevision, on_delete=models.CASCADE, related_name="gallery_images")
    image = models.ImageField(
        upload_to=place_revision_gallery_upload_path,
        validators=[validate_image_size, validate_image_safety],
    )
    thumbnail = models.ImageField(
        upload_to=place_revision_thumbnail_upload_path,
        blank=True,
        editable=False,
    )
    caption = models.CharField(max_length=160, blank=True)
    display_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("display_order", "pk")

    def save(self, *args, **kwargs):
        old_image = None
        old_thumbnail = None
        if self.pk:
            previous = PlaceRevisionImage.objects.filter(pk=self.pk).values("image", "thumbnail").first()
            if previous:
                old_image = previous["image"]
                old_thumbnail = previous["thumbnail"]
        super().save(*args, **kwargs)
        process_model_image(self)
        generate_gallery_thumbnail(self)
        if old_image and old_image != self.image.name and self.image.storage.exists(old_image):
            self.image.storage.delete(old_image)
        if old_thumbnail and old_thumbnail != self.thumbnail.name and self.thumbnail.storage.exists(old_thumbnail):
            self.thumbnail.storage.delete(old_thumbnail)


class PlaceImage(models.Model):
    """Additional ordered images for a place gallery."""

    place = models.ForeignKey(Place, on_delete=models.CASCADE, related_name="gallery_images")
    image = models.ImageField(upload_to=place_gallery_upload_path, validators=[validate_image_size, validate_image_safety])
    thumbnail = models.ImageField(upload_to=place_thumbnail_upload_path, blank=True, editable=False)
    caption = models.CharField(max_length=160, blank=True)
    display_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("display_order", "pk")
        indexes = [models.Index(fields=("place", "display_order"), name="gallery_place_order_idx")]

    def save(self, *args, **kwargs):
        old_image = None
        old_thumbnail = None
        if self.pk:
            previous = PlaceImage.objects.filter(pk=self.pk).values("image", "thumbnail").first()
            if previous:
                old_image = previous["image"]
                old_thumbnail = previous["thumbnail"]
        super().save(*args, **kwargs)
        process_model_image(self)
        generate_gallery_thumbnail(self)
        if old_image and old_image != self.image.name and self.image.storage.exists(old_image):
            self.image.storage.delete(old_image)
        if old_thumbnail and old_thumbnail != self.thumbnail.name and self.thumbnail.storage.exists(old_thumbnail):
            self.thumbnail.storage.delete(old_thumbnail)

    def delete(self, *args, **kwargs):
        if self.image and self.image.storage.exists(self.image.name):
            self.image.delete(save=False)
        if self.thumbnail and self.thumbnail.storage.exists(self.thumbnail.name):
            self.thumbnail.delete(save=False)
        super().delete(*args, **kwargs)

    def __str__(self):
        return f"Image for {self.place}"


class Review(models.Model):
    place = models.ForeignKey(
        Place,
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["place", "-created_at"], name="review_place_created_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["place", "author"],
                name="unique_review_per_place_author",
            )
        ]

    def __str__(self):
        return f"{self.author} review of {self.place} ({self.rating}/5)"


class Profile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    nickname = models.CharField(max_length=80, blank=True)
    # Verification belongs to the existing one-to-one account extension. This
    # avoids an unsafe mid-project swap of Django's established User model.
    email_verified = models.BooleanField(default=False, db_index=True)
    email_verified_at = models.DateTimeField(blank=True, null=True)
    email_verification_nonce = models.UUIDField(default=uuid.uuid4, editable=False)
    email_verification_sent_at = models.DateTimeField(blank=True, null=True)
    password_reset_sent_at = models.DateTimeField(blank=True, null=True)
    terms_accepted_version = models.CharField(max_length=32, blank=True, null=True)
    privacy_accepted_version = models.CharField(max_length=32, blank=True, null=True)
    legal_accepted_at = models.DateTimeField(blank=True, null=True)
    profile_image = models.ImageField(
        upload_to=profile_image_upload_path,
        blank=True,
        null=True,
        validators=[validate_image_size, validate_image_safety],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def display_name(self):
        return self.nickname.strip() or self.user.username

    def __str__(self):
        return f"Profile for {self.display_name}"

    def save(self, *args, **kwargs):
        old_image = None

        if self.pk:
            old_profile = Profile.objects.filter(pk=self.pk).first()
            if old_profile:
                old_image = old_profile.profile_image

        super().save(*args, **kwargs)

        if old_image and old_image != self.profile_image:
            if old_image.storage.exists(old_image.name):
                old_image.delete(save=False)

        process_profile_image(self)


class Favorite(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="favorites")
    place = models.ForeignKey(Place, on_delete=models.CASCADE, related_name="favorited_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [models.UniqueConstraint(fields=("user", "place"), name="unique_user_favorite")]


class VisitedPlace(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="visited_places")
    place = models.ForeignKey(Place, on_delete=models.CASCADE, related_name="visitors")
    visited_on = models.DateField(blank=True, null=True)
    notes = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-visited_on", "-created_at")
        constraints = [models.UniqueConstraint(fields=("user", "place"), name="unique_user_visited_place")]


class Follow(models.Model):
    follower = models.ForeignKey(User, on_delete=models.CASCADE, related_name="following")
    following = models.ForeignKey(User, on_delete=models.CASCADE, related_name="followers")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("follower", "following"), name="unique_user_follow"),
            models.CheckConstraint(condition=~models.Q(follower=models.F("following")), name="prevent_self_follow"),
        ]


class ReviewVote(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="review_votes")
    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name="helpful_votes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("user", "review"), name="unique_review_helpful_vote")]


class ContentReport(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        RESOLVED = "resolved", "Resolved"
        DISMISSED = "dismissed", "Dismissed"

    reporter = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="content_reports",
        blank=True,
        null=True,
    )
    place = models.ForeignKey(Place, on_delete=models.CASCADE, related_name="reports", blank=True, null=True)
    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name="reports", blank=True, null=True)
    reason = models.CharField(max_length=500)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(blank=True, null=True)
    resolved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="resolved_content_reports",
        blank=True,
        null=True,
        editable=False,
    )

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("status", "-created_at"), name="report_status_created_idx")]

    def clean(self):
        if bool(self.place_id) == bool(self.review_id):
            raise ValidationError("A report must target exactly one place or review.")


class Collection(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="collections")
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=500, blank=True)
    is_public = models.BooleanField(default=False)
    places = models.ManyToManyField(Place, through="CollectionPlace", related_name="collections")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at",)
        constraints = [models.UniqueConstraint(fields=("owner", "name"), name="unique_owner_collection_name")]


class CollectionPlace(models.Model):
    collection = models.ForeignKey(Collection, on_delete=models.CASCADE, related_name="items")
    place = models.ForeignKey(Place, on_delete=models.CASCADE, related_name="collection_items")
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("collection", "place"), name="unique_collection_place")]


class Itinerary(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="itineraries")
    name = models.CharField(max_length=100)
    start_date = models.DateField(blank=True, null=True)
    is_public = models.BooleanField(default=False)
    places = models.ManyToManyField(Place, through="ItineraryStop", related_name="itineraries")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at",)


class ItineraryStop(models.Model):
    itinerary = models.ForeignKey(Itinerary, on_delete=models.CASCADE, related_name="stops")
    place = models.ForeignKey(Place, on_delete=models.CASCADE, related_name="itinerary_stops")
    day = models.PositiveSmallIntegerField(default=1)
    position = models.PositiveSmallIntegerField(default=0)
    notes = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ("day", "position", "pk")
        constraints = [models.UniqueConstraint(fields=("itinerary", "place"), name="unique_itinerary_place")]
        indexes = [models.Index(fields=("itinerary", "day", "position"), name="itinerary_stop_order_idx")]


class SupportTicketCounter(models.Model):
    """Internal daily counter used to issue readable, collision-free ticket IDs."""

    date = models.DateField(primary_key=True)
    last_number = models.PositiveIntegerField(default=0)


class SupportTicket(models.Model):
    """An immutable customer request with a small admin-managed workflow."""

    class Category(models.TextChoices):
        ACCOUNT = "account", "Account"
        PLACE_SUBMISSION = "place_submission", "Place Submission"
        REVIEW_ISSUE = "review_issue", "Review Issue"
        BUG_REPORT = "bug_report", "Bug Report"
        FEATURE_REQUEST = "feature_request", "Feature Request"
        REPORT_CONTENT = "report_content", "Report Content"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        NEW = "new", "New"
        IN_PROGRESS = "in_progress", "In Progress"
        WAITING_FOR_USER = "waiting_for_user", "Waiting for User"
        RESOLVED = "resolved", "Resolved"
        CLOSED = "closed", "Closed"

    ticket_id = models.CharField(max_length=20, unique=True, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="support_tickets",
        blank=True,
        null=True,
    )
    registered_email = models.EmailField(editable=False)
    contact_email = models.EmailField()
    category = models.CharField(max_length=32, choices=Category.choices)
    subject = models.CharField(max_length=180)
    related_url = models.URLField(max_length=500, blank=True)
    screenshot = models.ImageField(
        upload_to=support_screenshot_upload_path,
        blank=True,
        null=True,
        validators=[validate_support_screenshot_size, validate_image_safety],
    )
    message = models.TextField(validators=[MaxLengthValidator(5000)])
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.NEW)
    internal_notes = models.TextField(blank=True)
    assigned_administrator = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="assigned_support_tickets",
        blank=True,
        null=True,
        limit_choices_to={"is_staff": True},
    )
    deduplication_key = models.CharField(max_length=64, editable=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("status", "-created_at"), name="support_status_created_idx"),
            models.Index(fields=("category", "-created_at"), name="support_category_created_idx"),
            models.Index(fields=("user", "-created_at"), name="support_user_created_idx"),
        ]

    def __str__(self):
        return f"{self.ticket_id}: {self.subject}"
