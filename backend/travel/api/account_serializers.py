"""Validation and JWT rules for account verification and recovery."""

from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken
from travel.accounts.services import (
    invalidate_user_refresh_tokens,
    normalize_email,
    normalize_username,
)

User = get_user_model()


class EmailNotVerified(AuthenticationFailed):
    default_detail = "Confirm your email address before signing in."
    default_code = "EMAIL_NOT_VERIFIED"


class VerifiedTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Preserve SimpleJWT while refusing credentials for pending accounts."""

    def validate(self, attrs):
        entered_username = (attrs.get(self.username_field) or "").strip()
        matching_usernames = list(
            User.objects.filter(username__iexact=normalize_username(entered_username)).values_list(
                "username", flat=True
            )[:2]
        )
        # Use the canonical stored spelling when the case-insensitive match is
        # unambiguous. Legacy mixed-case accounts therefore continue to work,
        # while a malformed database containing case-colliding users never
        # authenticates one account arbitrarily.
        if len(matching_usernames) == 1:
            attrs[self.username_field] = matching_usernames[0]
        credentials = {
            self.username_field: attrs.get(self.username_field),
            "password": attrs.get("password"),
        }
        user = authenticate(request=self.context.get("request"), **credentials)
        if user is not None and user.is_active:
            profile = getattr(user, "profile", None)
            if not profile or not profile.email_verified:
                raise EmailNotVerified()
        return super().validate(attrs)


class VerifiedTokenRefreshSerializer(TokenRefreshSerializer):
    """Prevent an old refresh token from bypassing a changed verification state."""

    def validate(self, attrs):
        try:
            token = RefreshToken(attrs["refresh"])
            user_id = token[api_settings.USER_ID_CLAIM]
            user = User.objects.select_related("profile").get(
                **{api_settings.USER_ID_FIELD: user_id}
            )
        except (KeyError, User.DoesNotExist, TokenError):
            raise InvalidToken("Token is invalid or expired.")
        if not user.is_active or not user.profile.email_verified:
            raise InvalidToken("Token is invalid or expired.")
        return super().validate(attrs)


class EmailRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return normalize_email(value)


class EmailVerificationSerializer(serializers.Serializer):
    token = serializers.CharField(write_only=True, trim_whitespace=False, max_length=2000)


class PasswordVerificationSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("The current password is incorrect.")
        return value

    def validate(self, attrs):
        user = self.context["request"].user
        if user.is_staff or user.is_superuser:
            raise serializers.ValidationError(
                {
                    "account": (
                        "Staff or superuser privileges must first be removed "
                        "by another authorized administrator."
                    )
                }
            )
        return attrs


class AccountDeletionSerializer(PasswordVerificationSerializer):
    confirmation = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_confirmation(self, value):
        if value != "DELETE":
            raise serializers.ValidationError('Type "DELETE" exactly to confirm account deletion.')
        return value


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField(write_only=True, max_length=128)
    token = serializers.CharField(write_only=True, trim_whitespace=False, max_length=256)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password2 = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password2"]:
            raise serializers.ValidationError({"new_password2": "Passwords do not match."})
        try:
            user_id = force_str(urlsafe_base64_decode(attrs["uid"]))
            user = User.objects.get(pk=user_id, is_active=True)
        except (ValueError, TypeError, OverflowError, User.DoesNotExist):
            raise serializers.ValidationError(
                {"token": "This password-reset link is invalid or expired."}
            )
        if not default_token_generator.check_token(user, attrs["token"]):
            raise serializers.ValidationError(
                {"token": "This password-reset link is invalid or expired."}
            )
        try:
            validate_password(attrs["new_password"], user=user)
        except DjangoValidationError as exc:
            # Password rules belong beside the password input. Allowing the
            # Django exception to escape here produces non_field_errors, which
            # gives the user no indication which input needs attention.
            raise serializers.ValidationError({"new_password": exc.messages}) from exc
        attrs["user"] = user
        return attrs

    @transaction.atomic
    def save(self):
        user = self.validated_data["user"]
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=("password",))
        invalidate_user_refresh_tokens(user)
        return user
