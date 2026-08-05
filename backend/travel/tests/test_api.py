import shutil
import tempfile
from io import BytesIO
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.http import JsonResponse
from django.test import override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django_otp import DEVICE_ID_SESSION_KEY
from django_otp.plugins.otp_totp.models import TOTPDevice
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase
from travel.accounts.tokens import make_email_verification_token
from travel.models import (
    Collection,
    ContentReport,
    Favorite,
    Follow,
    Place,
    PlaceDeletionRequest,
    PlaceImage,
    PlaceRevision,
    PlaceRevisionImage,
    Prefecture,
    Region,
    Review,
    ReviewVote,
    SupportTicket,
    VisitedPlace,
)
from travel.place_deletions import approve_place_deletion, reject_place_deletion
from travel.place_revisions import approve_place_revision
from travel.services import bayesian_rating, get_badge_progress, get_contributor_stats

User = get_user_model()


class ApiFixture(APITestCase):
    def setUp(self):
        self.author = User.objects.create_user("author", "author@example.com", "StrongPass123!")
        self.other = User.objects.create_user("other", "other@example.com", "StrongPass123!")
        self.staff = User.objects.create_user(
            "staff", "staff@example.com", "StrongPass123!", is_staff=True
        )
        self.region = Region.objects.create(name=Region.RegionName.KANTO, display_order=1)
        self.prefecture = Prefecture.objects.create(
            region=self.region, name="Tokyo", display_order=1
        )
        self.published = Place.objects.create(
            author=self.author,
            prefecture=self.prefecture,
            name="Akihabara",
            slug="akihabara",
            description="Electric town.",
            status=Place.Status.PUBLISHED,
        )
        self.pending = Place.objects.create(
            author=self.author,
            prefecture=self.prefecture,
            name="Pending place",
            slug="pending-place",
            description="Awaiting moderation.",
        )

    def authenticate(self, user=None):
        self.client.force_authenticate(user=user or self.author)

    def verify_admin_session(self, user=None):
        user = user or self.staff
        device = TOTPDevice.objects.create(user=user, name="Test authenticator", confirmed=True)
        session = self.client.session
        session[DEVICE_ID_SESSION_KEY] = device.persistent_id
        session.save()
        return device


class PublicApiTests(ApiFixture):
    def test_home_cache_rebuilds_media_urls_for_each_request_host(self):
        Place.objects.filter(pk=self.published.pk).update(image="place_images/cache-host-test.jpg")
        self.published.refresh_from_db()
        cache.clear()

        with override_settings(ALLOWED_HOSTS=["localhost", "phone.test"]):
            local = self.client.get("/api/v1/home/", HTTP_HOST="localhost:5173")
            phone = self.client.get("/api/v1/home/", HTTP_HOST="phone.test:5173")

        self.assertEqual(local.status_code, 200)
        self.assertEqual(phone.status_code, 200)
        self.assertTrue(
            local.json()["latest_places"][0]["image_url"].startswith("http://localhost:5173/media/")
        )
        self.assertTrue(
            phone.json()["latest_places"][0]["image_url"].startswith(
                "http://phone.test:5173/media/"
            )
        )

    def test_health_and_public_resource_endpoints(self):
        health = self.client.get("/api/v1/health/")
        self.assertIsInstance(health, JsonResponse)
        self.assertEqual(health.json()["status"], "ok")
        regions = self.client.get("/api/v1/regions/")
        prefectures = self.client.get("/api/v1/prefectures/")
        self.assertIsInstance(regions, JsonResponse)
        self.assertIsInstance(prefectures, JsonResponse)
        self.assertEqual(len(regions.json()), 1)
        self.assertEqual(len(prefectures.json()), 1)
        places = self.client.get("/api/v1/places/").data
        self.assertEqual(places["count"], 1)
        self.assertEqual(places["results"][0]["name"], "Akihabara")

    def test_hand_written_api_views_return_json_responses(self):
        paths = (
            "/api/v1/health/",
            "/api/v1/home/",
            "/api/v1/search/?q=Tokyo",
            "/api/v1/badges/",
            "/api/v1/regions/",
            f"/api/v1/regions/{self.region.name}/",
            "/api/v1/prefectures/",
            f"/api/v1/prefectures/{self.prefecture.name}/",
        )
        for path in paths:
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertIsInstance(response, JsonResponse)
                self.assertEqual(response["Content-Type"], "application/json")

    def test_api_does_not_render_html(self):
        response = self.client.get("/api/v1/regions/", HTTP_ACCEPT="text/html")
        self.assertEqual(response.status_code, status.HTTP_406_NOT_ACCEPTABLE)
        self.assertEqual(response["Content-Type"], "application/json")

    def test_pending_detail_is_private_to_owner_and_staff(self):
        url = f"/api/v1/places/{self.pending.pk}/"
        self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND)
        self.authenticate(self.other)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND)
        self.authenticate(self.author)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_200_OK)
        self.authenticate(self.staff)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_200_OK)

    def test_filter_search_order_and_pagination_contract(self):
        Review.objects.create(place=self.published, author=self.other, rating=5)
        response = self.client.get(
            "/api/v1/places/", {"search": "Tokyo", "min_rating": 4, "ordering": "-average_rating"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["page"], 1)
        self.assertEqual(response.data["results"][0]["average_rating"], 5.0)

    def test_public_profile_does_not_expose_private_account_fields(self):
        self.author.profile.nickname = "Tokyo Guide"
        self.author.profile.save()
        response = self.client.get(f"/api/v1/contributors/{self.author.pk}/")
        self.assertIsInstance(response, JsonResponse)
        data = response.json()
        self.assertEqual(data["display_name"], "Tokyo Guide")
        self.assertNotIn("email", data)
        self.assertNotIn("username", data)
        self.assertNotIn("Pending place", str(data))


class AuthenticationApiTests(ApiFixture):
    def setUp(self):
        super().setUp()
        cache.clear()

    def tearDown(self):
        cache.clear()
        super().tearDown()

    @patch("travel.api.views.users.send_verification_email")
    def test_registration_lowercases_username_and_login_ignores_case(self, send_email):
        response = self.client.post(
            "/api/v1/auth/register/",
            {
                "username": "  MixedCaseUser  ",
                "email": "mixed-case@example.com",
                "password": "StrongPass123!",
                "password2": "StrongPass123!",
                "legal_consent": True,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email="mixed-case@example.com")
        self.assertEqual(user.username, "mixedcaseuser")
        user.profile.email_verified = True
        user.profile.save(update_fields=("email_verified", "updated_at"))

        for entered_username in ("mixedcaseuser", "MixedCaseUser", "MiXeDcAsEuSeR"):
            with self.subTest(entered_username=entered_username):
                login = self.client.post(
                    "/api/v1/auth/login/",
                    {
                        "username": entered_username,
                        "password": "StrongPass123!",
                    },
                )
                self.assertEqual(login.status_code, status.HTTP_200_OK)
                self.assertIn("access", login.json())

    def test_legacy_mixed_case_username_login_ignores_case(self):
        self.author.username = "LegacyAleks"
        self.author.save(update_fields=("username",))
        self.author.profile.email_verified = True
        self.author.profile.save(update_fields=("email_verified", "updated_at"))

        response = self.client.post(
            "/api/v1/auth/login/",
            {
                "username": "lEgAcYaLeKs",
                "password": "StrongPass123!",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch("travel.api.views.users.send_verification_email")
    def test_registration_requires_verification_then_login_refresh_me_and_logout(self, send_email):
        register = self.client.post(
            "/api/v1/auth/register/",
            {
                "username": "newuser",
                "email": "New@Example.com",
                "password": "StrongPass123!",
                "password2": "StrongPass123!",
                "legal_consent": True,
            },
        )
        self.assertEqual(register.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username="newuser")
        self.assertEqual(user.email, "new@example.com")
        self.assertFalse(user.profile.email_verified)
        self.assertNotIn("access", register.json())
        send_email.assert_called_once_with(user)

        blocked = self.client.post(
            "/api/v1/auth/login/", {"username": "newuser", "password": "StrongPass123!"}
        )
        self.assertEqual(blocked.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(blocked.json()["error"]["code"], "EMAIL_NOT_VERIFIED")

        user.profile.email_verified = True
        user.profile.save(update_fields=("email_verified", "updated_at"))
        login = self.client.post(
            "/api/v1/auth/login/", {"username": "newuser", "password": "StrongPass123!"}
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        access, refresh = login.json()["access"], login.json()["refresh"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        profile = self.client.get("/api/v1/profile/")
        self.assertIsInstance(profile, JsonResponse)
        self.assertEqual(profile.json()["email"], "new@example.com")
        logout = self.client.post("/api/v1/auth/logout/", {"refresh": refresh})
        self.assertIsInstance(logout, JsonResponse)
        self.assertEqual(logout.status_code, 204)
        self.assertEqual(logout.content, b"")
        self.assertEqual(
            self.client.post("/api/v1/auth/refresh/", {"refresh": refresh}).status_code, 401
        )

    def test_registration_returns_field_errors(self):
        response = self.client.post(
            "/api/v1/auth/register/",
            {
                "username": "newuser",
                "email": "invalid",
                "password": "short",
                "password2": "different",
                "legal_consent": True,
            },
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"]["code"], "validation_error")
        self.assertIn("email", response.data["error"]["fields"])

    @patch("travel.api.views.users.send_verification_email")
    def test_registration_email_is_unique_ignoring_case(self, send_email):
        first = self.client.post(
            "/api/v1/auth/register/",
            {
                "username": "caseone",
                "email": "Person@Example.com",
                "password": "StrongPass123!",
                "password2": "StrongPass123!",
                "legal_consent": True,
            },
        )
        second = self.client.post(
            "/api/v1/auth/register/",
            {
                "username": "casetwo",
                "email": "person@example.com",
                "password": "StrongPass123!",
                "password2": "StrongPass123!",
                "legal_consent": True,
            },
        )
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 400)
        self.assertIn("email", second.json()["error"]["fields"])

    @patch("travel.api.serializers.send_verification_email")
    def test_changing_email_requires_reverification_and_revokes_refresh(self, send_email):
        self.author.profile.email_verified = True
        self.author.profile.save(update_fields=("email_verified", "updated_at"))
        login = self.client.post(
            "/api/v1/auth/login/",
            {
                "username": "author",
                "password": "StrongPass123!",
            },
        )
        tokens = login.json()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        changed = self.client.patch("/api/v1/profile/", {"email": "NewAddress@Example.com"})
        self.assertEqual(changed.status_code, 200)
        self.assertEqual(changed.json()["email"], "newaddress@example.com")
        self.assertFalse(changed.json()["email_verified"])
        send_email.assert_called_once()
        self.client.credentials()
        refreshed = self.client.post("/api/v1/auth/refresh/", {"refresh": tokens["refresh"]})
        self.assertEqual(refreshed.status_code, 401)


class AccountRecoveryApiTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user("pending", "pending@example.com", "OldStrongPass123!")

    def tearDown(self):
        cache.clear()

    def test_valid_verification_token_is_single_use_and_already_verified_is_safe(self):
        token = make_email_verification_token(self.user)
        first = self.client.post("/api/v1/auth/verify-email/", {"token": token})
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json()["result"], "success")
        self.user.profile.refresh_from_db()
        self.assertTrue(self.user.profile.email_verified)
        self.assertIsNotNone(self.user.profile.email_verified_at)
        reused = self.client.post("/api/v1/auth/verify-email/", {"token": token})
        self.assertEqual(reused.status_code, 200)
        self.assertEqual(reused.json()["result"], "already_verified")

    @override_settings(EMAIL_VERIFICATION_TOKEN_MAX_AGE=-1)
    def test_expired_and_invalid_verification_tokens_are_rejected(self):
        token = make_email_verification_token(self.user)
        expired = self.client.post("/api/v1/auth/verify-email/", {"token": token})
        invalid = self.client.post("/api/v1/auth/verify-email/", {"token": "tampered-token"})
        self.assertEqual(expired.status_code, status.HTTP_410_GONE)
        self.assertEqual(expired.json()["result"], "expired")
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(invalid.json()["result"], "invalid")

    @patch("travel.accounts.services.send_verification_message")
    def test_resend_is_generic_and_obeys_account_cooldown(self, send_message):
        first = self.client.post(
            "/api/v1/auth/resend-verification/", {"email": "PENDING@EXAMPLE.COM"}
        )
        second = self.client.post(
            "/api/v1/auth/resend-verification/", {"email": "pending@example.com"}
        )
        missing = self.client.post(
            "/api/v1/auth/resend-verification/", {"email": "missing@example.com"}
        )
        self.assertEqual(
            (first.status_code, second.status_code, missing.status_code), (200, 200, 200)
        )
        self.assertEqual(first.json(), missing.json())
        self.assertEqual(send_message.call_count, 1)

    def test_resend_endpoint_is_rate_limited_by_ip(self):
        responses = [
            self.client.post(
                "/api/v1/auth/resend-verification/", {"email": f"missing{number}@example.com"}
            )
            for number in range(6)
        ]
        self.assertEqual([response.status_code for response in responses[:5]], [200] * 5)
        self.assertEqual(responses[5].status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    @patch("travel.accounts.services.send_password_reset_message")
    def test_forgot_password_never_reveals_account_existence(self, send_message):
        existing = self.client.post(
            "/api/v1/auth/password-reset/request/", {"email": "pending@example.com"}
        )
        missing = self.client.post(
            "/api/v1/auth/password-reset/request/", {"email": "nobody@example.com"}
        )
        self.assertEqual(existing.status_code, 200)
        self.assertEqual(existing.json(), missing.json())
        send_message.assert_called_once()

    def test_valid_password_reset_changes_password_and_token_cannot_be_reused(self):
        self.user.profile.email_verified = True
        self.user.profile.save(update_fields=("email_verified", "updated_at"))
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)
        payload = {
            "uid": uid,
            "token": token,
            "new_password": "NewStrongPass456!",
            "new_password2": "NewStrongPass456!",
        }
        changed = self.client.post("/api/v1/auth/password-reset/confirm/", payload)
        self.assertEqual(changed.status_code, 200)
        reused = self.client.post("/api/v1/auth/password-reset/confirm/", payload)
        self.assertEqual(reused.status_code, 400)
        self.assertEqual(
            self.client.post(
                "/api/v1/auth/login/", {"username": "pending", "password": "OldStrongPass123!"}
            ).status_code,
            401,
        )
        self.assertEqual(
            self.client.post(
                "/api/v1/auth/login/", {"username": "pending", "password": "NewStrongPass456!"}
            ).status_code,
            200,
        )

    @override_settings(PASSWORD_RESET_TIMEOUT=-1)
    def test_invalid_and_expired_password_reset_tokens_are_rejected(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)
        base = {
            "uid": uid,
            "new_password": "NewStrongPass456!",
            "new_password2": "NewStrongPass456!",
        }
        expired = self.client.post("/api/v1/auth/password-reset/confirm/", {**base, "token": token})
        invalid = self.client.post(
            "/api/v1/auth/password-reset/confirm/", {**base, "token": "invalid-token"}
        )
        self.assertEqual(expired.status_code, 400)
        self.assertEqual(invalid.status_code, 400)

    def test_password_validator_errors_are_attached_to_new_password(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)
        response = self.client.post(
            "/api/v1/auth/password-reset/confirm/",
            {
                "uid": uid,
                "token": token,
                "new_password": "password",
                "new_password2": "password",
            },
        )
        self.assertEqual(response.status_code, 400)
        fields = response.json()["error"]["fields"]
        self.assertIn("new_password", fields)
        self.assertNotIn("non_field_errors", fields)


class PlaceMutationApiTests(ApiFixture):
    def test_create_requires_auth_and_sets_author_slug_pending(self):
        payload = {
            "prefecture_id": self.prefecture.pk,
            "name": "Tokyo Tower",
            "description": "A city landmark.",
        }
        self.assertEqual(self.client.post("/api/v1/places/", payload).status_code, 401)
        self.authenticate()
        response = self.client.post("/api/v1/places/", payload)
        self.assertEqual(response.status_code, 201)
        place = Place.objects.get(pk=response.data["id"])
        self.assertEqual(
            (place.author, place.slug, place.status),
            (self.author, "tokyo-tower", Place.Status.PENDING),
        )

    def test_published_owner_edit_creates_one_revision_without_changing_live_place(self):
        url = f"/api/v1/places/{self.published.pk}/"
        self.authenticate(self.other)
        self.assertEqual(self.client.patch(url, {"name": "Changed"}).status_code, 403)
        self.authenticate(self.author)
        response = self.client.patch(url, {"name": "Akihabara Updated", "city": "Chiyoda"})
        self.assertEqual(response.status_code, 200)
        self.published.refresh_from_db()
        self.assertEqual(self.published.name, "Akihabara")
        self.assertEqual(self.published.city, "")
        self.assertEqual(self.published.status, Place.Status.PUBLISHED)
        revision = PlaceRevision.objects.get(place=self.published)
        self.assertEqual(
            (revision.name, revision.city, revision.status),
            (
                "Akihabara Updated",
                "Chiyoda",
                PlaceRevision.Status.PENDING,
            ),
        )

        second = self.client.patch(url, {"description": "A safer proposed description."})
        self.assertEqual(second.status_code, 200)
        self.assertEqual(PlaceRevision.objects.filter(place=self.published).count(), 1)
        revision.refresh_from_db()
        self.assertEqual(revision.description, "A safer proposed description.")
        self.published.refresh_from_db()
        self.assertEqual(self.published.description, "Electric town.")

        owner_detail = self.client.get(url).json()
        self.assertEqual(owner_detail["name"], "Akihabara")
        self.assertEqual(owner_detail["latest_revision"]["name"], "Akihabara Updated")
        self.client.force_authenticate()
        public_detail = self.client.get(url).json()
        self.assertEqual(public_detail["name"], "Akihabara")
        self.assertIsNone(public_detail["latest_revision"])

    def test_staff_edit_through_api_also_requires_revision_approval(self):
        self.authenticate(self.staff)
        response = self.client.patch(
            f"/api/v1/places/{self.published.pk}/",
            {"name": "Staff corrected name"},
        )
        self.assertEqual(response.status_code, 200)
        self.published.refresh_from_db()
        self.assertEqual(self.published.name, "Akihabara")
        self.assertEqual(self.published.status, Place.Status.PUBLISHED)
        revision = PlaceRevision.objects.get(place=self.published)
        self.assertEqual(revision.name, "Staff corrected name")
        self.assertEqual(revision.submitted_by, self.staff)

    def test_owner_must_request_deletion_with_a_reason(self):
        url = f"/api/v1/places/{self.published.pk}/"
        request_url = f"{url}deletion-request/"

        self.assertEqual(
            self.client.post(request_url, {"reason": "A valid reason for removal."}).status_code,
            401,
        )
        self.authenticate(self.author)
        direct = self.client.delete(url)
        self.assertEqual(direct.status_code, 405)
        self.assertEqual(direct.json()["error"]["code"], "deletion_request_required")
        self.assertTrue(Place.objects.filter(pk=self.published.pk).exists())

        invalid = self.client.post(request_url, {"reason": "short"})
        self.assertEqual(invalid.status_code, 400)
        self.assertIn("reason", invalid.json()["error"]["fields"])

        created = self.client.post(request_url, {"reason": "This listing is no longer valid."})
        self.assertEqual(created.status_code, 201)
        deletion_request = PlaceDeletionRequest.objects.get(place=self.published)
        self.assertEqual(deletion_request.requested_by, self.author)
        self.assertEqual(deletion_request.place_name, "Akihabara")
        self.assertEqual(deletion_request.status, PlaceDeletionRequest.Status.PENDING)
        self.assertTrue(Place.objects.filter(pk=self.published.pk).exists())

        duplicate = self.client.post(request_url, {"reason": "A second valid deletion reason."})
        self.assertEqual(duplicate.status_code, 409)
        self.assertEqual(PlaceDeletionRequest.objects.filter(place=self.published).count(), 1)

    def test_only_owner_can_request_deletion_and_status_is_private(self):
        request_url = f"/api/v1/places/{self.published.pk}/deletion-request/"
        self.authenticate(self.other)
        self.assertEqual(
            self.client.post(
                request_url, {"reason": "I should not be allowed to remove this."}
            ).status_code,
            403,
        )

        self.authenticate(self.author)
        self.client.post(request_url, {"reason": "This listing is no longer valid."})
        owner_detail = self.client.get(f"/api/v1/places/{self.published.pk}/").json()
        self.assertEqual(
            owner_detail["deletion_request"]["status"], PlaceDeletionRequest.Status.PENDING
        )
        self.client.force_authenticate()
        public_detail = self.client.get(f"/api/v1/places/{self.published.pk}/").json()
        self.assertIsNone(public_detail["deletion_request"])

    def test_superuser_can_request_deletion_for_any_place_but_regular_staff_cannot(self):
        request_url = f"/api/v1/places/{self.published.pk}/deletion-request/"
        self.authenticate(self.staff)
        blocked = self.client.post(
            request_url,
            {"reason": "A regular administrator should use the admin workflow."},
        )
        self.assertEqual(blocked.status_code, 400)
        self.assertEqual(blocked.json()["error"]["code"], "staff_action_required")

        superuser = User.objects.create_superuser(
            "superuser",
            "superuser@example.com",
            "StrongPass123!",
        )
        self.authenticate(superuser)
        created = self.client.post(
            request_url,
            {"reason": "The superuser is deliberately requesting moderation."},
        )

        self.assertEqual(created.status_code, 201)
        deletion_request = PlaceDeletionRequest.objects.get(place=self.published)
        self.assertEqual(deletion_request.requested_by, superuser)
        self.assertEqual(deletion_request.status, PlaceDeletionRequest.Status.PENDING)
        self.assertTrue(Place.objects.filter(pk=self.published.pk).exists())

    def test_superuser_can_delete_a_place_directly(self):
        superuser = User.objects.create_superuser(
            "superuser",
            "superuser@example.com",
            "StrongPass123!",
        )
        self.authenticate(superuser)

        response = self.client.delete(f"/api/v1/places/{self.published.pk}/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Place.objects.filter(pk=self.published.pk).exists())

    def test_rejected_deletion_keeps_place_and_allows_a_new_request(self):
        deletion_request = PlaceDeletionRequest.objects.create(
            place=self.published,
            requested_by=self.author,
            place_name=self.published.name,
            reason="This listing is no longer valid.",
        )
        reject_place_deletion(deletion_request, self.staff)
        deletion_request.refresh_from_db()
        self.assertEqual(deletion_request.status, PlaceDeletionRequest.Status.REJECTED)
        self.assertEqual(deletion_request.reviewed_by, self.staff)
        self.assertTrue(Place.objects.filter(pk=self.published.pk).exists())

        self.authenticate(self.author)
        response = self.client.post(
            f"/api/v1/places/{self.published.pk}/deletion-request/",
            {"reason": "There is now another valid reason for removal."},
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            PlaceDeletionRequest.objects.filter(
                place=self.published,
                status=PlaceDeletionRequest.Status.PENDING,
            ).count(),
            1,
        )

    def test_approved_deletion_cascades_place_data_and_preserves_audit_result(self):
        review = Review.objects.create(place=self.published, author=self.other, rating=4)
        favorite = Favorite.objects.create(place=self.published, user=self.other)
        visited = VisitedPlace.objects.create(place=self.published, user=self.other)
        report = ContentReport.objects.create(
            place=self.published, reporter=self.other, reason="Review this place."
        )
        gallery_image = PlaceImage.objects.bulk_create(
            [PlaceImage(place=self.published, image="place_gallery/deletion-test.jpg")]
        )[0]
        revision = PlaceRevision.objects.create(
            place=self.published,
            submitted_by=self.author,
            prefecture=self.prefecture,
            name=self.published.name,
            description=self.published.description,
        )
        deletion_request = PlaceDeletionRequest.objects.create(
            place=self.published,
            requested_by=self.author,
            place_name=self.published.name,
            reason="This listing should be permanently removed.",
        )
        place_id = self.published.pk

        approve_place_deletion(deletion_request, self.staff)

        self.assertFalse(Place.objects.filter(pk=place_id).exists())
        self.assertFalse(Review.objects.filter(pk=review.pk).exists())
        self.assertFalse(Favorite.objects.filter(pk=favorite.pk).exists())
        self.assertFalse(VisitedPlace.objects.filter(pk=visited.pk).exists())
        self.assertFalse(ContentReport.objects.filter(pk=report.pk).exists())
        self.assertFalse(PlaceImage.objects.filter(pk=gallery_image.pk).exists())
        self.assertFalse(PlaceRevision.objects.filter(pk=revision.pk).exists())
        deletion_request.refresh_from_db()
        self.assertIsNone(deletion_request.place)
        self.assertEqual(deletion_request.status, PlaceDeletionRequest.Status.APPROVED)
        self.assertEqual(deletion_request.reviewed_by, self.staff)
        self.assertIsNotNone(deletion_request.reviewed_at)

    def test_review_validation_uniqueness_and_permissions(self):
        self.authenticate(self.other)
        created = self.client.post(
            "/api/v1/reviews/", {"place_id": self.published.pk, "rating": 5, "comment": "Excellent"}
        )
        self.assertEqual(created.status_code, 201)
        duplicate = self.client.post(
            "/api/v1/reviews/", {"place_id": self.published.pk, "rating": 4}
        )
        self.assertEqual(duplicate.status_code, 400)
        self.client.force_authenticate(self.author)
        self.assertEqual(
            self.client.patch(f"/api/v1/reviews/{created.data['id']}/", {"rating": 1}).status_code,
            403,
        )


class UploadApiTests(ApiFixture):
    def setUp(self):
        super().setUp()
        self.media_dir = tempfile.mkdtemp()
        self.override = override_settings(MEDIA_ROOT=self.media_dir)
        self.override.enable()

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.media_dir, ignore_errors=True)

    @staticmethod
    def image_file(name="place.png", color="red"):
        buffer = BytesIO()
        Image.new("RGB", (80, 60), color).save(buffer, "PNG")
        return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")

    def test_multipart_image_upload_returns_absolute_media_url(self):
        self.authenticate()
        response = self.client.post(
            "/api/v1/places/",
            {
                "prefecture_id": self.prefecture.pk,
                "name": "Image place",
                "description": "Has an upload.",
                "image": self.image_file(),
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 201)
        detail = self.client.get(f"/api/v1/places/{response.data['id']}/")
        self.assertTrue(detail.json()["image_url"].startswith("http://testserver/media/"))

    def test_gallery_upload_generates_webp_thumbnail(self):
        self.authenticate()
        self.client.patch(
            f"/api/v1/places/{self.published.pk}/",
            {"description": "Proposed description with a gallery addition."},
        )
        response = self.client.post(
            f"/api/v1/places/{self.published.pk}/images/",
            {"image": self.image_file(), "caption": "Night view"},
            format="multipart",
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json()["pending_revision"])
        self.assertFalse(PlaceImage.objects.exists())
        gallery_image = PlaceRevisionImage.objects.get()
        self.assertTrue(gallery_image.thumbnail.name.endswith(".webp"))
        self.assertTrue(gallery_image.thumbnail.storage.exists(gallery_image.thumbnail.name))
        self.assertTrue(response.json()["thumbnail_url"].startswith("http://testserver/media/"))

        approve_place_revision(gallery_image.revision, self.staff)
        self.assertEqual(PlaceImage.objects.count(), 1)
        approved_image = PlaceImage.objects.get()
        self.assertTrue(approved_image.thumbnail.name.endswith(".webp"))
        self.assertTrue(approved_image.thumbnail.storage.exists(approved_image.thumbnail.name))

    def test_published_cover_replacement_is_hidden_until_revision_approval(self):
        self.published.image = self.image_file("approved.png", "blue")
        self.published.save()
        self.published.refresh_from_db()
        approved_image_name = self.published.image.name

        self.authenticate()
        response = self.client.patch(
            f"/api/v1/places/{self.published.pk}/",
            {"image": self.image_file("proposed.png", "green")},
            format="multipart",
        )
        self.assertEqual(response.status_code, 200)
        revision = PlaceRevision.objects.get(place=self.published)
        self.published.refresh_from_db()
        self.assertEqual(self.published.image.name, approved_image_name)
        self.assertNotEqual(revision.image.name, approved_image_name)
        self.assertTrue(revision.image.storage.exists(revision.image.name))

        approve_place_revision(revision, self.staff)
        self.published.refresh_from_db()
        self.assertEqual(self.published.image.name, revision.image.name)
        self.assertTrue(self.published.image.storage.exists(self.published.image.name))
        self.assertFalse(self.published.image.storage.exists(approved_image_name))

    def test_published_cover_removal_is_hidden_until_revision_approval(self):
        self.published.image = self.image_file("approved.png", "blue")
        self.published.save()
        self.published.refresh_from_db()
        approved_image_name = self.published.image.name

        self.authenticate()
        response = self.client.patch(
            f"/api/v1/places/{self.published.pk}/",
            {"remove_image": True},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        revision = PlaceRevision.objects.get(place=self.published)
        self.assertTrue(revision.remove_image)
        self.published.refresh_from_db()
        self.assertEqual(self.published.image.name, approved_image_name)

        approve_place_revision(revision, self.staff)
        self.published.refresh_from_db()
        self.assertFalse(self.published.image)
        self.assertFalse(self.published.image.storage.exists(approved_image_name))

    def test_published_gallery_removal_waits_for_revision_approval(self):
        gallery_image = PlaceImage.objects.create(
            place=self.published,
            image=self.image_file("approved-gallery.png", "blue"),
        )
        image_name = gallery_image.image.name
        self.authenticate()
        self.client.patch(
            f"/api/v1/places/{self.published.pk}/",
            {"description": "Proposed description."},
            format="json",
        )

        response = self.client.delete(
            f"/api/v1/places/{self.published.pk}/images/{gallery_image.pk}/"
        )
        self.assertEqual(response.status_code, 200)
        revision = PlaceRevision.objects.get(place=self.published)
        self.assertTrue(revision.removed_gallery_images.filter(pk=gallery_image.pk).exists())
        self.assertTrue(PlaceImage.objects.filter(pk=gallery_image.pk).exists())

        approve_place_revision(revision, self.staff)
        self.assertFalse(PlaceImage.objects.filter(pk=gallery_image.pk).exists())
        self.assertFalse(gallery_image.image.storage.exists(image_name))

    def test_gallery_upload_rejects_more_than_four_effective_images(self):
        for index in range(4):
            PlaceImage.objects.create(
                place=self.published,
                image=self.image_file(f"gallery-{index}.png", "blue"),
            )
        self.authenticate()
        self.client.patch(
            f"/api/v1/places/{self.published.pk}/",
            {"description": "Proposed description."},
            format="json",
        )

        response = self.client.post(
            f"/api/v1/places/{self.published.pk}/images/",
            {"image": self.image_file("fifth.png", "green")},
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("gallery_images", response.json()["error"]["fields"])
        self.assertFalse(PlaceRevisionImage.objects.exists())

    def test_owner_can_remove_a_proposed_gallery_image(self):
        self.authenticate()
        self.client.patch(
            f"/api/v1/places/{self.published.pk}/",
            {"description": "Proposed description."},
            format="json",
        )
        upload = self.client.post(
            f"/api/v1/places/{self.published.pk}/images/",
            {"image": self.image_file("proposed.png", "green")},
            format="multipart",
        )
        image_id = upload.json()["id"]

        response = self.client.delete(
            f"/api/v1/places/{self.published.pk}/revision-images/{image_id}/"
        )

        self.assertEqual(response.status_code, 204)
        self.assertFalse(PlaceRevisionImage.objects.filter(pk=image_id).exists())

    def test_coordinate_validation_returns_field_error(self):
        self.authenticate()
        response = self.client.post(
            "/api/v1/places/",
            {
                "prefecture_id": self.prefecture.pk,
                "name": "Impossible coordinate",
                "description": "Invalid latitude.",
                "latitude": "91.000000",
            },
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("latitude", response.json()["error"]["fields"])


class CommunityApiTests(ApiFixture):
    def test_favorites_and_visited_places(self):
        self.authenticate()
        favorite = self.client.post(f"/api/v1/places/{self.published.pk}/favorite/")
        visited = self.client.post(f"/api/v1/places/{self.published.pk}/visited/")
        self.assertEqual((favorite.status_code, visited.status_code), (201, 201))
        self.assertTrue(Favorite.objects.filter(user=self.author, place=self.published).exists())
        self.assertTrue(
            VisitedPlace.objects.filter(user=self.author, place=self.published).exists()
        )
        self.assertEqual(
            self.client.post("/api/v1/favorites/", {"place_id": self.published.pk}).status_code, 400
        )
        self.assertEqual(
            self.client.post(
                "/api/v1/visited-places/", {"place_id": self.published.pk}
            ).status_code,
            400,
        )
        detail = self.client.get(f"/api/v1/places/{self.published.pk}/").json()
        self.assertTrue(detail["is_favorite"])
        self.assertTrue(detail["is_visited"])
        favorite_delete = self.client.delete(f"/api/v1/places/{self.published.pk}/favorite/")
        visited_delete = self.client.delete(f"/api/v1/places/{self.published.pk}/visited/")
        self.assertEqual((favorite_delete.status_code, visited_delete.status_code), (204, 204))
        self.assertEqual(
            (favorite_delete.headers["Content-Length"], visited_delete.headers["Content-Length"]),
            ("0", "0"),
        )
        self.assertFalse(Favorite.objects.filter(user=self.author, place=self.published).exists())
        self.assertFalse(
            VisitedPlace.objects.filter(user=self.author, place=self.published).exists()
        )

    def test_collections_following_votes_and_reports(self):
        self.authenticate()
        collection = self.client.post(
            "/api/v1/collections/",
            {
                "name": "Tokyo weekend",
                "place_ids": [self.published.pk],
                "is_public": True,
            },
        )
        self.assertEqual(collection.status_code, 201)
        self.assertEqual(Collection.objects.get().owner, self.author)
        self.assertEqual(
            self.client.post("/api/v1/collections/", {"name": "Tokyo weekend"}).status_code, 400
        )
        itinerary = self.client.post("/api/v1/itineraries/", {"name": "Tokyo day"})
        self.assertEqual(itinerary.status_code, 201)
        stop_url = f"/api/v1/itineraries/{itinerary.data['id']}/add_stop/"
        self.assertEqual(
            self.client.post(stop_url, {"place_id": self.published.pk, "day": 1}).status_code, 201
        )
        self.assertEqual(
            self.client.post(stop_url, {"place_id": self.published.pk, "day": 2}).status_code, 400
        )
        self.assertEqual(
            self.client.post(f"/api/v1/contributors/{self.other.pk}/follow/").status_code, 201
        )
        self.assertTrue(Follow.objects.filter(follower=self.author, following=self.other).exists())
        review = Review.objects.create(place=self.published, author=self.other, rating=5)
        self.assertEqual(self.client.post(f"/api/v1/reviews/{review.pk}/helpful/").status_code, 201)
        self.assertTrue(ReviewVote.objects.filter(user=self.author, review=review).exists())
        report = self.client.post(
            "/api/v1/reports/", {"review": review.pk, "reason": "Needs moderator review."}
        )
        self.assertEqual(report.status_code, 201)
        self.assertTrue(ContentReport.objects.filter(reporter=self.author, review=review).exists())

    def test_trending_places_endpoint(self):
        Review.objects.create(place=self.published, author=self.other, rating=5)
        response = self.client.get("/api/v1/places/trending/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["results"][0]["id"], self.published.pk)


class SupportTicketApiTests(ApiFixture):
    def setUp(self):
        super().setUp()
        cache.clear()
        self.media_dir = tempfile.mkdtemp()
        self.override = override_settings(MEDIA_ROOT=self.media_dir)
        self.override.enable()

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.media_dir, ignore_errors=True)
        cache.clear()

    @staticmethod
    def screenshot_file(name="screenshot.png"):
        buffer = BytesIO()
        Image.new("RGB", (40, 30), "blue").save(buffer, "PNG")
        return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")

    def test_support_requires_authentication_and_returns_form_metadata(self):
        self.assertEqual(
            self.client.get("/api/v1/support/").status_code, status.HTTP_401_UNAUTHORIZED
        )
        self.assertEqual(
            self.client.post("/api/v1/support/", {}).status_code, status.HTTP_401_UNAUTHORIZED
        )
        self.authenticate()
        response = self.client.get("/api/v1/support/")
        self.assertIsInstance(response, JsonResponse)
        self.assertEqual(response.json()["default_contact_email"], "author@example.com")
        self.assertIn({"value": "bug_report", "label": "Bug Report"}, response.json()["categories"])

    def test_creates_sequential_ticket_with_email_snapshot(self):
        self.authenticate()
        first = self.client.post(
            "/api/v1/support/",
            {
                "category": "account",
                "subject": "  Cannot update profile  ",
                "contact_email": "CONTACT@example.com",
                "related_url": "https://example.com/profile",
                "message": "Please help with my profile.",
            },
        )
        second = self.client.post(
            "/api/v1/support/",
            {
                "category": "bug_report",
                "subject": "Map issue",
                "contact_email": "author@example.com",
                "message": "The map does not load.",
            },
        )
        self.assertEqual((first.status_code, second.status_code), (201, 201))
        self.assertRegex(first.json()["ticket_id"], r"^SUP-\d{8}-0001$")
        self.assertTrue(second.json()["ticket_id"].endswith("-0002"))
        ticket = SupportTicket.objects.get(ticket_id=first.json()["ticket_id"])
        self.assertEqual(ticket.registered_email, "author@example.com")
        self.assertEqual(ticket.contact_email, "contact@example.com")
        self.assertEqual(ticket.subject, "Cannot update profile")
        self.assertEqual(ticket.status, SupportTicket.Status.NEW)

    def test_duplicate_validation_and_required_field_errors(self):
        self.authenticate()
        payload = {
            "category": "other",
            "subject": "Question",
            "contact_email": "author@example.com",
            "message": "Could you help me?",
        }
        self.assertEqual(self.client.post("/api/v1/support/", payload).status_code, 201)
        duplicate = self.client.post("/api/v1/support/", payload)
        self.assertEqual(duplicate.status_code, 400)
        self.assertIn("non_field_errors", duplicate.json()["error"]["fields"])
        missing = self.client.post("/api/v1/support/", {"category": "unknown"})
        self.assertEqual(missing.status_code, 400)
        self.assertIn("category", missing.json()["error"]["fields"])
        self.assertIn("message", missing.json()["error"]["fields"])

    def test_accepts_one_valid_screenshot_and_rejects_fake_images(self):
        self.authenticate()
        response = self.client.post(
            "/api/v1/support/",
            {
                "category": "bug_report",
                "subject": "Visual issue",
                "contact_email": "author@example.com",
                "message": "The page layout is broken.",
                "screenshot": self.screenshot_file(),
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 201)
        self.assertNotIn("screenshot", response.json())
        ticket = SupportTicket.objects.get()
        self.assertTrue(ticket.screenshot.storage.exists(ticket.screenshot.name))

        invalid = self.client.post(
            "/api/v1/support/",
            {
                "category": "bug_report",
                "subject": "Another visual issue",
                "contact_email": "author@example.com",
                "message": "This attachment is invalid.",
                "screenshot": SimpleUploadedFile(
                    "fake.png", b"not an image", content_type="image/png"
                ),
            },
            format="multipart",
        )
        self.assertEqual(invalid.status_code, 400)
        self.assertIn("screenshot", invalid.json()["error"]["fields"])

        valid_image = self.screenshot_file("large.png").read()
        oversized = self.client.post(
            "/api/v1/support/",
            {
                "category": "bug_report",
                "subject": "Large screenshot",
                "contact_email": "author@example.com",
                "message": "This attachment exceeds the size limit.",
                "screenshot": SimpleUploadedFile(
                    "large.png",
                    valid_image + b"0" * (5 * 1024 * 1024),
                    content_type="image/png",
                ),
            },
            format="multipart",
        )
        self.assertEqual(oversized.status_code, 400)
        self.assertIn("screenshot", oversized.json()["error"]["fields"])

    def test_support_submissions_are_rate_limited(self):
        self.authenticate()
        responses = [
            self.client.post(
                "/api/v1/support/",
                {
                    "category": "other",
                    "subject": f"Question {number}",
                    "contact_email": "author@example.com",
                    "message": f"A distinct support request number {number}.",
                },
            )
            for number in range(6)
        ]
        self.assertEqual([response.status_code for response in responses[:5]], [201] * 5)
        self.assertEqual(responses[5].status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(responses[5].json()["error"]["code"], "throttled")

    def test_admin_change_page_is_read_only_for_request_content_and_has_mailto(self):
        self.authenticate()
        created = self.client.post(
            "/api/v1/support/",
            {
                "category": "account",
                "subject": "Account question",
                "contact_email": "reply@example.com",
                "message": "Please review my account.",
            },
        )
        ticket = SupportTicket.objects.get(ticket_id=created.json()["ticket_id"])
        self.client.force_authenticate(user=None)
        self.staff.is_superuser = True
        self.staff.save(update_fields=("is_superuser",))
        self.client.force_login(self.staff)
        self.verify_admin_session()
        response = self.client.get(
            f"/{settings.ADMIN_PATH}travel/supportticket/{ticket.pk}/change/"
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'href="mailto:reply@example.com"')
        self.assertContains(response, "Account question")
        self.assertNotContains(response, 'name="subject"')


class ContributorServiceTests(ApiFixture):
    def test_badge_and_points_boundaries(self):
        self.assertEqual(get_badge_progress(0)["name"], "Rookie Traveler")
        self.assertEqual(get_badge_progress(25)["name"], "Local Explorer")
        stats = get_contributor_stats(3, 4)
        self.assertEqual(stats["points"], 19)
        self.assertEqual(stats["published_place_count"], 3)
        self.assertGreater(bayesian_rating(5, 10), bayesian_rating(5, 1))

    def test_admin_dashboard_renders_moderation_statistics(self):
        self.staff.is_superuser = True
        self.staff.save(update_fields=["is_superuser"])
        self.client.force_login(self.staff)
        self.verify_admin_session()
        response = self.client.get(f"/{settings.ADMIN_PATH}")
        self.assertContains(response, "Needs Your Attention")
        self.assertContains(response, "Pending Places")
