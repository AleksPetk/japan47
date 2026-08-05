import shutil
import tempfile
from io import BytesIO
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.sessions.backends.db import SessionStore
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django_otp.plugins.otp_static.models import StaticDevice, StaticToken
from django_otp.plugins.otp_totp.models import TOTPDevice
from PIL import Image
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken
from travel.accounts.services import delete_user_account
from travel.models import (
    Collection,
    CollectionPlace,
    ContentReport,
    Favorite,
    Follow,
    Itinerary,
    ItineraryStop,
    Place,
    PlaceImage,
    PlaceRevision,
    Prefecture,
    Profile,
    Region,
    Review,
    ReviewVote,
    SupportTicket,
    VisitedPlace,
)

User = get_user_model()


class AccountDeletionTests(APITestCase):
    password = "StrongPass123!"

    def setUp(self):
        cache.clear()
        self.media_directory = tempfile.mkdtemp()
        self.media_override = override_settings(MEDIA_ROOT=self.media_directory)
        self.media_override.enable()
        self.addCleanup(self.media_override.disable)
        self.addCleanup(shutil.rmtree, self.media_directory, True)

        self.user = User.objects.create_user("traveler", "traveler@example.com", self.password)
        self.other = User.objects.create_user("other", "other@example.com", self.password)
        Profile.objects.filter(user=self.user).update(email_verified=True)
        self.region = Region.objects.create(name=Region.RegionName.KANTO, display_order=1)
        self.prefecture = Prefecture.objects.create(
            region=self.region, name="Tokyo", display_order=1
        )
        self.place = Place.objects.create(
            author=self.user,
            prefecture=self.prefecture,
            name="Community place",
            slug="community-place",
            description="A retained destination.",
            status=Place.Status.PUBLISHED,
        )

    @staticmethod
    def image_file(name="place.png"):
        buffer = BytesIO()
        Image.new("RGB", (80, 60), "red").save(buffer, format="PNG")
        return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")

    def authenticate(self, user=None):
        self.client.force_authenticate(user=user or self.user)

    def test_unauthenticated_deletion_is_rejected(self):
        response = self.client.post(
            "/api/v1/auth/account/delete/",
            {"password": self.password, "confirmation": "DELETE"},
        )
        self.assertEqual(response.status_code, 401)
        self.assertTrue(User.objects.filter(pk=self.user.pk).exists())

    def test_missing_and_wrong_password_are_rejected(self):
        self.authenticate()
        missing = self.client.post("/api/v1/auth/account/delete/", {"confirmation": "DELETE"})
        wrong = self.client.post(
            "/api/v1/auth/account/delete/",
            {"password": "WrongPass123!", "confirmation": "DELETE"},
        )
        self.assertEqual(missing.status_code, 400)
        self.assertIn("password", missing.json()["error"]["fields"])
        self.assertEqual(wrong.status_code, 400)
        self.assertIn("password", wrong.json()["error"]["fields"])
        self.assertTrue(User.objects.filter(pk=self.user.pk).exists())

    def test_wrong_confirmation_text_is_rejected(self):
        self.authenticate()
        response = self.client.post(
            "/api/v1/auth/account/delete/",
            {"password": self.password, "confirmation": "delete"},
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("confirmation", response.json()["error"]["fields"])
        self.assertTrue(User.objects.filter(pk=self.user.pk).exists())

    def test_password_verification_does_not_delete_account(self):
        self.authenticate()
        response = self.client.post(
            "/api/v1/auth/account/verify-password/", {"password": self.password}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"verified": True})
        self.assertTrue(User.objects.filter(pk=self.user.pk).exists())

    def test_staff_deletion_is_rejected(self):
        self.user.is_staff = True
        self.user.save(update_fields=("is_staff",))
        self.authenticate()
        response = self.client.post(
            "/api/v1/auth/account/delete/",
            {"password": self.password, "confirmation": "DELETE"},
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("privileges", str(response.json()["error"]["fields"]["account"]))
        self.assertTrue(User.objects.filter(pk=self.user.pk).exists())

    def test_superuser_deletion_is_rejected(self):
        self.user.is_superuser = True
        self.user.save(update_fields=("is_superuser",))
        self.authenticate()
        response = self.client.post(
            "/api/v1/auth/account/delete/",
            {"password": self.password, "confirmation": "DELETE"},
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("privileges", str(response.json()["error"]["fields"]["account"]))
        self.assertTrue(User.objects.filter(pk=self.user.pk).exists())

    def create_user_specific_data(self):
        profile = self.user.profile
        profile.profile_image = self.image_file("avatar.png")
        profile.save(update_fields=("profile_image",))
        profile_image_storage = profile.profile_image.storage
        profile_image_name = profile.profile_image.name
        place_image = PlaceImage.objects.create(place=self.place, image=self.image_file())
        user_review = Review.objects.create(
            place=self.place, author=self.user, rating=5, comment="Personal review"
        )
        other_review = Review.objects.create(
            place=self.place, author=self.other, rating=4, comment="Other review"
        )
        Favorite.objects.create(user=self.user, place=self.place)
        VisitedPlace.objects.create(user=self.user, place=self.place, notes="Personal notes")
        Follow.objects.create(follower=self.user, following=self.other)
        ReviewVote.objects.create(user=self.user, review=other_review)
        report = ContentReport.objects.create(
            reporter=self.user, place=self.place, reason="Moderation history"
        )
        collection = Collection.objects.create(owner=self.user, name="Saved trip")
        CollectionPlace.objects.create(collection=collection, place=self.place)
        itinerary = Itinerary.objects.create(owner=self.user, name="Tokyo day")
        ItineraryStop.objects.create(itinerary=itinerary, place=self.place)
        revision = PlaceRevision.objects.create(
            place=self.place,
            submitted_by=self.user,
            prefecture=self.prefecture,
            name=self.place.name,
            description="Pending retained edit",
        )
        ticket = SupportTicket.objects.create(
            ticket_id="SUP-20260726-0001",
            user=self.user,
            registered_email=self.user.email,
            contact_email=self.user.email,
            category=SupportTicket.Category.ACCOUNT,
            subject="Account help",
            related_url="https://example.com/private",
            message="Operational support history",
            deduplication_key="account-deletion-test",
            screenshot=self.image_file("support.png"),
        )
        screenshot_storage = ticket.screenshot.storage
        screenshot_name = ticket.screenshot.name
        TOTPDevice.objects.create(user=self.user, name="Phone", confirmed=True)
        static_device = StaticDevice.objects.create(user=self.user, name="Recovery")
        StaticToken.objects.create(device=static_device, token="one-use-code")
        session = SessionStore()
        session["_auth_user_id"] = str(self.user.pk)
        session["_auth_user_backend"] = "django.contrib.auth.backends.ModelBackend"
        session.save()
        return {
            "place_image": place_image,
            "user_review": user_review,
            "report": report,
            "revision": revision,
            "ticket": ticket,
            "profile_image_storage": profile_image_storage,
            "profile_image_name": profile_image_name,
            "screenshot_storage": screenshot_storage,
            "screenshot_name": screenshot_name,
            "session_key": session.session_key,
        }

    def test_normal_deletion_removes_personal_data_and_retains_public_content(self):
        records = self.create_user_specific_data()
        user_id = self.user.pk
        self.authenticate()
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                "/api/v1/auth/account/delete/",
                {"password": self.password, "confirmation": "DELETE"},
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["message"], "Your account has been permanently deleted.")
        self.assertFalse(User.objects.filter(pk=user_id).exists())
        self.assertFalse(Review.objects.filter(pk=records["user_review"].pk).exists())
        self.assertFalse(Favorite.objects.filter(user_id=user_id).exists())
        self.assertFalse(VisitedPlace.objects.filter(user_id=user_id).exists())
        self.assertFalse(Follow.objects.filter(follower_id=user_id).exists())
        self.assertFalse(ReviewVote.objects.filter(user_id=user_id).exists())
        self.assertFalse(Collection.objects.filter(owner_id=user_id).exists())
        self.assertFalse(Itinerary.objects.filter(owner_id=user_id).exists())
        self.assertFalse(Profile.objects.filter(user_id=user_id).exists())
        self.assertFalse(records["profile_image_storage"].exists(records["profile_image_name"]))
        self.assertFalse(records["screenshot_storage"].exists(records["screenshot_name"]))
        self.assertFalse(TOTPDevice.objects.filter(user_id=user_id).exists())
        self.assertFalse(StaticDevice.objects.filter(user_id=user_id).exists())

        self.place.refresh_from_db()
        self.assertIsNone(self.place.author_id)
        self.assertTrue(self.place.is_platform_managed)
        self.assertTrue(PlaceImage.objects.filter(pk=records["place_image"].pk).exists())
        records["revision"].refresh_from_db()
        self.assertIsNone(records["revision"].submitted_by_id)
        records["report"].refresh_from_db()
        self.assertIsNone(records["report"].reporter_id)
        records["ticket"].refresh_from_db()
        self.assertIsNone(records["ticket"].user_id)
        self.assertEqual(records["ticket"].registered_email, "deleted-user@japan47.invalid")
        self.assertEqual(records["ticket"].contact_email, "deleted-user@japan47.invalid")
        self.assertEqual(records["ticket"].subject, "Deleted user support request")
        self.assertEqual(
            records["ticket"].message,
            "User-submitted content removed following account deletion.",
        )
        self.assertEqual(records["ticket"].internal_notes, "")
        self.assertEqual(records["ticket"].deduplication_key, "deleted-user")
        self.assertFalse(
            self.client.session.model.objects.filter(session_key=records["session_key"]).exists()
        )

        public = APIClient().get(f"/api/v1/places/{self.place.pk}/")
        self.assertEqual(public.status_code, 200)
        self.assertEqual(public.json()["author"]["display_name"], "Japan47 Community")
        self.assertIsNone(public.json()["author"]["id"])
        self.assertFalse(public.json()["can_edit"])

    @patch("travel.api.views.users.send_verification_email")
    def test_deleted_username_and_email_can_be_registered_again(self, send_email):
        self.authenticate()
        deleted = self.client.post(
            "/api/v1/auth/account/delete/",
            {"password": self.password, "confirmation": "DELETE"},
        )
        self.assertEqual(deleted.status_code, 200)
        self.client.force_authenticate(user=None)
        registered = self.client.post(
            "/api/v1/auth/register/",
            {
                "username": "traveler",
                "email": "traveler@example.com",
                "password": self.password,
                "password2": self.password,
                "legal_consent": True,
            },
        )
        self.assertEqual(registered.status_code, 201)
        self.assertTrue(
            User.objects.filter(username="traveler", email="traveler@example.com").exists()
        )

    def test_existing_access_and_refresh_tokens_fail_after_deletion(self):
        refresh = RefreshToken.for_user(self.user)
        access = str(refresh.access_token)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        deleted = client.post(
            "/api/v1/auth/account/delete/",
            {"password": self.password, "confirmation": "DELETE"},
        )
        self.assertEqual(deleted.status_code, 200)
        self.assertTrue(BlacklistedToken.objects.exists())
        self.assertEqual(client.get("/api/v1/profile/").status_code, 401)
        self.assertEqual(
            APIClient().post("/api/v1/auth/refresh/", {"refresh": str(refresh)}).status_code,
            401,
        )

    def test_transaction_rollback_prevents_partial_deletion(self):
        records = self.create_user_specific_data()
        user_id = self.user.pk
        with patch.object(User, "delete", side_effect=RuntimeError("simulated failure")):
            with self.assertRaises(RuntimeError):
                delete_user_account(self.user)
        self.assertTrue(User.objects.filter(pk=user_id).exists())
        self.place.refresh_from_db()
        self.assertEqual(self.place.author_id, user_id)
        self.assertFalse(self.place.is_platform_managed)
        records["report"].refresh_from_db()
        self.assertEqual(records["report"].reporter_id, user_id)
        records["ticket"].refresh_from_db()
        self.assertEqual(records["ticket"].registered_email, "traveler@example.com")


class RegistrationConsentTests(APITestCase):
    password = "StrongPass123!"

    def setUp(self):
        cache.clear()

    def registration_data(self, **updates):
        values = {
            "username": "newtraveler",
            "email": "newtraveler@example.com",
            "password": self.password,
            "password2": self.password,
        }
        values.update(updates)
        return values

    def test_registration_without_or_with_false_consent_is_rejected(self):
        missing = self.client.post("/api/v1/auth/register/", self.registration_data())
        refused = self.client.post(
            "/api/v1/auth/register/", self.registration_data(legal_consent=False)
        )
        self.assertEqual(missing.status_code, 400)
        self.assertIn("legal_consent", missing.json()["error"]["fields"])
        self.assertEqual(refused.status_code, 400)
        self.assertIn("legal_consent", refused.json()["error"]["fields"])
        self.assertFalse(User.objects.filter(username="newtraveler").exists())

    @patch("travel.api.views.users.send_verification_email")
    def test_registration_stores_current_policy_versions_and_timestamp(self, send_email):
        response = self.client.post(
            "/api/v1/auth/register/", self.registration_data(legal_consent=True)
        )
        self.assertEqual(response.status_code, 201)
        profile = Profile.objects.get(user__username="newtraveler")
        self.assertEqual(profile.terms_accepted_version, settings.CURRENT_TERMS_VERSION)
        self.assertEqual(
            profile.privacy_accepted_version,
            settings.CURRENT_PRIVACY_POLICY_VERSION,
        )
        self.assertIsNotNone(profile.legal_accepted_at)

    def test_existing_users_are_not_backfilled_with_consent(self):
        existing = User.objects.create_user("existing", "existing@example.com", self.password)
        profile = existing.profile
        self.assertIsNone(profile.terms_accepted_version)
        self.assertIsNone(profile.privacy_accepted_version)
        self.assertIsNone(profile.legal_accepted_at)
