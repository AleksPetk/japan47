from django.contrib.auth import get_user_model
from django.db.models import Prefetch, Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated

from travel.models import Collection, ContentReport, Favorite, Follow, Itinerary, ItineraryStop, Place, VisitedPlace
from travel.services import personalize_places

from ..permissions import IsOwnerOrStaff
from ..serializers import (
    CollectionSerializer,
    ContentReportSerializer,
    FavoriteSerializer,
    ItinerarySerializer,
    ItineraryStopSerializer,
    VisitedPlaceSerializer,
)

User = get_user_model()


def personalized_places(user):
    """Load card data and viewer state once for nested personal resources."""

    return personalize_places(
        Place.objects.select_related(
            "author", "author__profile", "prefecture", "prefecture__region"
        ),
        user,
    )


class OwnedModelViewSet(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, IsOwnerOrStaff)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class FavoriteViewSet(OwnedModelViewSet):
    serializer_class = FavoriteSerializer
    queryset = Favorite.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return self.queryset
        return Favorite.objects.filter(user=self.request.user).prefetch_related(
            Prefetch("place", queryset=personalized_places(self.request.user))
        )


class VisitedPlaceViewSet(OwnedModelViewSet):
    serializer_class = VisitedPlaceSerializer
    queryset = VisitedPlace.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return self.queryset
        return VisitedPlace.objects.filter(user=self.request.user).prefetch_related(
            Prefetch("place", queryset=personalized_places(self.request.user))
        )


class CollectionViewSet(viewsets.ModelViewSet):
    serializer_class = CollectionSerializer
    permission_classes = (IsAuthenticated, IsOwnerOrStaff)
    queryset = Collection.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return self.queryset
        queryset = Collection.objects.select_related("owner").prefetch_related(
            Prefetch("places", queryset=personalized_places(self.request.user))
        )
        if self.action in {"list", "create"}:
            return queryset.filter(owner=self.request.user)
        return queryset.filter(Q(owner=self.request.user) | Q(is_public=True)).distinct()


class ItineraryViewSet(viewsets.ModelViewSet):
    serializer_class = ItinerarySerializer
    permission_classes = (IsAuthenticated, IsOwnerOrStaff)
    queryset = Itinerary.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return self.queryset
        queryset = Itinerary.objects.select_related("owner").prefetch_related(
            "stops",
            Prefetch("stops__place", queryset=personalized_places(self.request.user)),
        )
        if self.action in {"list", "create"}:
            return queryset.filter(owner=self.request.user)
        return queryset.filter(Q(owner=self.request.user) | Q(is_public=True)).distinct()

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=("post",), permission_classes=(IsAuthenticated,))
    def add_stop(self, request, pk=None):
        itinerary = self.get_object()
        if itinerary.owner_id != request.user.id:
            return JsonResponse({"error": {"code": "permission_denied", "message": "Only the owner can edit this itinerary."}}, status=403)
        serializer = ItineraryStopSerializer(
            data=request.data, context={"request": request, "itinerary": itinerary}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(itinerary=itinerary)
        return JsonResponse(serializer.data, status=status.HTTP_201_CREATED)


class ContentReportViewSet(viewsets.ModelViewSet):
    serializer_class = ContentReportSerializer
    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "post", "head", "options")
    queryset = ContentReport.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return self.queryset
        queryset = ContentReport.objects.select_related("reporter", "place", "review")
        return queryset if self.request.user.is_staff else queryset.filter(reporter=self.request.user)

    def perform_create(self, serializer):
        serializer.save(reporter=self.request.user)


class FollowViewSet(viewsets.ViewSet):
    permission_classes = (IsAuthenticated,)
    queryset = User.objects.none()

    @extend_schema(request=None, responses={200: OpenApiTypes.OBJECT, 201: OpenApiTypes.OBJECT, 204: None})
    @action(detail=True, methods=("post", "delete"))
    def follow(self, request, pk=None):
        target = get_object_or_404(User, pk=pk, is_active=True)
        if target == request.user:
            return JsonResponse({"error": {"code": "validation_error", "message": "You cannot follow yourself."}}, status=400)
        if request.method == "DELETE":
            Follow.objects.filter(follower=request.user, following=target).delete()
            return JsonResponse({}, status=204)
        follow, created = Follow.objects.get_or_create(follower=request.user, following=target)
        return JsonResponse({"following": True}, status=201 if created else 200)
