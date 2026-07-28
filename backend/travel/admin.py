from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
from django.db.models import Count, Q
from django.http import HttpResponseRedirect
from django.utils import timezone
from django.utils.html import format_html, format_html_join
from django.urls import reverse

from .models import (
    Collection,
    ContentReport,
    Favorite,
    Follow,
    Itinerary,
    Place,
    PlaceDeletionRequest,
    PlaceImage,
    PlaceRevision,
    PlaceRevisionImage,
    Prefecture,
    Profile,
    Region,
    Review,
    ReviewVote,
    SupportTicket,
    VisitedPlace,
)
from .place_revisions import approve_place_revision, reject_place_revision
from .place_deletions import approve_place_deletion, reject_place_deletion


def image_preview(image, *, large=False):
    """Render a constrained, escaped admin thumbnail without touching uploads."""

    if not image:
        return "—"
    css_class = "j47-image-preview j47-image-preview--large" if large else "j47-image-preview"
    return format_html('<img class="{}" src="{}" alt="">', css_class, image.url)


def status_badge(obj):
    return format_html(
        '<span class="j47-status j47-status--{}">{}</span>',
        obj.status,
        obj.get_status_display(),
    )


class ReportTargetFilter(admin.SimpleListFilter):
    title = "reported object"
    parameter_name = "target"

    def lookups(self, request, model_admin):
        return (("review", "Reviews"), ("place", "Places"))

    def queryset(self, request, queryset):
        if self.value() == "review":
            return queryset.filter(review__isnull=False)
        if self.value() == "place":
            return queryset.filter(place__isnull=False)
        return queryset

@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = ("display_order", "name")
    ordering = ("display_order",)

    def has_add_permission(self, request):
        return Region.objects.count() < 9
    
    def has_delete_permission(self, request, obj = None):
        return False
    
    def get_readonly_fields(self, request, obj = None):
        if obj:
            return ("name",)
        return ()

@admin.register(Prefecture)
class PrefectureAdmin(admin.ModelAdmin):
    list_display = ("display_order", "name", "region")
    ordering = ("display_order",)
    list_filter = ("region",)
    search_fields = ("name",)

    def has_add_permission(self, request):
        return Prefecture.objects.count() < 47
    
    def has_delete_permission(self, request, obj = None):
        return False
    
    def get_readonly_fields(self, request, obj = None):
        if obj:
            return ("name",)
        return ()


@admin.register(Place)
class PlaceAdmin(admin.ModelAdmin):
    list_display = ("image_thumbnail", "name", "prefecture", "author", "is_platform_managed", "status_display", "pending_changes", "reviewed_by", "reviewed_at", "updated_at")
    list_filter = ("status", "is_platform_managed", "prefecture__region", "prefecture", "reviewed_at")
    search_fields = ("name", "city", "author__username", "prefecture__name")
    prepopulated_fields = {"slug": ("name",)}
    readonly_fields = ("image_large_preview", "is_platform_managed", "reviewed_by", "reviewed_at", "created_at", "updated_at")
    ordering = ("-created_at",)
    actions = ("approve_places", "reject_places")
    list_select_related = ("author", "prefecture", "reviewed_by")

    @admin.display(description="Image")
    def image_thumbnail(self, obj):
        return image_preview(obj.image)

    @admin.display(description="Image preview")
    def image_large_preview(self, obj):
        return image_preview(obj.image, large=True)

    @admin.display(description="Status", ordering="status")
    def status_display(self, obj):
        return status_badge(obj)

    @admin.display(description="Pending edit")
    def pending_changes(self, obj):
        if not obj.pending_revision_count:
            return "—"
        url = reverse("admin:travel_placerevision_changelist")
        return format_html('<a href="{}?place__id__exact={}">Review changes</a>', url, obj.pk)

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            pending_revision_count=Count(
                "revisions",
                filter=Q(revisions__status=PlaceRevision.Status.PENDING),
            )
        )

    @admin.action(description="Approve selected places")
    def approve_places(self, request, queryset):
        count = queryset.update(
            status=Place.Status.PUBLISHED,
            reviewed_by=request.user,
            reviewed_at=timezone.now(),
        )
        self.message_user(request, f"Published {count} place(s).", messages.SUCCESS)

    @admin.action(description="Reject selected places")
    def reject_places(self, request, queryset):
        count = queryset.update(
            status=Place.Status.REJECTED,
            reviewed_by=request.user,
            reviewed_at=timezone.now(),
        )
        self.message_user(request, f"Rejected {count} place(s).", messages.WARNING)

    def save_model(self, request, obj, form, change):
        status_changed = change and "status" in form.changed_data
        if status_changed:
            obj.reviewed_by = request.user
            obj.reviewed_at = timezone.now()
        super().save_model(request, obj, form, change)


class PlaceRevisionImageInline(admin.TabularInline):
    model = PlaceRevisionImage
    extra = 0
    can_delete = False
    fields = ("image_preview", "caption", "display_order", "created_at")
    readonly_fields = fields

    @admin.display(description="Proposed image")
    def image_preview(self, obj):
        return image_preview(obj.thumbnail or obj.image)

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(PlaceRevision)
class PlaceRevisionAdmin(admin.ModelAdmin):
    """Compare and moderate proposed edits without exposing the live row to writes."""

    list_display = ("place", "submitted_by", "status_display", "updated_at", "reviewed_by", "reviewed_at")
    list_filter = ("status", "prefecture__region", "prefecture", "updated_at")
    search_fields = ("place__name", "name", "submitted_by__username", "prefecture__name")
    list_select_related = ("place", "submitted_by", "prefecture", "reviewed_by")
    ordering = ("-updated_at",)
    actions = ("approve_revisions", "reject_revisions")
    change_form_template = "admin/travel/placerevision/change_form.html"
    inlines = (PlaceRevisionImageInline,)
    readonly_fields = (
        "place", "submitted_by", "status", "comparison", "prefecture", "name",
        "description", "image_large_preview", "gallery_removals", "city", "google_maps_url",
        "official_website", "travel_tips", "best_season", "latitude", "longitude",
        "reviewed_by", "reviewed_at", "created_at", "updated_at",
    )
    fieldsets = (
        ("Moderation", {"fields": ("place", "submitted_by", "status", "comparison", "review_note")}),
        ("Proposed values", {"fields": (
            "prefecture", "name", "description", "image_large_preview", "gallery_removals", "city",
            "google_maps_url", "official_website", "travel_tips", "best_season",
            "latitude", "longitude",
        )}),
        ("Audit", {"fields": ("reviewed_by", "reviewed_at", "created_at", "updated_at")}),
    )

    @admin.display(description="Status", ordering="status")
    def status_display(self, obj):
        return status_badge(obj)

    @admin.display(description="Proposed cover image")
    def image_large_preview(self, obj):
        if obj.remove_image:
            return "Remove the published cover image"
        return image_preview(obj.image, large=True) if obj.image else "No cover-image change"

    @admin.display(description="Published gallery removals")
    def gallery_removals(self, obj):
        names = [image.caption or image.image.name for image in obj.removed_gallery_images.all()]
        return format_html("<br>".join("{}" for _ in names), *names) if names else "No gallery removals"

    @admin.display(description="Published versus proposed")
    def comparison(self, obj):
        rows = []
        for field, label in (
            ("prefecture", "Prefecture"), ("name", "Name"),
            ("description", "Description"), ("city", "City"),
            ("google_maps_url", "Google Maps URL"),
            ("official_website", "Official website"),
            ("travel_tips", "Travel tips"), ("best_season", "Best season"),
            ("latitude", "Latitude"), ("longitude", "Longitude"),
        ):
            current = getattr(obj.place, field)
            proposed = getattr(obj, field)
            changed = current != proposed
            rows.append(format_html(
                '<tr{}><th>{}</th><td>{}</td><td>{}</td></tr>',
                ' class="j47-revision-changed"' if changed else "",
                label,
                current if current not in (None, "") else "—",
                proposed if proposed not in (None, "") else "—",
            ))
        return format_html(
            '<table class="j47-revision-table"><thead><tr><th>Field</th><th>Published</th><th>Proposed</th></tr></thead><tbody>{}</tbody></table>',
            format_html_join("", "{}", ((row,) for row in rows)),
        )

    @admin.action(description="Approve selected place edits")
    def approve_revisions(self, request, queryset):
        count = 0
        for revision in queryset.filter(status=PlaceRevision.Status.PENDING):
            approve_place_revision(revision, request.user)
            count += 1
        self.message_user(request, f"Approved {count} place edit(s).", messages.SUCCESS)

    @admin.action(description="Reject selected place edits")
    def reject_revisions(self, request, queryset):
        count = 0
        for revision in queryset.filter(status=PlaceRevision.Status.PENDING):
            reject_place_revision(revision, request.user)
            count += 1
        self.message_user(request, f"Rejected {count} place edit(s).", messages.WARNING)

    def get_readonly_fields(self, request, obj=None):
        fields = super().get_readonly_fields(request, obj)
        if obj and obj.status != PlaceRevision.Status.PENDING:
            return (*fields, "review_note")
        return fields

    def response_change(self, request, obj):
        """Handle the explicit object-level moderation controls on the detail page."""

        change_url = reverse("admin:travel_placerevision_change", args=(obj.pk,))
        if "_approve_revision" in request.POST:
            if obj.status != PlaceRevision.Status.PENDING:
                self.message_user(request, "This place edit has already been reviewed.", messages.WARNING)
            else:
                approve_place_revision(obj, request.user)
                self.message_user(request, "The proposed place changes were approved and published.", messages.SUCCESS)
            return HttpResponseRedirect(change_url)

        if "_reject_revision" in request.POST:
            if obj.status != PlaceRevision.Status.PENDING:
                self.message_user(request, "This place edit has already been reviewed.", messages.WARNING)
            else:
                reject_place_revision(obj, request.user)
                self.message_user(request, "The proposed place changes were rejected.", messages.WARNING)
            return HttpResponseRedirect(change_url)

        return super().response_change(request, obj)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PlaceDeletionRequest)
class PlaceDeletionRequestAdmin(admin.ModelAdmin):
    """Review owner requests without allowing the workflow state to be forged."""

    list_display = (
        "place_name", "requested_by", "status_display", "created_at",
        "reviewed_by", "reviewed_at",
    )
    list_filter = ("status", "created_at", "reviewed_at")
    search_fields = ("place_name", "requested_by__username", "reason")
    list_select_related = ("place", "requested_by", "reviewed_by")
    ordering = ("-created_at",)
    actions = ("approve_deletions", "reject_deletions")
    change_form_template = "admin/travel/placedeletionrequest/change_form.html"
    readonly_fields = (
        "place_link", "place_name", "requested_by", "reason", "status",
        "reviewed_by", "reviewed_at", "created_at", "updated_at",
    )
    fieldsets = (
        ("Deletion request", {"fields": ("place_link", "place_name", "requested_by", "reason", "status")}),
        ("Administrator decision", {"fields": ("admin_note",)}),
        ("Audit", {"fields": ("reviewed_by", "reviewed_at", "created_at", "updated_at")}),
    )

    @admin.display(description="Status", ordering="status")
    def status_display(self, obj):
        return status_badge(obj)

    @admin.display(description="Current place")
    def place_link(self, obj):
        if obj.place_id is None:
            return "Deleted after approval"
        url = reverse("admin:travel_place_change", args=(obj.place_id,))
        return format_html('<a href="{}">{}</a>', url, obj.place)

    @admin.action(description="Approve selected deletion requests")
    def approve_deletions(self, request, queryset):
        count = 0
        for deletion_request in queryset.filter(status=PlaceDeletionRequest.Status.PENDING):
            approve_place_deletion(deletion_request, request.user)
            count += 1
        self.message_user(
            request,
            f"Approved {count} deletion request(s); their places were permanently deleted.",
            messages.SUCCESS,
        )

    @admin.action(description="Reject selected deletion requests")
    def reject_deletions(self, request, queryset):
        count = 0
        for deletion_request in queryset.filter(status=PlaceDeletionRequest.Status.PENDING):
            reject_place_deletion(deletion_request, request.user)
            count += 1
        self.message_user(request, f"Rejected {count} deletion request(s).", messages.WARNING)

    def get_readonly_fields(self, request, obj=None):
        fields = super().get_readonly_fields(request, obj)
        if obj and obj.status != PlaceDeletionRequest.Status.PENDING:
            return (*fields, "admin_note")
        return fields

    def response_change(self, request, obj):
        change_url = reverse("admin:travel_placedeletionrequest_change", args=(obj.pk,))
        if "_approve_deletion" in request.POST:
            if obj.status != PlaceDeletionRequest.Status.PENDING:
                self.message_user(request, "This deletion request has already been reviewed.", messages.WARNING)
            else:
                approve_place_deletion(obj, request.user)
                self.message_user(request, "The deletion was approved and the place was permanently deleted.", messages.SUCCESS)
            return HttpResponseRedirect(change_url)

        if "_reject_deletion" in request.POST:
            if obj.status != PlaceDeletionRequest.Status.PENDING:
                self.message_user(request, "This deletion request has already been reviewed.", messages.WARNING)
            else:
                reject_place_deletion(obj, request.user)
                self.message_user(request, "The deletion request was rejected; the place remains available.", messages.WARNING)
            return HttpResponseRedirect(change_url)

        return super().response_change(request, obj)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("place", "author", "rating", "created_at")
    list_filter = ("rating", "place__prefecture", "created_at")
    search_fields = ("place__name", "author__username", "comment")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-created_at",)


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("avatar_thumbnail", "user", "nickname", "email_verified", "email_verified_at", "created_at", "updated_at")
    list_filter = ("email_verified", "created_at")
    search_fields = ("user__username", "user__email", "nickname")
    readonly_fields = (
        "email_verified_at", "email_verification_sent_at",
        "password_reset_sent_at", "created_at", "updated_at",
    )
    list_select_related = ("user",)

    @admin.display(description="Avatar")
    def avatar_thumbnail(self, obj):
        return image_preview(obj.profile_image)


class AccountProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    extra = 0
    fields = ("email_verified", "email_verified_at")
    readonly_fields = ("email_verified_at",)


admin.site.unregister(User)


@admin.register(User)
class Japan47UserAdmin(UserAdmin):
    """Expose account state without ever exposing verification/reset tokens."""

    inlines = (AccountProfileInline,)
    list_display = (
        "username", "email", "email_is_verified", "is_active",
        "is_staff", "date_joined", "last_login",
    )
    list_filter = ("profile__email_verified", "is_active", "is_staff", "is_superuser", "date_joined")
    search_fields = ("username", "email", "profile__nickname")
    list_select_related = ("profile",)

    @admin.display(description="Email verified", boolean=True, ordering="profile__email_verified")
    def email_is_verified(self, obj):
        return obj.profile.email_verified


@admin.register(ContentReport)
class ContentReportAdmin(admin.ModelAdmin):
    list_display = ("id", "target_type", "target_link", "reporter_display", "status_display", "resolved_by", "resolved_at", "created_at")
    list_filter = ("status", ReportTargetFilter, "created_at")
    list_select_related = ("reporter", "place", "review", "resolved_by")
    readonly_fields = ("reporter_display", "place", "review", "target_link", "reason", "created_at", "resolved_at", "resolved_by")
    search_fields = ("reporter__username", "place__name", "review__comment", "reason")
    actions = ("resolve_reports", "dismiss_reports")

    @admin.display(description="Type")
    def target_type(self, obj):
        return "Review" if obj.review_id else "Place"

    @admin.display(description="Reporter", ordering="reporter__username")
    def reporter_display(self, obj):
        return obj.reporter or "Deleted user"

    @admin.display(description="Reported object")
    def target_link(self, obj):
        target = obj.review if obj.review_id else obj.place
        if not target:
            return "—"
        model_name = "review" if obj.review_id else "place"
        url = reverse(f"admin:travel_{model_name}_change", args=(target.pk,))
        return format_html('<a href="{}">{}</a>', url, target)

    @admin.display(description="Status", ordering="status")
    def status_display(self, obj):
        return status_badge(obj)

    @admin.action(description="Resolve selected reports")
    def resolve_reports(self, request, queryset):
        count = queryset.update(
            status=ContentReport.Status.RESOLVED,
            resolved_at=timezone.now(),
            resolved_by=request.user,
        )
        self.message_user(request, f"Resolved {count} report(s).", messages.SUCCESS)

    @admin.action(description="Dismiss selected reports")
    def dismiss_reports(self, request, queryset):
        count = queryset.update(
            status=ContentReport.Status.DISMISSED,
            resolved_at=timezone.now(),
            resolved_by=request.user,
        )
        self.message_user(request, f"Dismissed {count} report(s).", messages.WARNING)

    def save_model(self, request, obj, form, change):
        if change and "status" in form.changed_data:
            if obj.status == ContentReport.Status.OPEN:
                obj.resolved_at = None
                obj.resolved_by = None
            else:
                obj.resolved_at = timezone.now()
                obj.resolved_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(PlaceImage)
class PlaceImageAdmin(admin.ModelAdmin):
    list_display = ("image_thumbnail", "place", "caption", "display_order", "created_at")
    list_filter = ("place__prefecture",)
    search_fields = ("place__name", "caption")
    readonly_fields = ("image_large_preview", "thumbnail", "created_at")
    list_select_related = ("place", "place__prefecture")

    @admin.display(description="Image")
    def image_thumbnail(self, obj):
        return image_preview(obj.thumbnail or obj.image)

    @admin.display(description="Image preview")
    def image_large_preview(self, obj):
        return image_preview(obj.image, large=True)


admin.site.register(Favorite)
admin.site.register(VisitedPlace)
admin.site.register(Follow)
admin.site.register(ReviewVote)
admin.site.register(Collection)
admin.site.register(Itinerary)


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    """Keep customer input immutable while staff manage the ticket lifecycle."""

    list_display = (
        "ticket_id", "status_display", "category", "user_display", "registered_email",
        "contact_email_link", "subject", "ticket_age", "created_at", "updated_at",
    )
    list_filter = ("status", "category", "created_at", "updated_at")
    search_fields = (
        "ticket_id", "subject", "message", "user__username",
        "registered_email", "contact_email",
    )
    list_select_related = ("user", "assigned_administrator")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    readonly_fields = (
        "ticket_id", "user_display", "registered_email", "contact_email",
        "contact_email_link", "category", "subject", "related_url",
        "screenshot", "screenshot_preview", "message", "created_at", "updated_at",
    )
    fieldsets = (
        ("Request", {"fields": (
            "ticket_id", "user_display", "registered_email", "contact_email_link",
            "category", "subject", "related_url", "screenshot", "screenshot_preview", "message",
        )}),
        ("Admin workflow", {"fields": ("status", "assigned_administrator", "internal_notes")}),
        ("Audit", {"fields": ("created_at", "updated_at")}),
    )
    actions = ("mark_in_progress", "mark_resolved", "mark_closed")

    @admin.display(description="User", ordering="user__username")
    def user_display(self, obj):
        return obj.user or "Deleted user"

    @admin.display(description="Contact email", ordering="contact_email")
    def contact_email_link(self, obj):
        return format_html('<a href="mailto:{}">{}</a>', obj.contact_email, obj.contact_email)

    @admin.display(description="Status", ordering="status")
    def status_display(self, obj):
        return status_badge(obj)

    @admin.display(description="Age", ordering="created_at")
    def ticket_age(self, obj):
        delta = timezone.now() - obj.created_at
        if delta.days:
            return f"{delta.days}d"
        hours = max(0, int(delta.total_seconds() // 3600))
        return f"{hours}h"

    @admin.display(description="Screenshot preview")
    def screenshot_preview(self, obj):
        return image_preview(obj.screenshot, large=True)

    @admin.action(description="Mark selected tickets in progress")
    def mark_in_progress(self, request, queryset):
        count = queryset.update(status=SupportTicket.Status.IN_PROGRESS, updated_at=timezone.now())
        self.message_user(request, f"Marked {count} ticket(s) in progress.", messages.SUCCESS)

    @admin.action(description="Mark selected tickets resolved")
    def mark_resolved(self, request, queryset):
        count = queryset.update(status=SupportTicket.Status.RESOLVED, updated_at=timezone.now())
        self.message_user(request, f"Resolved {count} ticket(s).", messages.SUCCESS)

    @admin.action(description="Mark selected tickets closed")
    def mark_closed(self, request, queryset):
        count = queryset.update(status=SupportTicket.Status.CLOSED, updated_at=timezone.now())
        self.message_user(request, f"Closed {count} ticket(s).", messages.SUCCESS)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

admin.site.site_header = "Japan 47 administration"
admin.site.site_title = "Japan 47 admin"
admin.site.index_title = "Content and community moderation"
admin.site.index_template = "admin/japan47_index.html"
