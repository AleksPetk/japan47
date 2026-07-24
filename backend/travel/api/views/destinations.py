from datetime import timedelta

from django.db.models import BooleanField, Count, Exists, OuterRef, Prefetch, Q, Value
from django.http import JsonResponse
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated

from travel.models import Favorite, Place, PlaceImage, PlaceRevision, Review, ReviewVote, VisitedPlace
from travel.services import annotate_places_with_ratings

from ..filters import PlaceFilter
from ..permissions import IsOwnerOrStaff
from ..serializers import (
    PlaceDetailSerializer,
    PlaceListSerializer,
    PlaceWriteSerializer,
    PlaceImageSerializer,
    PlaceRevisionImageSerializer,
    ReviewSerializer,
)


class PlaceViewSet(viewsets.ModelViewSet):
    filterset_class = PlaceFilter
    search_fields = ("name", "description", "city", "prefecture__name")
    ordering_fields = (
        "created_at",
        "updated_at",
        "average_rating",
        "review_count",
        "name",
    )
    ordering = ("-created_at", "-pk")

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            classes = [IsAuthenticated, IsOwnerOrStaff]
        else:
            classes = [AllowAny]
        return [permission() for permission in classes]

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return PlaceWriteSerializer
        return PlaceDetailSerializer if self.action == "retrieve" else PlaceListSerializer

    def get_queryset(self):
        reviews = Review.objects.select_related(
            "author", "author__profile", "place__prefecture"
        ).annotate(helpful_count=Count("helpful_votes"))
        if self.request.user.is_authenticated:
            reviews = reviews.annotate(
                viewer_found_helpful=Exists(
                    ReviewVote.objects.filter(
                        user=self.request.user, review_id=OuterRef("pk")
                    )
                )
            )
        else:
            reviews = reviews.annotate(
                viewer_found_helpful=Value(False, output_field=BooleanField())
            )
        queryset = annotate_places_with_ratings(
            Place.objects.select_related(
                "author", "author__profile", "prefecture", "prefecture__region"
            )
        )
        if self.request.user.is_authenticated:
            queryset = queryset.annotate(
                viewer_has_favorite=Exists(
                    Favorite.objects.filter(user=self.request.user, place_id=OuterRef("pk"))
                ),
                viewer_has_visited=Exists(
                    VisitedPlace.objects.filter(user=self.request.user, place_id=OuterRef("pk"))
                ),
            )
        if self.action == "retrieve":
            queryset = queryset.prefetch_related(
                Prefetch("reviews", queryset=reviews),
                "gallery_images",
                Prefetch(
                    "revisions",
                    queryset=PlaceRevision.objects.select_related(
                        "prefecture", "prefecture__region"
                    ).prefetch_related("gallery_images"),
                    to_attr="moderation_revisions",
                ),
            )
        user = self.request.user
        if user.is_authenticated and user.is_staff:
            return queryset
        if user.is_authenticated:
            return queryset.filter(
                Q(status=Place.Status.PUBLISHED) | Q(author=user)
            ).distinct()
        return queryset.filter(status=Place.Status.PUBLISHED)

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def mine(self, request):
        queryset = self.filter_queryset(
            self.get_queryset().filter(author=request.user)
        )
        page = self.paginate_queryset(queryset)
        serializer = PlaceListSerializer(
            page, many=True, context={"request": request}
        )
        response = self.get_paginated_response(serializer.data)
        return JsonResponse(response.data)

    @action(detail=False, methods=["get"], permission_classes=[AllowAny])
    def trending(self, request):
        """Return places receiving the most review activity in the last month."""

        cutoff = timezone.now() - timedelta(days=30)
        queryset = self.get_queryset().annotate(
            recent_review_count=Count(
                "reviews", filter=Q(reviews__created_at__gte=cutoff), distinct=True
            )
        ).filter(recent_review_count__gt=0).order_by(
            "-recent_review_count", "-average_rating", "-created_at"
        )[:6]
        data = PlaceListSerializer(
            queryset, many=True, context={"request": request}
        ).data
        return JsonResponse({"results": list(data)})

    def retrieve(self, request, *args, **kwargs):
        place = self.get_object()
        data = self.get_serializer(place).data
        related = annotate_places_with_ratings(
            Place.objects.filter(
                status=Place.Status.PUBLISHED,
                prefecture=place.prefecture,
            )
            .exclude(pk=place.pk)
            .select_related("author", "author__profile", "prefecture", "prefecture__region")
        ).order_by("-average_rating", "-created_at")[:3]
        nearby = annotate_places_with_ratings(
            Place.objects.filter(status=Place.Status.PUBLISHED)
            .filter(Q(city__iexact=place.city) if place.city else Q(prefecture=place.prefecture))
            .exclude(pk=place.pk)
            .select_related("author", "author__profile", "prefecture", "prefecture__region")
        ).order_by("-average_rating", "-created_at")[:3]
        distribution = {
            rating: place.reviews.filter(rating=rating).count()
            for rating in range(5, 0, -1)
        }
        data["related_places"] = PlaceListSerializer(related, many=True, context={"request": request}).data
        data["nearby_places"] = PlaceListSerializer(nearby, many=True, context={"request": request}).data
        data["rating_distribution"] = distribution
        return JsonResponse(data)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def images(self, request, pk=None):
        place = self.get_object()
        if not (request.user.is_staff or place.author_id == request.user.id):
            return JsonResponse({"error": {"code": "permission_denied", "message": "Only the owner can add gallery images."}}, status=403)
        if place.status == Place.Status.PUBLISHED:
            revision = PlaceRevision.objects.filter(
                place=place,
                status=PlaceRevision.Status.PENDING,
            ).first()
            if revision is None:
                return JsonResponse(
                    {
                        "error": {
                            "code": "pending_revision_required",
                            "message": "Save the proposed place changes before adding gallery images.",
                        }
                    },
                    status=409,
                )
            serializer = PlaceRevisionImageSerializer(data=request.data, context={"request": request})
            serializer.is_valid(raise_exception=True)
            serializer.save(revision=revision)
            return JsonResponse({**serializer.data, "pending_revision": True}, status=201)
        serializer = PlaceImageSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save(place=place)
        return JsonResponse(serializer.data, status=201)

    @action(detail=True, methods=["post", "delete"], permission_classes=[IsAuthenticated])
    def favorite(self, request, pk=None):
        place = self.get_object()
        if request.method == "DELETE":
            Favorite.objects.filter(user=request.user, place=place).delete()
            # A 204 response cannot contain a body. Clearing the serialized
            # JSON also prevents Vite's Node proxy from waiting for two bytes
            # advertised by an otherwise empty ``{}`` response.
            response = JsonResponse({}, status=204)
            response.content = b""
            return response
        favorite, created = Favorite.objects.get_or_create(user=request.user, place=place)
        return JsonResponse({"favorite": True}, status=201 if created else 200)

    @action(detail=True, methods=["post", "delete"], permission_classes=[IsAuthenticated])
    def visited(self, request, pk=None):
        place = self.get_object()
        if request.method == "DELETE":
            VisitedPlace.objects.filter(user=request.user, place=place).delete()
            response = JsonResponse({}, status=204)
            response.content = b""
            return response
        visited, created = VisitedPlace.objects.get_or_create(user=request.user, place=place)
        return JsonResponse({"visited": True}, status=201 if created else 200)


class ReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewSerializer
    permission_classes = [IsOwnerOrStaff]
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticated()]
        return super().get_permissions()

    def get_queryset(self):
        queryset = Review.objects.select_related(
            "author", "author__profile", "place", "place__prefecture"
        )
        user = self.request.user
        if not (user.is_authenticated and user.is_staff):
            visibility = Q(place__status=Place.Status.PUBLISHED)
            if user.is_authenticated:
                visibility |= Q(place__author=user)
            queryset = queryset.filter(visibility)
        place_id = self.request.query_params.get("place")
        author_id = self.request.query_params.get("author")
        if place_id:
            queryset = queryset.filter(place_id=place_id)
        if author_id:
            queryset = queryset.filter(author_id=author_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    @action(detail=True, methods=["post", "delete"], permission_classes=[IsAuthenticated])
    def helpful(self, request, pk=None):
        review = self.get_object()
        if request.method == "DELETE":
            ReviewVote.objects.filter(review=review, user=request.user).delete()
            return JsonResponse({}, status=204)
        vote, created = ReviewVote.objects.get_or_create(review=review, user=request.user)
        return JsonResponse({"helpful": True}, status=201 if created else 200)
