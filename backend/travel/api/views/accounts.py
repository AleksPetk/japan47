"""Public, enumeration-safe email verification and password recovery APIs."""

from django.http import JsonResponse
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle
from travel.accounts.email_service import EmailDeliveryError
from travel.accounts.services import request_password_reset_email, request_verification_email
from travel.accounts.tokens import consume_email_verification_token

from ..account_serializers import (
    EmailRequestSerializer,
    EmailVerificationSerializer,
    PasswordResetConfirmSerializer,
)

VERIFICATION_RESPONSE = "If an unverified account exists for this email address, a new confirmation email has been sent."
PASSWORD_RESET_RESPONSE = (
    "If an account exists for that email address, we have sent password-reset instructions."
)


class ResendVerificationView(generics.GenericAPIView):
    serializer_class = EmailRequestSerializer
    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "verification_resend"

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            request_verification_email(serializer.validated_data["email"])
        except EmailDeliveryError:
            pass
        return JsonResponse({"message": VERIFICATION_RESPONSE})


class VerifyEmailView(generics.GenericAPIView):
    serializer_class = EmailVerificationSerializer
    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "auth"

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = consume_email_verification_token(serializer.validated_data["token"])
        responses = {
            "success": ("Email Confirmed Successfully", status.HTTP_200_OK),
            "already_verified": ("Email Already Confirmed", status.HTTP_200_OK),
            "expired": ("Verification Link Expired", status.HTTP_410_GONE),
            "invalid": ("Invalid Verification Link", status.HTTP_400_BAD_REQUEST),
        }
        message, response_status = responses[result]
        return JsonResponse({"result": result, "message": message}, status=response_status)


class PasswordResetRequestView(generics.GenericAPIView):
    serializer_class = EmailRequestSerializer
    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            request_password_reset_email(serializer.validated_data["email"])
        except EmailDeliveryError:
            pass
        return JsonResponse({"message": PASSWORD_RESET_RESPONSE})


class PasswordResetConfirmView(generics.GenericAPIView):
    serializer_class = PasswordResetConfirmSerializer
    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "auth"

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return JsonResponse(
            {
                "result": "success",
                "message": "Password Changed Successfully",
            }
        )
