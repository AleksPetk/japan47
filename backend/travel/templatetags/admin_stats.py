"""Server-rendered admin workload counts shared by the sidebar and dashboard."""

from datetime import timedelta

from django import template
from django.contrib.auth.models import User
from django.db.models import Avg, Count, Q
from django.utils import timezone

from travel.models import ContentReport, Place, PlaceRevision, Prefecture, Region, Review, SupportTicket

register = template.Library()


def admin_metrics(request):
    """Compute each aggregate once per request, even when two templates use it."""

    cached = getattr(request, "_japan47_admin_metrics", None)
    if cached is not None:
        return cached

    places = Place.objects.aggregate(
        pending=Count("id", filter=Q(status=Place.Status.PENDING)),
        published=Count("id", filter=Q(status=Place.Status.PUBLISHED)),
        rejected=Count("id", filter=Q(status=Place.Status.REJECTED)),
    )
    support = SupportTicket.objects.aggregate(
        new=Count("id", filter=Q(status=SupportTicket.Status.NEW)),
        total=Count("id"),
        resolved=Count("id", filter=Q(status=SupportTicket.Status.RESOLVED)),
    )
    reports = ContentReport.objects.aggregate(
        open=Count("id", filter=Q(status=ContentReport.Status.OPEN)),
        reported_reviews=Count(
            "id", filter=Q(status=ContentReport.Status.OPEN, review__isnull=False)
        ),
        reported_places=Count(
            "id", filter=Q(status=ContentReport.Status.OPEN, place__isnull=False)
        ),
    )
    now = timezone.now()
    users = User.objects.aggregate(
        total=Count("id"),
        today=Count("id", filter=Q(date_joined__date=timezone.localdate())),
        week=Count("id", filter=Q(date_joined__gte=now - timedelta(days=7))),
        verified=Count("id", filter=Q(profile__email_verified=True)),
        unverified=Count("id", filter=Q(profile__email_verified=False)),
    )
    reviews = Review.objects.aggregate(total=Count("id"), average=Avg("rating"))
    pending_revisions = PlaceRevision.objects.filter(status=PlaceRevision.Status.PENDING).count()

    metrics = {
        **places,
        "new_support": support["new"],
        "total_support": support["total"],
        "resolved_support": support["resolved"],
        "open_reports": reports["open"],
        "reported_reviews": reports["reported_reviews"],
        "reported_places": reports["reported_places"],
        "total_users": users["total"],
        "users_today": users["today"],
        "users_week": users["week"],
        "verified_users": users["verified"],
        "unverified_users": users["unverified"],
        "total_reviews": reviews["total"],
        "average_rating": round(reviews["average"] or 0, 2),
        "pending_revisions": pending_revisions,
        "total_prefectures": Prefecture.objects.count(),
        "total_regions": Region.objects.count(),
    }
    request._japan47_admin_metrics = metrics
    return metrics


@register.inclusion_tag("admin/japan47_stats.html", takes_context=True)
def japan47_admin_stats(context):
    return {"metrics": admin_metrics(context["request"])}


@register.inclusion_tag("admin/japan47_sidebar.html", takes_context=True)
def japan47_admin_sidebar(context):
    request = context["request"]
    counts = admin_metrics(request)
    definitions = {
        "Place": (counts["pending"], "status__exact=pending"),
        "PlaceRevision": (counts["pending_revisions"], "status__exact=pending"),
        "SupportTicket": (counts["new_support"], "status__exact=new"),
        "ContentReport": (counts["open_reports"], "status__exact=open"),
    }
    apps = []
    for app in context.get("available_apps", []):
        app_data = {**app, "models": []}
        for model in app["models"]:
            model_data = dict(model)
            count, query = definitions.get(model["object_name"], (0, ""))
            model_data.update(attention_count=count, attention_url=(f'{model["admin_url"]}?{query}' if count else ""))
            if model["object_name"] == "ContentReport":
                model_data["reported_reviews"] = counts["reported_reviews"]
                model_data["reported_places"] = counts["reported_places"]
            app_data["models"].append(model_data)
        apps.append(app_data)
    return {"apps": apps, "request": request}
