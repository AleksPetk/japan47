from django.db.models import Count, Q
from django.http import JsonResponse
from rest_framework import viewsets

from travel.models import Place, Prefecture
from travel.services import (
    annotate_places_with_ratings,
    apply_prefecture_rating,
    apply_prefecture_ratings,
    prefetch_prefectures_with_rating_data,
)

from ..serializers import PlaceListSerializer, PrefectureSummarySerializer


class PrefectureViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PrefectureSummarySerializer
    lookup_field = "name"
    pagination_class = None

    def get_queryset(self):
        queryset = Prefecture.objects.select_related("region").annotate(
            published_place_count=Count(
                "places",
                filter=Q(places__status=Place.Status.PUBLISHED),
                distinct=True,
            )
        )
        query = self.request.query_params.get("q", "").strip()
        region = self.request.query_params.get("region", "").strip()
        if query:
            queryset = queryset.filter(
                Q(name__icontains=query) | Q(region__name__icontains=query)
            )
        if region:
            queryset = queryset.filter(region__name__iexact=region)
        return prefetch_prefectures_with_rating_data(
            queryset.order_by("region__display_order", "display_order")
        )

    def list(self, request, *args, **kwargs):
        prefectures = list(self.get_queryset())
        apply_prefecture_ratings(prefectures)
        minimum = request.query_params.get("min_rating")
        if minimum:
            try:
                prefectures = [
                    item
                    for item in prefectures
                    if item.average_rating is not None
                    and item.average_rating >= float(minimum)
                ]
            except ValueError:
                prefectures = []
        ordering = request.query_params.get("ordering", "display_order")
        if ordering == "-average_rating":
            prefectures.sort(
                key=lambda item: (
                    item.average_rating is None,
                    -(item.average_rating or 0),
                    item.display_order,
                )
            )
        elif ordering == "average_rating":
            prefectures.sort(
                key=lambda item: (
                    item.average_rating is None,
                    item.average_rating or 0,
                    item.display_order,
                )
            )
        elif ordering == "-published_place_count":
            prefectures.sort(
                key=lambda item: (-item.published_place_count, item.display_order)
            )
        return JsonResponse(
            list(self.get_serializer(prefectures, many=True).data), safe=False
        )

    def retrieve(self, request, *args, **kwargs):
        prefecture = self.get_object()
        apply_prefecture_rating(prefecture)
        data = self.get_serializer(prefecture).data
        places = annotate_places_with_ratings(
            Place.objects.filter(
                prefecture=prefecture, status=Place.Status.PUBLISHED
            ).select_related(
                "prefecture", "prefecture__region", "author", "author__profile"
            )
        ).order_by("-created_at", "-pk")[:6]
        data["places"] = PlaceListSerializer(
            places, many=True, context={"request": request}
        ).data
        return JsonResponse(data)
