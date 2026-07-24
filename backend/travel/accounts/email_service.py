"""Small Resend HTTP client and Japan 47 transactional email templates."""

import hashlib
import html
import json
import logging
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from django.conf import settings

logger = logging.getLogger(__name__)
RESEND_EMAILS_URL = "https://api.resend.com/emails"
RESEND_USER_AGENT = "Japan47/1.0 (+https://japan47.alekspetk.com)"


class EmailDeliveryError(Exception):
    """Safe boundary exception; provider details stay in server logs."""


def _duration_notice(seconds):
    if seconds % 86400 == 0:
        count, unit = seconds // 86400, "day"
    elif seconds % 3600 == 0:
        count, unit = seconds // 3600, "hour"
    else:
        count, unit = max(1, seconds // 60), "minute"
    return f"{count} {unit}{'' if count == 1 else 's'}"


def _send_resend_email(*, to, subject, text, html_body, purpose, idempotency_source):
    if not settings.RESEND_API_KEY:
        logger.error("Transactional email is not configured (purpose=%s).", purpose)
        raise EmailDeliveryError("Transactional email is temporarily unavailable.")

    payload = json.dumps({
        "from": settings.DEFAULT_FROM_EMAIL,
        "to": [to],
        "subject": subject,
        "text": text,
        "html": html_body,
        "tags": [{"name": "category", "value": purpose}],
    }).encode("utf-8")
    idempotency_key = hashlib.sha256(idempotency_source.encode("utf-8")).hexdigest()
    request = Request(
        RESEND_EMAILS_URL,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {settings.RESEND_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Idempotency-Key": idempotency_key,
            # Cloudflare rejects Python urllib's default browser signature
            # before the request reaches Resend. Identify this API client.
            "User-Agent": RESEND_USER_AGENT,
        },
    )
    try:
        with urlopen(request, timeout=settings.RESEND_TIMEOUT_SECONDS) as response:
            if not 200 <= response.status < 300:
                raise EmailDeliveryError("Transactional email is temporarily unavailable.")
            provider_data = json.loads(response.read() or b"{}")
            logger.info(
                "Resend accepted an email (purpose=%s, id=%s).",
                purpose,
                provider_data.get("id", "not-returned"),
            )
    except HTTPError as exc:
        raw_detail = exc.read(2048).decode("utf-8", "replace")
        try:
            provider_detail = json.loads(raw_detail)
            detail = provider_detail.get("message") or provider_detail.get("name") or "provider-error"
        except json.JSONDecodeError:
            detail = raw_detail.strip() or "non-json-provider-error"
        # Provider errors can mention submitted values. Preserve the useful
        # reason while removing keys, links (which can contain tokens), and
        # unusually long token-shaped values before logging.
        detail = re.sub(r"re_[A-Za-z0-9_-]+", "[REDACTED_KEY]", str(detail))
        detail = re.sub(r"https?://\S+", "[REDACTED_URL]", detail)
        detail = re.sub(r"\b[A-Za-z0-9_-]{48,}\b", "[REDACTED_TOKEN]", detail)[:300]
        logger.error(
            "Resend rejected an email (purpose=%s, status=%s, detail=%s).",
            purpose,
            exc.code,
            detail,
        )
        raise EmailDeliveryError("Transactional email is temporarily unavailable.") from exc
    except (URLError, TimeoutError, OSError) as exc:
        logger.error("Resend could not be reached (purpose=%s, error=%s).", purpose, type(exc).__name__)
        raise EmailDeliveryError("Transactional email is temporarily unavailable.") from exc


def _email_logo_url():
    """Return a public logo URL only when the frontend uses production HTTPS."""
    frontend_url = str(getattr(settings, "FRONTEND_URL", "")).strip().rstrip("/")
    parsed_url = urlsplit(frontend_url)
    if parsed_url.scheme.lower() != "https" or not parsed_url.netloc:
        return None
    return f"{frontend_url}/email-logo.png"


def _branded_email(
    *,
    heading,
    preheader,
    paragraphs,
    button_label,
    url,
    expiration,
    security_note,
):
    safe_url = html.escape(url, quote=True)
    safe_heading = html.escape(heading)
    safe_preheader = html.escape(preheader)
    safe_paragraphs = "".join(
        f'<p style="margin:0 0 16px;line-height:1.65;color:#354139">{html.escape(paragraph)}</p>'
        for paragraph in paragraphs
    )
    safe_button = html.escape(button_label)
    safe_expiration = html.escape(expiration)
    safe_security = html.escape(security_note)
    logo_url = _email_logo_url()
    if logo_url:
        safe_logo_url = html.escape(logo_url, quote=True)
        brand = (
            f'<img src="{safe_logo_url}" width="220" alt="Japan 47" '
            'style="display:block;width:220px;max-width:100%;height:auto;border:0">'
        )
    else:
        brand = (
            '<span style="color:#b43832;font-size:25px;line-height:1.2;'
            'font-weight:700;letter-spacing:.2px">Japan 47</span>'
        )
    html_body = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>{safe_heading}</title>
<style>
@media only screen and (max-width:620px) {{
  .email-shell {{ padding:16px 10px !important; }}
  .email-header {{ padding:20px !important; }}
  .email-content {{ padding:26px 22px !important; }}
  .email-title {{ font-size:25px !important; }}
  .email-button a {{ display:block !important; text-align:center !important; }}
}}
</style>
</head>
<body style="margin:0;padding:0;background:#f4f1e9;color:#20251f;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">{safe_preheader}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f4f1e9;">
<tr><td class="email-shell" align="center" style="padding:36px 16px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #ddd8cd;border-radius:12px;border-collapse:separate;overflow:hidden;box-shadow:0 8px 26px rgba(38,63,52,.08);">
<tr><td class="email-header" style="padding:22px 32px;background:#263f34;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:8px 12px;background:#fffdf8;border-radius:8px;">{brand}</td></tr></table>
</td></tr>
<tr><td class="email-content" style="padding:36px 34px 32px;">
<h1 class="email-title" style="margin:0 0 20px;color:#263f34;font-size:30px;line-height:1.25;font-weight:700;">{safe_heading}</h1>
{safe_paragraphs}
<table class="email-button" role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0;"><tr><td bgcolor="#b43832" style="border-radius:7px;">
<a href="{safe_url}" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-size:16px;line-height:1.25;font-weight:700;border:1px solid #b43832;border-radius:7px;">{safe_button}</a>
</td></tr></table>
<p style="margin:0 0 9px;color:#667068;font-size:14px;line-height:1.55;">If the button does not work, copy and paste this link into your browser:</p>
<p style="margin:0 0 22px;line-height:1.5;word-break:break-all;overflow-wrap:anywhere;"><a href="{safe_url}" style="color:#982f2a;text-decoration:underline;">{safe_url}</a></p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;background:#f7f3eb;border-left:4px solid #c99a4b;"><tr><td style="padding:13px 15px;color:#536058;font-size:14px;line-height:1.55;">{safe_expiration}</td></tr></table>
<p style="margin:0;padding-top:20px;border-top:1px solid #e2ded5;color:#667068;font-size:14px;line-height:1.6;">{safe_security}</p>
</td></tr>
<tr><td align="center" style="padding:18px 24px;background:#f8f6f0;color:#737b75;font-size:12px;line-height:1.5;border-top:1px solid #e2ded5;">Japan 47 &middot; Discover all 47 prefectures</td></tr>
</table>
</td></tr></table>
</body></html>"""
    paragraph_text = "\n\n".join(paragraphs)
    text = (
        f"{heading}\n\n{paragraph_text}\n\n{button_label}:\n{url}\n\n"
        f"If the button does not work, copy and paste the link above into your browser.\n\n"
        f"{expiration}\n\n{security_note}\n\nJapan 47 — Discover all 47 prefectures"
    )
    return text, html_body


def send_verification_message(*, to, verification_url, token):
    text, html_body = _branded_email(
        heading="Confirm your Japan47 email address",
        preheader="Finish setting up your Japan47 account.",
        paragraphs=(
            "Welcome to Japan47!",
            "Thanks for joining our community of people discovering and sharing amazing places across Japan.",
            "Please confirm your email address to finish setting up your account.",
        ),
        button_label="Confirm My Email",
        url=verification_url,
        expiration=f"This confirmation link expires in {_duration_notice(settings.EMAIL_VERIFICATION_TOKEN_MAX_AGE)}.",
        security_note="If you did not create a Japan47 account, you can safely ignore this email.",
    )
    _send_resend_email(
        to=to,
        subject="Confirm your Japan47 email address",
        text=text,
        html_body=html_body,
        purpose="email_verification",
        idempotency_source=f"verify:{token}",
    )


def send_password_reset_message(*, to, reset_url, token):
    text, html_body = _branded_email(
        heading="Reset your Japan47 password",
        preheader="Choose a new password for your Japan47 account.",
        paragraphs=(
            "Forgot your password? No worries.",
            "Click the button below to choose a new password for your Japan47 account.",
        ),
        button_label="Choose a New Password",
        url=reset_url,
        expiration=f"This reset link expires in {_duration_notice(settings.PASSWORD_RESET_TOKEN_MAX_AGE)} and can only be used once.",
        security_note="If you did not request a password reset, you can safely ignore this email. Your password will not change unless you use the link above.",
    )
    _send_resend_email(
        to=to,
        subject="Reset your Japan47 password",
        text=text,
        html_body=html_body,
        purpose="password_reset",
        idempotency_source=f"reset:{token}",
    )
