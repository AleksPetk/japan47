from django.contrib.auth import get_user_model
from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.db.models import Count, F, IntegerField, Q, Value
from django.http import JsonResponse
from rest_framework import generics
from rest_framework.permissions import AllowAny
from urllib.parse import urlsplit, urlunsplit

from travel.models import Place, Prefecture, Region
from travel.services import (
    annotate_places_with_ratings,
    apply_prefecture_ratings,
    apply_region_ratings,
    bayesian_rating,
    get_contributor_stats,
    prefetch_prefectures_with_rating_data,
    prefetch_regions_with_rating_data,
)

from ..serializers import (
    HealthSerializer,
    HomeResponseSerializer,
    PlaceListSerializer,
    PrefectureSummarySerializer,
    RegionSerializer,
    SearchResponseSerializer,
    UserSummarySerializer,
)

User = get_user_model()

HOME_IMAGE_URL_KEYS = {"image_url", "thumbnail_url", "profile_image_url"}


def transform_home_image_urls(value, transform):
    """Copy a home payload while transforming only media URL fields."""

    if isinstance(value, list):
        return [transform_home_image_urls(item, transform) for item in value]
    if isinstance(value, dict):
        return {
            key: (
                transform(item)
                if key in HOME_IMAGE_URL_KEYS and isinstance(item, str)
                else transform_home_image_urls(item, transform)
            )
            for key, item in value.items()
        }
    return value


def cache_safe_home_payload(payload):
    """Strip request hosts from cached media so one device cannot leak into another."""

    def media_path(url):
        parsed = urlsplit(url)
        if parsed.path.startswith(settings.MEDIA_URL):
            return urlunsplit(("", "", parsed.path, parsed.query, parsed.fragment))
        return url

    return transform_home_image_urls(payload, media_path)


def home_payload_for_request(payload, request):
    """Build media URLs using the host currently requesting the cached home data."""

    def request_media_url(url):
        parsed = urlsplit(url)
        if parsed.path.startswith(settings.MEDIA_URL):
            relative_url = urlunsplit(("", "", parsed.path, parsed.query, parsed.fragment))
            return request.build_absolute_uri(relative_url)
        return url

    return transform_home_image_urls(payload, request_media_url)


class HealthView(generics.GenericAPIView):
    serializer_class = HealthSerializer
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = []

    def get(self, request):
        try:
            connection.ensure_connection()
            cache.set("health-check", "ok", timeout=5)
            healthy = cache.get("health-check") == "ok"
        except Exception:  # Never expose database or cache internals publicly.
            healthy = False
        return JsonResponse(
            {"status": "ok" if healthy else "degraded", "service": "japan-47-api", "version": "v1"},
            status=200 if healthy else 503,
        )


class HomeView(generics.GenericAPIView):
    serializer_class = HomeResponseSerializer
    permission_classes = [AllowAny]

    def get(self, request):
        cache_key = "api:v1:home"
        if not request.user.is_authenticated:
            cached = cache.get(cache_key)
            if cached is not None:
                return JsonResponse(home_payload_for_request(cached, request))
        places = annotate_places_with_ratings(
            Place.objects.filter(status=Place.Status.PUBLISHED).select_related(
                "author", "author__profile", "prefecture", "prefecture__region"
            )
        )
        latest = list(places.order_by("-created_at", "-pk")[:3])
        rated_places = list(places.exclude(average_rating=None))
        global_average = (
            sum(item.average_rating for item in rated_places) / len(rated_places)
            if rated_places else 3.5
        )
        top_places = sorted(
            rated_places,
            key=lambda item: (
                -bayesian_rating(item.average_rating, item.review_count, global_average),
                -item.review_count,
                -item.pk,
            ),
        )[:3]
        prefectures = list(
            prefetch_prefectures_with_rating_data(
                Prefecture.objects.select_related("region").annotate(
                    published_place_count=Count(
                        "places",
                        filter=Q(places__status=Place.Status.PUBLISHED),
                        distinct=True,
                    )
                )
            )
        )
        apply_prefecture_ratings(prefectures)
        top_prefectures = sorted(
            (p for p in prefectures if p.average_rating is not None),
            key=lambda p: (-p.average_rating, p.display_order),
        )[:3]
        regions = list(
            prefetch_regions_with_rating_data(
                Region.objects.annotate(
                    prefecture_count=Count("prefectures", distinct=True),
                    published_place_count=Count(
                        "prefectures__places",
                        filter=Q(
                            prefectures__places__status=Place.Status.PUBLISHED
                        ),
                        distinct=True,
                    ),
                )
            )
        )
        apply_region_ratings(regions)
        top_regions = sorted(
            (r for r in regions if r.average_rating is not None),
            key=lambda r: (-r.average_rating, r.display_order),
        )[:3]
        contributors = list(
            User.objects.filter(is_active=True, profile__isnull=False)
            .select_related("profile")
            .annotate(
                published_place_count=Count(
                    "places",
                    filter=Q(places__status=Place.Status.PUBLISHED),
                    distinct=True,
                ),
                contributor_review_count=Count("reviews", distinct=True),
            )
            .annotate(
                contributor_points=F("published_place_count")
                * Value(5, output_field=IntegerField())
                + F("contributor_review_count")
            )
            .order_by(
                "-contributor_points",
                "-published_place_count",
                "-contributor_review_count",
                "date_joined",
                "pk",
            )[:3]
        )
        contributor_data = []
        for contributor in contributors:
            item = UserSummarySerializer(
                contributor, context={"request": request}
            ).data
            item["stats"] = get_contributor_stats(
                contributor.published_place_count,
                contributor.contributor_review_count,
            )
            contributor_data.append(item)
        response_data = {
                "stats": {
                    "regions": Region.objects.count(),
                    "prefectures": Prefecture.objects.count(),
                    "places": Place.objects.filter(status=Place.Status.PUBLISHED).count(),
                    "contributors": User.objects.filter(is_active=True, profile__isnull=False).count(),
                },
                "latest_places": list(
                    PlaceListSerializer(
                        latest, many=True, context={"request": request}
                    ).data
                ),
                "top_places": list(
                    PlaceListSerializer(
                        top_places, many=True, context={"request": request}
                    ).data
                ),
                "top_prefectures": list(
                    PrefectureSummarySerializer(
                        top_prefectures, many=True, context={"request": request}
                    ).data
                ),
                "top_regions": list(
                    RegionSerializer(
                        top_regions, many=True, context={"request": request}
                    ).data
                ),
                "top_contributors": contributor_data,
            }
        if not request.user.is_authenticated:
            cache.set(cache_key, cache_safe_home_payload(response_data), timeout=300)
        return JsonResponse(response_data)


class SearchView(generics.GenericAPIView):
    serializer_class = SearchResponseSerializer
    permission_classes = [AllowAny]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if len(query) < 2:
            return JsonResponse({"regions": [], "prefectures": [], "places": []})
        places = annotate_places_with_ratings(
            Place.objects.filter(status=Place.Status.PUBLISHED)
            .filter(
                Q(name__icontains=query)
                | Q(description__icontains=query)
                | Q(city__icontains=query)
                | Q(prefecture__name__icontains=query)
            )
            .select_related(
                "author", "author__profile", "prefecture", "prefecture__region"
            )
        )[:10]
        prefectures = (
            Prefecture.objects.filter(
                Q(name__icontains=query) | Q(description__icontains=query)
            )
            .select_related("region")
            .annotate(
                published_place_count=Count(
                    "places",
                    filter=Q(places__status=Place.Status.PUBLISHED),
                    distinct=True,
                )
            )[:10]
        )
        prefectures = list(prefetch_prefectures_with_rating_data(prefectures))
        apply_prefecture_ratings(prefectures)
        regions = list(
            prefetch_regions_with_rating_data(
                Region.objects.filter(
                    Q(name__icontains=query) | Q(description__icontains=query)
                ).annotate(
                    prefecture_count=Count("prefectures", distinct=True),
                    published_place_count=Count(
                        "prefectures__places",
                        filter=Q(
                            prefectures__places__status=Place.Status.PUBLISHED
                        ),
                        distinct=True,
                    ),
                )[:10]
            )
        )
        apply_region_ratings(regions)
        return JsonResponse(
            {
                "regions": list(
                    RegionSerializer(
                        regions, many=True, context={"request": request}
                    ).data
                ),
                "prefectures": list(
                    PrefectureSummarySerializer(
                        prefectures, many=True, context={"request": request}
                    ).data
                ),
                "places": list(
                    PlaceListSerializer(
                        places, many=True, context={"request": request}
                    ).data
                ),
            }
        )
