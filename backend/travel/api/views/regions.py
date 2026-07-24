from django.db.models import Count, Q
from django.http import JsonResponse
from rest_framework import viewsets

from travel.models import Place, Prefecture, Region
from travel.services import (
    annotate_places_with_ratings,
    apply_region_rating,
    apply_region_ratings,
    prefetch_regions_with_rating_data,
)

from ..serializers import PlaceListSerializer, PrefectureSummarySerializer, RegionSerializer


class RegionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = RegionSerializer
    lookup_field = "name"
    pagination_class = None

    def get_queryset(self):
        return prefetch_regions_with_rating_data(
            Region.objects.annotate(
                prefecture_count=Count("prefectures", distinct=True),
                published_place_count=Count(
                    "prefectures__places",
                    filter=Q(prefectures__places__status=Place.Status.PUBLISHED),
                    distinct=True,
                ),
            ).order_by("display_order")
        )

    def list(self, request, *args, **kwargs):
        regions = list(self.get_queryset())
        apply_region_ratings(regions)
        return JsonResponse(
            list(self.get_serializer(regions, many=True).data), safe=False
        )

    def retrieve(self, request, *args, **kwargs):
        region = self.get_object()
        apply_region_rating(region)
        data = self.get_serializer(region).data
        prefectures = list(region.prefectures.all())
        counts = dict(
            Prefecture.objects.filter(region=region)
            .annotate(
                total=Count(
                    "places",
                    filter=Q(places__status=Place.Status.PUBLISHED),
                    distinct=True,
                )
            )
            .values_list("pk", "total")
        )
        for prefecture in prefectures:
            prefecture.published_place_count = counts[prefecture.pk]
        data["prefectures"] = PrefectureSummarySerializer(
            prefectures, many=True, context={"request": request}
        ).data
        rated_prefectures = [item for item in prefectures if item.average_rating is not None]
        if rated_prefectures:
            top = max(rated_prefectures, key=lambda item: item.average_rating)
            data["top_prefecture"] = PrefectureSummarySerializer(top, context={"request": request}).data
        else:
            data["top_prefecture"] = None
        popular = annotate_places_with_ratings(
            Place.objects.filter(prefecture__region=region, status=Place.Status.PUBLISHED)
            .select_related("author", "author__profile", "prefecture", "prefecture__region")
        ).order_by("-review_count", "-average_rating", "-created_at")[:3]
        data["popular_places"] = PlaceListSerializer(popular, many=True, context={"request": request}).data
        return JsonResponse(data)
