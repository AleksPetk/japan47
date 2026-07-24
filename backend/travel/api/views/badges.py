from django.http import JsonResponse
from drf_spectacular.utils import extend_schema
from rest_framework import generics
from rest_framework.permissions import AllowAny

from travel.models import Region

from ..serializers import BadgeSerializer, badge_catalog


class BadgesView(generics.GenericAPIView):
    serializer_class = BadgeSerializer
    queryset = Region.objects.none()
    permission_classes = [AllowAny]

    @extend_schema(responses=BadgeSerializer(many=True))
    def get(self, request):
        return JsonResponse(badge_catalog(request), safe=False)

