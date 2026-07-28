from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from travel.models import (
    Collection,
    CollectionPlace,
    ContentReport,
    Favorite,
    Itinerary,
    ItineraryStop,
    Place,
    PlaceDeletionRequest,
    PlaceImage,
    PlaceRevision,
    PlaceRevisionImage,
    Prefecture,
    Profile,
    Region,
    Review,
    VisitedPlace,
)
from travel.services import BADGE_LEVELS, get_contributor_stats
from travel.place_revisions import unique_place_slug
from travel.accounts.email_service import EmailDeliveryError
from travel.accounts.services import invalidate_user_refresh_tokens, normalize_email, normalize_username, send_verification_email

User = get_user_model()


class AbsoluteImageField(serializers.ImageField):
    def to_representation(self, value):
        url = super().to_representation(value)
        request = self.context.get("request")
        return request.build_absolute_uri(url) if url and request else url


class UserSummarySerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    profile_image_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "display_name", "profile_image_url")

    def get_display_name(self, obj) -> str:
        profile = getattr(obj, "profile", None)
        return profile.display_name if profile else obj.username

    def get_profile_image_url(self, obj) -> str | None:
        profile = getattr(obj, "profile", None)
        if not profile or not profile.profile_image:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(profile.profile_image.url) if request else profile.profile_image.url


class RegionSerializer(serializers.ModelSerializer):
    label = serializers.CharField(source="get_name_display", read_only=True)
    image_url = AbsoluteImageField(source="image", read_only=True)
    average_rating = serializers.FloatField(read_only=True, allow_null=True)
    prefecture_count = serializers.IntegerField(read_only=True)
    published_place_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Region
        fields = ("id", "name", "label", "description", "image_url", "display_order", "average_rating", "prefecture_count", "published_place_count")


class PrefectureSummarySerializer(serializers.ModelSerializer):
    image_url = AbsoluteImageField(source="image", read_only=True)
    average_rating = serializers.FloatField(read_only=True, allow_null=True)
    published_place_count = serializers.IntegerField(read_only=True)
    region = RegionSerializer(read_only=True)

    class Meta:
        model = Prefecture
        fields = ("id", "name", "description", "image_url", "display_order", "average_rating", "published_place_count", "region")


class ReviewSerializer(serializers.ModelSerializer):
    author = UserSummarySerializer(read_only=True)
    place_name = serializers.CharField(source="place.name", read_only=True)
    place_slug = serializers.CharField(source="place.slug", read_only=True)
    prefecture_name = serializers.CharField(source="place.prefecture.name", read_only=True)
    place_id = serializers.PrimaryKeyRelatedField(source="place", queryset=Place.objects.all())
    can_edit = serializers.SerializerMethodField()
    helpful_count = serializers.IntegerField(read_only=True, default=0)
    is_helpful = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ("id", "place_id", "place_name", "place_slug", "prefecture_name", "author", "rating", "comment", "created_at", "updated_at", "can_edit", "helpful_count", "is_helpful")
        read_only_fields = ("created_at", "updated_at")

    def validate_place(self, place):
        request = self.context["request"]
        if place.status != Place.Status.PUBLISHED and not (request.user.is_staff or place.author_id == request.user.id):
            raise serializers.ValidationError("Reviews can only be added to accessible places.")
        return place

    def validate(self, attrs):
        request = self.context.get("request")
        place = attrs.get("place", getattr(self.instance, "place", None))
        if place and place.status != Place.Status.PUBLISHED and not (
            request and request.user.is_authenticated and (request.user.is_staff or place.author_id == request.user.id)
        ):
            raise serializers.ValidationError({"place_id": "Reviews can only be added to accessible places."})
        if not self.instance and request and Review.objects.filter(place=place, author=request.user).exists():
            raise serializers.ValidationError({"place_id": "You have already reviewed this place."})
        return attrs

    def get_can_edit(self, obj) -> bool:
        user = self.context["request"].user
        return bool(user.is_authenticated and (user.is_superuser or user.is_staff or obj.author_id == user.id))

    def get_is_helpful(self, obj) -> bool:
        if hasattr(obj, "viewer_found_helpful"):
            return obj.viewer_found_helpful
        user = self.context["request"].user
        return bool(user.is_authenticated and obj.helpful_votes.filter(user=user).exists())


class PlaceImageSerializer(serializers.ModelSerializer):
    image_url = AbsoluteImageField(source="image", read_only=True)
    thumbnail_url = AbsoluteImageField(source="thumbnail", read_only=True)

    class Meta:
        model = PlaceImage
        fields = ("id", "image", "image_url", "thumbnail_url", "caption", "display_order")
        extra_kwargs = {"image": {"write_only": True}}


class PlaceRevisionImageSerializer(serializers.ModelSerializer):
    image_url = AbsoluteImageField(source="image", read_only=True)
    thumbnail_url = AbsoluteImageField(source="thumbnail", read_only=True)

    class Meta:
        model = PlaceRevisionImage
        fields = ("id", "image", "image_url", "thumbnail_url", "caption", "display_order")
        extra_kwargs = {"image": {"write_only": True}}


class PlaceRevisionSerializer(serializers.ModelSerializer):
    prefecture = PrefectureSummarySerializer(read_only=True)
    image_url = AbsoluteImageField(source="image", read_only=True)
    gallery_images = PlaceRevisionImageSerializer(many=True, read_only=True)
    removed_gallery_image_ids = serializers.PrimaryKeyRelatedField(
        source="removed_gallery_images", many=True, read_only=True
    )

    class Meta:
        model = PlaceRevision
        fields = (
            "id", "status", "review_note", "prefecture", "name", "description",
            "image_url", "remove_image", "removed_gallery_image_ids", "city", "google_maps_url", "official_website",
            "travel_tips", "best_season", "latitude", "longitude",
            "gallery_images", "created_at", "updated_at", "reviewed_at",
        )


class PlaceDeletionRequestCreateSerializer(serializers.Serializer):
    reason = serializers.CharField(
        allow_blank=False,
        max_length=1000,
        min_length=10,
        trim_whitespace=True,
    )


class PlaceDeletionRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlaceDeletionRequest
        fields = (
            "id", "status", "reason", "admin_note", "created_at", "reviewed_at",
        )
        read_only_fields = fields


class PlaceListSerializer(serializers.ModelSerializer):
    image_url = AbsoluteImageField(source="image", read_only=True)
    prefecture = PrefectureSummarySerializer(read_only=True)
    author = serializers.SerializerMethodField()
    average_rating = serializers.FloatField(read_only=True, allow_null=True)
    review_count = serializers.IntegerField(read_only=True)
    can_edit = serializers.SerializerMethodField()
    is_favorite = serializers.SerializerMethodField()
    is_visited = serializers.SerializerMethodField()

    class Meta:
        model = Place
        fields = ("id", "name", "slug", "description", "image_url", "city", "best_season", "status", "is_platform_managed", "created_at", "updated_at", "average_rating", "review_count", "prefecture", "author", "can_edit", "is_favorite", "is_visited")

    def get_author(self, obj) -> dict:
        if obj.author_id:
            return UserSummarySerializer(obj.author, context=self.context).data
        return {
            "id": None,
            "display_name": "Japan47 Community",
            "profile_image_url": None,
        }

    def get_can_edit(self, obj) -> bool:
        user = self.context["request"].user
        return bool(user.is_authenticated and (user.is_superuser or user.is_staff or obj.author_id == user.id))

    def get_is_favorite(self, obj) -> bool:
        if hasattr(obj, "viewer_has_favorite"):
            return obj.viewer_has_favorite
        user = self.context["request"].user
        return bool(user.is_authenticated and obj.favorited_by.filter(user=user).exists())

    def get_is_visited(self, obj) -> bool:
        if hasattr(obj, "viewer_has_visited"):
            return obj.viewer_has_visited
        user = self.context["request"].user
        return bool(user.is_authenticated and obj.visitors.filter(user=user).exists())


class PlaceDetailSerializer(PlaceListSerializer):
    reviews = ReviewSerializer(many=True, read_only=True)
    gallery_images = PlaceImageSerializer(many=True, read_only=True)
    latest_revision = serializers.SerializerMethodField()
    deletion_request = serializers.SerializerMethodField()

    class Meta(PlaceListSerializer.Meta):
        fields = PlaceListSerializer.Meta.fields + ("google_maps_url", "official_website", "travel_tips", "latitude", "longitude", "gallery_images", "reviews", "latest_revision", "deletion_request")

    def get_latest_revision(self, obj):
        request = self.context["request"]
        if not request.user.is_authenticated or not (
            request.user.is_superuser or request.user.is_staff or obj.author_id == request.user.id
        ):
            return None
        revisions = getattr(obj, "moderation_revisions", None)
        revision = revisions[0] if revisions else None
        return PlaceRevisionSerializer(revision, context=self.context).data if revision else None

    def get_deletion_request(self, obj):
        request = self.context["request"]
        if not request.user.is_authenticated or not (
            request.user.is_superuser or request.user.is_staff or obj.author_id == request.user.id
        ):
            return None
        requests = getattr(obj, "moderation_deletion_requests", None)
        deletion_request = requests[0] if requests else None
        if deletion_request is None:
            return None
        return PlaceDeletionRequestSerializer(deletion_request).data


class PlaceWriteSerializer(serializers.ModelSerializer):
    prefecture_id = serializers.PrimaryKeyRelatedField(source="prefecture", queryset=Prefecture.objects.all())
    image = serializers.ImageField(required=False, allow_null=True)
    remove_image = serializers.BooleanField(write_only=True, required=False)

    class Meta:
        model = Place
        fields = ("id", "prefecture_id", "name", "description", "image", "remove_image", "city", "google_maps_url", "official_website", "travel_tips", "best_season", "latitude", "longitude", "slug", "status")
        read_only_fields = ("id", "slug", "status")

    def validate(self, attrs):
        if attrs.get("remove_image") and attrs.get("image"):
            raise serializers.ValidationError({"image": "Choose a replacement image or remove the current image, not both."})
        return attrs

    def _unique_slug(self, name, prefecture):
        return unique_place_slug(name, prefecture, exclude_place=self.instance)

    def create(self, validated_data):
        validated_data.pop("remove_image", None)
        validated_data["author"] = self.context["request"].user
        validated_data["slug"] = self._unique_slug(validated_data["name"], validated_data["prefecture"])
        return super().create(validated_data)

    def update(self, instance, validated_data):
        request = self.context["request"]
        remove_image = validated_data.pop("remove_image", serializers.empty)
        # Every public-client edit to an approved place is moderated. Staff
        # may still make deliberate direct corrections through Django admin,
        # but React and other API clients never bypass the revision workflow.
        if instance.status == Place.Status.PUBLISHED:
            with transaction.atomic():
                live_place = Place.objects.select_for_update().get(pk=instance.pk)
                revision = PlaceRevision.objects.select_for_update().filter(
                    place=live_place,
                    status=PlaceRevision.Status.PENDING,
                ).first()
                if revision is None:
                    revision = PlaceRevision(
                        place=live_place,
                        submitted_by=request.user,
                        prefecture=live_place.prefecture,
                        name=live_place.name,
                        description=live_place.description,
                        city=live_place.city,
                        google_maps_url=live_place.google_maps_url,
                        official_website=live_place.official_website,
                        travel_tips=live_place.travel_tips,
                        best_season=live_place.best_season,
                        latitude=live_place.latitude,
                        longitude=live_place.longitude,
                    )
                revision.submitted_by = request.user
                if remove_image is not serializers.empty:
                    revision.remove_image = remove_image
                if validated_data.get("image"):
                    revision.remove_image = False
                for field, value in validated_data.items():
                    setattr(revision, field, value)
                revision.save()
                self.pending_revision = revision
            return instance

        if remove_image is True:
            validated_data["image"] = None
        prefecture = validated_data.get("prefecture", instance.prefecture)
        name = validated_data.get("name", instance.name)
        validated_data["slug"] = self._unique_slug(name, prefecture)
        updated = super().update(instance, validated_data)
        if not request.user.is_staff and updated.status == Place.Status.REJECTED:
            updated.status = Place.Status.PENDING
            updated.reviewed_by = None
            updated.reviewed_at = None
            updated.save(update_fields=("status", "reviewed_by", "reviewed_at", "updated_at"))
        return updated


class ProfileSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", required=False)
    display_name = serializers.CharField(read_only=True)
    profile_image_url = AbsoluteImageField(source="profile_image", read_only=True)
    profile_image = serializers.ImageField(write_only=True, required=False, allow_null=True)
    joined_at = serializers.DateTimeField(source="user.date_joined", read_only=True)
    stats = serializers.SerializerMethodField()
    places = serializers.SerializerMethodField()
    reviews = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    follower_count = serializers.IntegerField(read_only=True)
    following_count = serializers.IntegerField(read_only=True)
    is_following = serializers.BooleanField(read_only=True)
    favorites = serializers.SerializerMethodField()
    recent_activity = serializers.SerializerMethodField()
    email_verified = serializers.BooleanField(read_only=True)

    class Meta:
        model = Profile
        fields = ("id", "username", "email", "email_verified", "nickname", "display_name", "profile_image", "profile_image_url", "joined_at", "stats", "places", "reviews", "is_owner", "follower_count", "following_count", "is_following", "favorites", "recent_activity")

    def get_is_owner(self, obj) -> bool:
        return self.context["request"].user == obj.user

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not self.get_is_owner(instance):
            data.pop("email", None)
            data.pop("email_verified", None)
            data.pop("username", None)
        return data

    def get_stats(self, obj) -> dict:
        stats = get_contributor_stats(obj.published_place_count, obj.contributor_review_count)
        if self.get_is_owner(obj):
            stats.update({
                "favorite_count": obj.favorite_count,
                "visited_count": obj.visited_count,
                "prefectures_visited": obj.prefectures_visited,
                "prefecture_coverage_percent": round(obj.prefectures_visited / 47 * 100, 1),
            })
        return stats

    def get_places(self, obj) -> list:
        return PlaceListSerializer(obj.profile_places, many=True, context=self.context).data

    def get_reviews(self, obj) -> list:
        return ReviewSerializer(obj.profile_reviews, many=True, context=self.context).data

    def get_favorites(self, obj) -> list:
        if not self.get_is_owner(obj):
            return []
        return PlaceListSerializer(obj.favorite_places, many=True, context=self.context).data

    def get_recent_activity(self, obj) -> list:
        activities = [
            {"type": "place", "label": place.name, "date": place.created_at}
            for place in obj.profile_places[:5]
        ] + [
            {"type": "review", "label": review.place.name, "date": review.created_at}
            for review in obj.profile_reviews[:5]
        ]
        return sorted(activities, key=lambda item: item["date"], reverse=True)[:6]

    def validate_email(self, value):
        user = self.instance.user
        if User.objects.filter(email__iexact=value).exclude(pk=user.pk).exists():
            raise serializers.ValidationError("This email is already in use.")
        return normalize_email(value)

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        email_changed = False
        if "email" in user_data:
            new_email = normalize_email(user_data["email"])
            email_changed = instance.user.email.casefold() != new_email.casefold()
            instance.user.email = new_email
            instance.user.save(update_fields=["email"])
            if email_changed:
                # The user post-save hook revoked verification in the database;
                # refresh before saving Profile fields so stale state cannot undo it.
                instance.refresh_from_db()
        instance = super().update(instance, validated_data)
        if email_changed:
            invalidate_user_refresh_tokens(instance.user)
            try:
                send_verification_email(instance.user)
            except EmailDeliveryError:
                # The account remains safely unverified; the generic resend flow
                # lets the owner retry without rolling back their requested email.
                pass
        return instance


class RegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    password2 = serializers.CharField(write_only=True, trim_whitespace=False)
    legal_consent = serializers.BooleanField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ("id", "username", "email", "password", "password2", "legal_consent")
        extra_kwargs = {"email": {"required": True}}

    def validate_username(self, value):
        value = normalize_username(value)
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email is already in use.")
        return normalize_email(value)

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password2": "Passwords do not match."})
        if attrs["legal_consent"] is not True:
            raise serializers.ValidationError({
                "legal_consent": "You must agree to the Terms of Use and Privacy Policy."
            })
        validate_password(attrs["password"])
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        validated_data.pop("password2")
        validated_data.pop("legal_consent")
        validated_data["username"] = normalize_username(validated_data["username"])
        validated_data["email"] = normalize_email(validated_data["email"])
        user = User.objects.create_user(**validated_data)
        Profile.objects.filter(user=user).update(
            terms_accepted_version=settings.CURRENT_TERMS_VERSION,
            privacy_accepted_version=settings.CURRENT_PRIVACY_POLICY_VERSION,
            legal_accepted_at=timezone.now(),
        )
        return user


class HealthSerializer(serializers.Serializer):
    status = serializers.CharField()
    service = serializers.CharField()
    version = serializers.CharField()


class LogoutRequestSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class BadgeSerializer(serializers.Serializer):
    name = serializers.CharField()
    filename = serializers.CharField()
    minimum_points = serializers.IntegerField()
    image_url = serializers.URLField()


class HomeResponseSerializer(serializers.Serializer):
    stats = serializers.DictField()
    latest_places = PlaceListSerializer(many=True)
    top_places = PlaceListSerializer(many=True)
    top_prefectures = PrefectureSummarySerializer(many=True)
    top_regions = RegionSerializer(many=True)
    top_contributors = serializers.ListField(child=serializers.DictField())


class SearchResponseSerializer(serializers.Serializer):
    regions = RegionSerializer(many=True)
    prefectures = PrefectureSummarySerializer(many=True)
    places = PlaceListSerializer(many=True)


class FavoriteSerializer(serializers.ModelSerializer):
    place = PlaceListSerializer(read_only=True)
    place_id = serializers.PrimaryKeyRelatedField(
        source="place", queryset=Place.objects.filter(status=Place.Status.PUBLISHED), write_only=True
    )

    class Meta:
        model = Favorite
        fields = ("id", "place", "place_id", "created_at")
        read_only_fields = ("created_at",)

    def validate_place_id(self, place):
        if Favorite.objects.filter(user=self.context["request"].user, place=place).exists():
            raise serializers.ValidationError("This place is already saved.")
        return place


class VisitedPlaceSerializer(serializers.ModelSerializer):
    place = PlaceListSerializer(read_only=True)
    place_id = serializers.PrimaryKeyRelatedField(
        source="place", queryset=Place.objects.filter(status=Place.Status.PUBLISHED), write_only=True
    )

    class Meta:
        model = VisitedPlace
        fields = ("id", "place", "place_id", "visited_on", "notes", "created_at")
        read_only_fields = ("created_at",)

    def validate_place_id(self, place):
        if VisitedPlace.objects.filter(user=self.context["request"].user, place=place).exists():
            raise serializers.ValidationError("This place is already marked as visited.")
        return place


class CollectionSerializer(serializers.ModelSerializer):
    places = PlaceListSerializer(many=True, read_only=True)
    place_ids = serializers.PrimaryKeyRelatedField(
        source="places",
        queryset=Place.objects.filter(status=Place.Status.PUBLISHED),
        many=True,
        write_only=True,
        required=False,
    )

    class Meta:
        model = Collection
        fields = ("id", "name", "description", "is_public", "places", "place_ids", "created_at", "updated_at")
        read_only_fields = ("created_at", "updated_at")

    def validate_name(self, name):
        queryset = Collection.objects.filter(
            owner=self.context["request"].user, name=name.strip()
        )
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("You already have a collection with this name.")
        return name.strip()

    def _save_places(self, collection, places):
        if places is not None:
            CollectionPlace.objects.filter(collection=collection).delete()
            CollectionPlace.objects.bulk_create(
                [CollectionPlace(collection=collection, place=place) for place in places]
            )

    def create(self, validated_data):
        places = validated_data.pop("places", [])
        collection = Collection.objects.create(owner=self.context["request"].user, **validated_data)
        self._save_places(collection, places)
        return collection

    def update(self, instance, validated_data):
        places = validated_data.pop("places", None)
        instance = super().update(instance, validated_data)
        self._save_places(instance, places)
        return instance


class ItineraryStopSerializer(serializers.ModelSerializer):
    place = PlaceListSerializer(read_only=True)
    place_id = serializers.PrimaryKeyRelatedField(
        source="place", queryset=Place.objects.filter(status=Place.Status.PUBLISHED), write_only=True
    )

    class Meta:
        model = ItineraryStop
        fields = ("id", "place", "place_id", "day", "position", "notes")

    def validate_place_id(self, place):
        itinerary = self.context.get("itinerary")
        if itinerary and itinerary.stops.filter(place=place).exists():
            raise serializers.ValidationError("This place is already in the itinerary.")
        return place


class ItinerarySerializer(serializers.ModelSerializer):
    stops = ItineraryStopSerializer(many=True, read_only=True)

    class Meta:
        model = Itinerary
        fields = ("id", "name", "start_date", "is_public", "stops", "created_at", "updated_at")
        read_only_fields = ("created_at", "updated_at")


class ContentReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentReport
        fields = ("id", "place", "review", "reason", "status", "created_at")
        read_only_fields = ("status", "created_at")

    def validate(self, attrs):
        if bool(attrs.get("place")) == bool(attrs.get("review")):
            raise serializers.ValidationError("Choose exactly one place or review.")
        return attrs


def badge_catalog(request=None):
    return [
        {
            **level,
            "image_url": f"{settings.FRONTEND_URL}/images/badges/{level['filename']}",
        }
        for level in BADGE_LEVELS
    ]
