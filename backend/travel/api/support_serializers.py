"""API validation for authenticated support requests."""

from rest_framework import serializers

from travel.models import SupportTicket
from travel.support.services import clean_support_text, create_support_ticket


class SupportTicketCreateSerializer(serializers.ModelSerializer):
    ticket_id = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    created_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = SupportTicket
        fields = (
            "ticket_id",
            "category",
            "category_label",
            "subject",
            "contact_email",
            "related_url",
            "screenshot",
            "message",
            "status",
            "created_at",
        )
        extra_kwargs = {
            "screenshot": {"required": False, "allow_null": True, "write_only": True},
            "related_url": {"required": False, "allow_blank": True},
        }

    def validate_subject(self, value):
        value = clean_support_text(value)
        if not value:
            raise serializers.ValidationError("Enter a subject.")
        return value

    def validate_message(self, value):
        value = clean_support_text(value)
        if not value:
            raise serializers.ValidationError("Enter a message.")
        return value

    def validate_contact_email(self, value):
        return value.strip().lower()

    def validate_related_url(self, value):
        return value.strip()

    def create(self, validated_data):
        try:
            return create_support_ticket(
                user=self.context["request"].user,
                validated_data=validated_data,
            )
        except ValueError as exc:
            if str(exc) == "duplicate_support_request":
                raise serializers.ValidationError(
                    {"non_field_errors": ["This request was already sent recently."]}
                ) from exc
            raise
