import json
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, override_settings

from travel.accounts.email_service import send_password_reset_message, send_verification_message


class ResendEmailServiceTests(SimpleTestCase):
    def _successful_resend_response(self, urlopen):
        response = MagicMock(status=200)
        response.read.return_value = b'{"id":"email-test-id"}'
        urlopen.return_value.__enter__.return_value = response

    def _payload(self, urlopen):
        request = urlopen.call_args.args[0]
        return request, json.loads(request.data)

    @override_settings(
        RESEND_API_KEY="re_test_value",
        DEFAULT_FROM_EMAIL="Japan47 <noreply@japan47.alekspetk.com>",
        RESEND_TIMEOUT_SECONDS=4,
        FRONTEND_URL="https://japan47.alekspetk.com",
        EMAIL_VERIFICATION_TOKEN_MAX_AGE=86400,
    )
    @patch("travel.accounts.email_service.urlopen")
    def test_verification_message_uses_resend_api_without_passwords(self, urlopen):
        self._successful_resend_response(urlopen)
        verification_url = "https://japan47.alekspetk.com/verify-email/signed-token"
        send_verification_message(
            to="traveler@example.com",
            verification_url=verification_url,
            token="signed-token",
        )
        request, payload = self._payload(urlopen)
        self.assertEqual(request.full_url, "https://api.resend.com/emails")
        self.assertEqual(request.get_header("Accept"), "application/json")
        self.assertTrue(request.get_header("User-agent").startswith("Japan47/"))
        self.assertEqual(payload["to"], ["traveler@example.com"])
        self.assertEqual(payload["subject"], "Confirm your Japan47 email address")
        self.assertIn("Confirm My Email", payload["html"])
        self.assertIn("Welcome to Japan47!", payload["html"])
        self.assertIn("Finish setting up your Japan47 account.", payload["html"])
        self.assertIn('src="https://japan47.alekspetk.com/email-logo.png"', payload["html"])
        self.assertIn('alt="Japan 47"', payload["html"])
        self.assertIn("max-width:600px", payload["html"])
        self.assertIn("This confirmation link expires in 1 day.", payload["html"])
        self.assertIn(verification_url, payload["text"])
        self.assertIn("If you did not create a Japan47 account", payload["text"])
        self.assertNotIn("password", payload["html"].lower())
        self.assertNotIn("re_test_value", request.data.decode())

    @override_settings(
        RESEND_API_KEY="re_test_value",
        DEFAULT_FROM_EMAIL="Japan47 <noreply@japan47.alekspetk.com>",
        RESEND_TIMEOUT_SECONDS=4,
        FRONTEND_URL="https://japan47.alekspetk.com",
        PASSWORD_RESET_TOKEN_MAX_AGE=3600,
    )
    @patch("travel.accounts.email_service.urlopen")
    def test_password_reset_message_has_branded_html_and_complete_plain_text(self, urlopen):
        self._successful_resend_response(urlopen)
        reset_url = "https://japan47.alekspetk.com/reset-password/signed-token"
        send_password_reset_message(
            to="traveler@example.com",
            reset_url=reset_url,
            token="signed-token",
        )
        _, payload = self._payload(urlopen)
        self.assertEqual(payload["subject"], "Reset your Japan47 password")
        self.assertIn("Forgot your password? No worries.", payload["html"])
        self.assertIn("Choose a New Password", payload["html"])
        self.assertIn("Choose a new password for your Japan47 account.", payload["html"])
        self.assertIn("This reset link expires in 1 hour and can only be used once.", payload["html"])
        self.assertIn(reset_url, payload["text"])
        self.assertIn("Your password will not change unless you use the link above.", payload["text"])

    @override_settings(
        RESEND_API_KEY="re_test_value",
        DEFAULT_FROM_EMAIL="Japan47 <noreply@japan47.alekspetk.com>",
        RESEND_TIMEOUT_SECONDS=4,
        FRONTEND_URL="http://localhost:5173",
        EMAIL_VERIFICATION_TOKEN_MAX_AGE=86400,
    )
    @patch("travel.accounts.email_service.urlopen")
    def test_local_email_uses_text_brand_when_public_https_logo_is_unavailable(self, urlopen):
        self._successful_resend_response(urlopen)
        send_verification_message(
            to="traveler@example.com",
            verification_url="http://localhost:5173/verify-email/signed-token",
            token="signed-token",
        )
        _, payload = self._payload(urlopen)
        self.assertNotIn("email-logo.png", payload["html"])
        self.assertIn(">Japan 47</span>", payload["html"])
