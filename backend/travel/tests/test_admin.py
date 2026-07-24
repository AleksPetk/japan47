from django.conf import settings
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.core.exceptions import ImproperlyConfigured
from django.test import TestCase
from django.urls import reverse
from django_otp import DEVICE_ID_SESSION_KEY
from django_otp.oath import totp
from django_otp.plugins.otp_static.models import StaticDevice, StaticToken
from django_otp.plugins.otp_totp.models import TOTPDevice

from travel.models import ContentReport, Place, PlaceRevision, Prefecture, Region, Review, SupportTicket
from config.settings.base import normalized_admin_path

User = get_user_model()


class AdminFixture(TestCase):
    def setUp(self):
        self.password = "StrongPass123!"
        self.staff = User.objects.create_superuser("admin-owner", "owner@example.com", self.password)
        self.author = User.objects.create_user("author-admin-test", "author-admin@example.com", self.password)
        self.region = Region.objects.create(name=Region.RegionName.KANTO, display_order=1)
        self.prefecture = Prefecture.objects.create(region=self.region, name="Tokyo", display_order=1)
        self.place = Place.objects.create(
            author=self.author,
            prefecture=self.prefecture,
            name="Pending admin place",
            slug="pending-admin-place",
            description="Awaiting moderation.",
        )

    def verified_admin_session(self):
        self.client.force_login(self.staff)
        device = TOTPDevice.objects.create(user=self.staff, name="Test device", confirmed=True)
        session = self.client.session
        session[DEVICE_ID_SESSION_KEY] = device.persistent_id
        session.save()
        return device

    @staticmethod
    def current_token(device):
        return str(totp(device.bin_key, device.step, device.t0, device.digits, device.drift)).zfill(device.digits)

    def support_ticket(self, status=SupportTicket.Status.NEW):
        return SupportTicket.objects.create(
            ticket_id=f"SUP-20260724-{SupportTicket.objects.count() + 1:04d}",
            user=self.author,
            registered_email=self.author.email,
            contact_email=self.author.email,
            category=SupportTicket.Category.OTHER,
            subject="Admin test",
            message="Please review this ticket.",
            status=status,
            deduplication_key=f"admin-test-{SupportTicket.objects.count()}",
        )

    def place_revision(self, **overrides):
        self.place.status = Place.Status.PUBLISHED
        self.place.save(update_fields=("status", "updated_at"))
        values = {
            "place": self.place,
            "submitted_by": self.author,
            "prefecture": self.prefecture,
            "name": "Proposed admin place name",
            "description": "Proposed description awaiting moderation.",
            "city": "Chiyoda",
            "best_season": Place.Season.AUTUMN,
        }
        values.update(overrides)
        return PlaceRevision.objects.create(**values)


class PrivateAdminAndTwoFactorTests(AdminFixture):
    def test_private_route_reverse_and_permissions(self):
        self.assertEqual(reverse("admin:index"), f"/{settings.ADMIN_PATH}")
        self.assertEqual(self.client.get("/admin/").status_code, 404)
        self.assertEqual(self.client.get(reverse("admin:index")).status_code, 302)

    def test_password_login_leads_to_mandatory_enrollment(self):
        response = self.client.post(reverse("admin:login"), {
            "username": self.staff.username,
            "password": self.password,
            "next": reverse("admin:index"),
        })
        self.assertRedirects(response, reverse("admin:index"), fetch_redirect_response=False)
        self.assertRedirects(
            self.client.get(reverse("admin:index")),
            f"{reverse('admin-2fa-setup')}?next=/{settings.ADMIN_PATH}",
            fetch_redirect_response=False,
        )
        self.client.force_login(self.author)
        self.assertEqual(self.client.get(reverse("admin:index")).status_code, 302)

    def test_admin_path_normalization_rejects_empty_reserved_and_unsafe_values(self):
        self.assertEqual(normalized_admin_path("/internal/tools//"), "internal/tools/")
        for value in ("", "/", "api/management", "admin path", "../admin"):
            with self.subTest(value=value), self.assertRaises(ImproperlyConfigured):
                normalized_admin_path(value)

    def test_staff_without_device_is_forced_to_setup(self):
        self.client.force_login(self.staff)
        response = self.client.get(reverse("admin:index"))
        self.assertRedirects(response, f"{reverse('admin-2fa-setup')}?next=/{settings.ADMIN_PATH}", fetch_redirect_response=False)

    def test_setup_requires_valid_code_and_shows_recovery_codes_once(self):
        self.client.force_login(self.staff)
        response = self.client.get(reverse("admin-2fa-setup"))
        self.assertEqual(response.status_code, 200)
        device = TOTPDevice.objects.get(user=self.staff)
        self.assertFalse(device.confirmed)
        self.assertContains(response, "data:image/png;base64,")

        invalid = self.client.post(reverse("admin-2fa-setup"), {"token": "000000"})
        self.assertEqual(invalid.status_code, 200)
        device.refresh_from_db()
        self.assertFalse(device.confirmed)
        device.throttle_reset()

        success = self.client.post(reverse("admin-2fa-setup"), {"token": self.current_token(device)}, follow=True)
        self.assertEqual(success.status_code, 200)
        device.refresh_from_db()
        self.assertTrue(device.confirmed)
        self.assertContains(success, "These codes are shown once")
        self.assertEqual(StaticToken.objects.filter(device__user=self.staff).count(), 10)
        self.assertNotContains(self.client.get(reverse("admin-2fa-codes")), "These codes are shown once")

    def test_enrolled_staff_must_verify_totp_each_session(self):
        device = TOTPDevice.objects.create(user=self.staff, name="Google Authenticator", confirmed=True)
        self.client.force_login(self.staff)
        self.assertRedirects(
            self.client.get(reverse("admin:index")),
            f"{reverse('admin-2fa-verify')}?next=/{settings.ADMIN_PATH}",
            fetch_redirect_response=False,
        )
        self.assertContains(self.client.post(reverse("admin-2fa-verify"), {"token": "000000"}), "invalid or expired")
        device.refresh_from_db()
        device.throttle_reset()
        response = self.client.post(reverse("admin-2fa-verify"), {"token": self.current_token(device)})
        self.assertRedirects(response, reverse("admin:index"), fetch_redirect_response=False)
        self.assertEqual(self.client.get(reverse("admin:index")).status_code, 200)

    def test_recovery_code_works_only_once(self):
        TOTPDevice.objects.create(user=self.staff, name="Google Authenticator", confirmed=True)
        static = StaticDevice.objects.create(user=self.staff, name="Recovery", confirmed=True)
        code = StaticToken.random_token()
        StaticToken.objects.create(device=static, token=code)
        self.client.force_login(self.staff)
        first = self.client.post(reverse("admin-2fa-recovery"), {"token": code})
        self.assertRedirects(first, reverse("admin:index"), fetch_redirect_response=False)
        self.assertFalse(StaticToken.objects.filter(token=code).exists())
        self.client.logout()
        self.client.force_login(self.staff)
        second = self.client.post(reverse("admin-2fa-recovery"), {"token": code})
        self.assertContains(second, "already been used")

    def test_regeneration_invalidates_old_unused_recovery_codes(self):
        self.verified_admin_session()
        static = StaticDevice.objects.create(user=self.staff, name="Recovery", confirmed=True)
        old_code = StaticToken.random_token()
        StaticToken.objects.create(device=static, token=old_code)
        response = self.client.post(reverse("admin-2fa-codes"), follow=True)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "These codes are shown once")
        self.assertFalse(StaticToken.objects.filter(token=old_code).exists())
        self.assertEqual(StaticToken.objects.filter(device__user=self.staff).count(), 10)


class AdminAlertAndModerationTests(AdminFixture):
    def setUp(self):
        super().setUp()
        self.verified_admin_session()

    def test_dashboard_and_sidebar_alerts_follow_workflow_status(self):
        ticket = self.support_ticket()
        review = Review.objects.create(place=self.place, author=self.author, rating=4, comment="Reported review")
        report = ContentReport.objects.create(reporter=self.author, review=review, reason="Please inspect")
        response = self.client.get(reverse("admin:index"))
        self.assertContains(response, "Needs Your Attention")
        self.assertContains(response, "Pending Places")
        self.assertContains(response, "New Support Tickets")
        self.assertContains(response, "Reported Reviews")
        self.assertContains(response, "?status__exact=pending")
        self.assertContains(response, "?status__exact=new")
        self.assertContains(response, "?status__exact=open")
        self.assertEqual(self.client.get(f'{reverse("admin:travel_contentreport_changelist")}?status__exact=open&target=review').status_code, 200)
        self.assertContains(response, "j47-needs-attention", count=3)

        self.client.get(reverse("admin:travel_place_change", args=(self.place.pk,)))
        self.place.refresh_from_db()
        self.assertEqual(self.place.status, Place.Status.PENDING)
        self.assertContains(self.client.get(reverse("admin:index")), "j47-needs-attention")

        self.client.post(reverse("admin:travel_place_changelist"), {
            "action": "approve_places", "_selected_action": [self.place.pk],
        })
        self.client.post(reverse("admin:travel_supportticket_changelist"), {
            "action": "mark_in_progress", "_selected_action": [ticket.pk],
        })
        self.client.post(reverse("admin:travel_contentreport_changelist"), {
            "action": "resolve_reports", "_selected_action": [report.pk],
        })
        response = self.client.get(reverse("admin:index"))
        self.assertNotContains(response, "j47-needs-attention")

    def test_non_actionable_records_do_not_trigger_alerts(self):
        self.place.status = Place.Status.REJECTED
        self.place.save(update_fields=("status",))
        self.support_ticket(SupportTicket.Status.IN_PROGRESS)
        ContentReport.objects.create(reporter=self.author, place=self.place, reason="Done", status=ContentReport.Status.DISMISSED)
        self.assertNotContains(self.client.get(reverse("admin:index")), "j47-needs-attention")

    def test_place_approve_and_reject_actions_record_audit_identity(self):
        place_admin = admin.site._registry[Place]
        request = type("Request", (), {"user": self.staff})()
        place_admin.message_user = lambda *args, **kwargs: None
        place_admin.approve_places(request, Place.objects.filter(pk=self.place.pk))
        self.place.refresh_from_db()
        self.assertEqual(self.place.status, Place.Status.PUBLISHED)
        self.assertEqual(self.place.reviewed_by, self.staff)
        self.assertIsNotNone(self.place.reviewed_at)
        place_admin.reject_places(request, Place.objects.filter(pk=self.place.pk))
        self.place.refresh_from_db()
        self.assertEqual(self.place.status, Place.Status.REJECTED)
        self.assertEqual(self.place.reviewed_by, self.staff)

    def test_place_revision_admin_approves_or_rejects_without_early_live_changes(self):
        revision = self.place_revision()
        revision_admin = admin.site._registry[PlaceRevision]
        request = type("Request", (), {"user": self.staff})()
        revision_admin.message_user = lambda *args, **kwargs: None

        self.place.refresh_from_db()
        self.assertEqual(self.place.name, "Pending admin place")
        revision_admin.approve_revisions(
            request,
            PlaceRevision.objects.filter(pk=revision.pk),
        )
        self.place.refresh_from_db()
        revision.refresh_from_db()
        self.assertEqual(self.place.name, "Proposed admin place name")
        self.assertEqual(self.place.description, "Proposed description awaiting moderation.")
        self.assertEqual(self.place.status, Place.Status.PUBLISHED)
        self.assertEqual(revision.status, PlaceRevision.Status.APPROVED)
        self.assertEqual(revision.reviewed_by, self.staff)
        self.assertIsNotNone(revision.reviewed_at)

        rejected = self.place_revision(name="Unsafe proposed replacement")
        revision_admin.reject_revisions(
            request,
            PlaceRevision.objects.filter(pk=rejected.pk),
        )
        self.place.refresh_from_db()
        rejected.refresh_from_db()
        self.assertEqual(self.place.name, "Proposed admin place name")
        self.assertEqual(rejected.status, PlaceRevision.Status.REJECTED)
        self.assertEqual(rejected.reviewed_by, self.staff)

    def test_pending_revision_detail_has_working_approve_control(self):
        revision = self.place_revision()
        url = reverse("admin:travel_placerevision_change", args=(revision.pk,))
        response = self.client.get(url)
        self.assertContains(response, "Approve Changes")
        self.assertContains(response, "Reject Changes")

        response = self.client.post(url, {
            "review_note": "The proposed details are accurate.",
            "_approve_revision": "1",
            "gallery_images-TOTAL_FORMS": "0",
            "gallery_images-INITIAL_FORMS": "0",
            "gallery_images-MIN_NUM_FORMS": "0",
            "gallery_images-MAX_NUM_FORMS": "1000",
        })
        self.assertRedirects(response, url, fetch_redirect_response=False)
        revision.refresh_from_db()
        self.place.refresh_from_db()
        self.assertEqual(revision.status, PlaceRevision.Status.APPROVED)
        self.assertEqual(revision.review_note, "The proposed details are accurate.")
        self.assertEqual(self.place.name, "Proposed admin place name")
        completed = self.client.get(url)
        self.assertNotContains(completed, "Approve Changes")
        self.assertContains(completed, "cannot be moderated again")

    def test_pending_revision_detail_has_working_reject_control(self):
        revision = self.place_revision()
        original_name = self.place.name
        url = reverse("admin:travel_placerevision_change", args=(revision.pk,))
        response = self.client.post(url, {
            "review_note": "This change is not suitable.",
            "_reject_revision": "1",
            "gallery_images-TOTAL_FORMS": "0",
            "gallery_images-INITIAL_FORMS": "0",
            "gallery_images-MIN_NUM_FORMS": "0",
            "gallery_images-MAX_NUM_FORMS": "1000",
        })
        self.assertRedirects(response, url, fetch_redirect_response=False)
        revision.refresh_from_db()
        self.place.refresh_from_db()
        self.assertEqual(revision.status, PlaceRevision.Status.REJECTED)
        self.assertEqual(revision.review_note, "This change is not suitable.")
        self.assertEqual(self.place.name, original_name)

    def test_pending_place_revision_is_visible_on_dashboard_and_sidebar(self):
        revision = self.place_revision()
        response = self.client.get(reverse("admin:index"))
        self.assertContains(response, "Pending Place Edits")
        self.assertContains(response, reverse("admin:travel_placerevision_changelist"))
        self.assertContains(response, "j47-needs-attention")
        self.assertEqual(revision.status, PlaceRevision.Status.PENDING)

    def test_report_resolve_and_dismiss_actions_record_audit_identity(self):
        report = ContentReport.objects.create(reporter=self.author, place=self.place, reason="Review")
        report_admin = admin.site._registry[ContentReport]
        request = type("Request", (), {"user": self.staff})()
        report_admin.message_user = lambda *args, **kwargs: None
        report_admin.resolve_reports(request, ContentReport.objects.filter(pk=report.pk))
        report.refresh_from_db()
        self.assertEqual(report.resolved_by, self.staff)
        self.assertIsNotNone(report.resolved_at)
        report.status = ContentReport.Status.OPEN
        report.save(update_fields=("status",))
        report_admin.dismiss_reports(request, ContentReport.objects.filter(pk=report.pk))
        report.refresh_from_db()
        self.assertEqual(report.status, ContentReport.Status.DISMISSED)
        self.assertEqual(report.resolved_by, self.staff)

    def test_manual_status_changes_record_non_forgeable_audit_fields(self):
        request = type("Request", (), {"user": self.staff})()
        changed_status_form = type("Form", (), {"changed_data": ("status",)})()
        self.place.status = Place.Status.PUBLISHED
        admin.site._registry[Place].save_model(request, self.place, changed_status_form, True)
        self.place.refresh_from_db()
        self.assertEqual(self.place.reviewed_by, self.staff)
        self.assertIsNotNone(self.place.reviewed_at)

        report = ContentReport.objects.create(reporter=self.author, place=self.place, reason="Manual review")
        report.status = ContentReport.Status.RESOLVED
        admin.site._registry[ContentReport].save_model(request, report, changed_status_form, True)
        report.refresh_from_db()
        self.assertEqual(report.resolved_by, self.staff)
        self.assertIsNotNone(report.resolved_at)
