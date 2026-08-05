from django.db.models import Q
from django.http import JsonResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from travel.models import Place, Review, ReviewVote

from ..permissions import IsOwnerOrStaff
from ..serializers import ReviewSerializer


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
        _, created = ReviewVote.objects.get_or_create(review=review, user=request.user)
        return JsonResponse({"helpful": True}, status=201 if created else 200)
