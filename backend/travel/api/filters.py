import django_filters
from django.db.models import Avg

from travel.models import Place


class PlaceFilter(django_filters.FilterSet):
    prefecture = django_filters.CharFilter(field_name="prefecture__name", lookup_expr="iexact")
    region = django_filters.CharFilter(field_name="prefecture__region__name", lookup_expr="iexact")
    min_rating = django_filters.NumberFilter(method="filter_min_rating")
    author = django_filters.NumberFilter(field_name="author_id")
    best_season = django_filters.ChoiceFilter(choices=Place.Season.choices)

    class Meta:
        model = Place
        fields = ("prefecture", "region", "author", "best_season")

    def filter_min_rating(self, queryset, name, value):
        if value < 1 or value > 5:
            return queryset.none()
        if "average_rating" not in queryset.query.annotations:
            queryset = queryset.annotate(average_rating=Avg("reviews__rating"))
        return queryset.filter(average_rating__gte=value)
