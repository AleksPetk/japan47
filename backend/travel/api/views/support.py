"""Authenticated support metadata and ticket submission endpoint."""

from django.http import JsonResponse
from rest_framework import generics, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import ScopedRateThrottle
from travel.models import SupportTicket

from ..support_serializers import SupportTicketCreateSerializer


class SupportTicketView(generics.GenericAPIView):
    serializer_class = SupportTicketCreateSerializer
    permission_classes = (IsAuthenticated,)
    parser_classes = (JSONParser, FormParser, MultiPartParser)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "support"

    def get_throttles(self):
        """Fetching form choices is free; only ticket submissions consume quota."""

        return super().get_throttles() if self.request.method == "POST" else []

    def get(self, request):
        return JsonResponse(
            {
                "categories": [
                    {"value": value, "label": label}
                    for value, label in SupportTicket.Category.choices
                ],
                "default_contact_email": request.user.email,
                "screenshot": {
                    "optional": True,
                    "max_size_mb": 5,
                    "accepted_types": [
                        "image/jpeg",
                        "image/png",
                        "image/webp",
                        "image/heic",
                        "image/heif",
                    ],
                },
            }
        )

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ticket = serializer.save()
        return JsonResponse(
            self.get_serializer(ticket).data,
            status=status.HTTP_201_CREATED,
        )
