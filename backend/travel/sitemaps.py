"""Dynamic public sitemap for Japan47 canonical HTML URLs."""

from __future__ import annotations

from datetime import datetime
from urllib.parse import urlparse
from xml.sax.saxutils import escape

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Count, Max, Q
from django.http import HttpResponse
from django.utils import timezone

from .models import Place, Prefecture, Region

User = get_user_model()

# Keep list pages aligned with frontend/src/utils/seo.js routeMetadata and
# prerendered public geography pages. Query-string filters are never listed.
STATIC_PATHS = (
    "/",
    "/regions",
    "/prefectures",
    "/places",
    "/search",
    "/privacy",
    "/terms",
    "/support",
)


def public_origin() -> str:
    """Return the absolute public site origin without a trailing slash."""
    return settings.FRONTEND_URL.rstrip("/")


def absolute_loc(path: str) -> str:
    """Build a canonical absolute URL using the no-trailing-slash policy."""
    if path == "/":
        return f"{public_origin()}/"
    return f"{public_origin()}{path if path.startswith('/') else f'/{path}'}"


def iso_lastmod(value: datetime | None) -> str | None:
    if value is None:
        return None
    if timezone.is_naive(value):
        value = timezone.make_aware(value, timezone.get_current_timezone())
    return value.astimezone(timezone.UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def iter_sitemap_entries():
    """Yield dicts with loc and optional lastmod for every public indexable URL."""
    for path in STATIC_PATHS:
        yield {"loc": absolute_loc(path), "lastmod": None}

    for region in Region.objects.order_by("display_order").only("name"):
        yield {"loc": absolute_loc(f"/regions/{region.name}"), "lastmod": None}

    for prefecture in Prefecture.objects.order_by("display_order").only("name"):
        yield {
            "loc": absolute_loc(f"/prefectures/{prefecture.name}"),
            "lastmod": None,
        }

    published_places = (
        Place.objects.filter(status=Place.Status.PUBLISHED)
        .order_by("id")
        .only("id", "slug", "updated_at")
    )
    for place in published_places:
        yield {
            "loc": absolute_loc(f"/places/{place.id}/{place.slug}"),
            "lastmod": iso_lastmod(place.updated_at),
        }

    # Only contributors with public places or reviews deserve indexing; empty
    # profiles stay out of the sitemap to avoid thin duplicate URLs.
    contributors = (
        User.objects.filter(is_active=True)
        .annotate(
            published_place_count=Count(
                "places",
                filter=Q(places__status=Place.Status.PUBLISHED),
                distinct=True,
            ),
            public_review_count=Count("reviews", distinct=True),
            place_lastmod=Max(
                "places__updated_at",
                filter=Q(places__status=Place.Status.PUBLISHED),
            ),
            review_lastmod=Max("reviews__updated_at"),
        )
        .filter(Q(published_place_count__gt=0) | Q(public_review_count__gt=0))
        .order_by("id")
    )
    for user in contributors:
        lastmod_candidates = [user.place_lastmod, user.review_lastmod]
        lastmod = max((value for value in lastmod_candidates if value is not None), default=None)
        yield {
            "loc": absolute_loc(f"/contributors/{user.id}"),
            "lastmod": iso_lastmod(lastmod),
        }


def render_sitemap_xml(entries) -> str:
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for entry in entries:
        lines.append("  <url>")
        lines.append(f"    <loc>{escape(entry['loc'])}</loc>")
        if entry.get("lastmod"):
            lines.append(f"    <lastmod>{escape(entry['lastmod'])}</lastmod>")
        lines.append("  </url>")
    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


def sitemap_xml(request):
    """Serve a dynamically generated sitemap of canonical public pages."""
    # Guarding against accidental localhost FRONTEND_URL in production keeps
    # Search Console from ingesting non-public absolute URLs.
    host = urlparse(public_origin()).hostname or ""
    if settings.DEBUG is False and host in {"localhost", "127.0.0.1"}:
        return HttpResponse(
            "Sitemap requires a public FRONTEND_URL.",
            status=500,
            content_type="text/plain; charset=utf-8",
        )

    xml = render_sitemap_xml(iter_sitemap_entries())
    response = HttpResponse(xml, content_type="application/xml; charset=utf-8")
    response["Cache-Control"] = "public, max-age=300"
    return response
