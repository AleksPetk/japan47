"""Mandatory, package-backed two-factor authentication for Django admin only."""

import base64
from functools import wraps
from io import BytesIO

import qrcode
from django.conf import settings
from django.contrib import admin, messages
from django.contrib.auth.views import redirect_to_login
from django.http import HttpResponseForbidden
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_http_methods
from django_otp import login as otp_login
from django_otp import verify_token
from django_otp.plugins.otp_static.models import StaticDevice, StaticToken
from django_otp.plugins.otp_totp.models import TOTPDevice

RECOVERY_CODE_COUNT = 10


def admin_staff_required(view):
    """Require the normal staff password session before exposing 2FA controls."""

    @wraps(view)
    def wrapped(request, *args, **kwargs):
        user = request.user
        if not user.is_authenticated:
            return redirect_to_login(request.get_full_path(), reverse("admin:login"))
        if not user.is_active or not user.is_staff:
            return HttpResponseForbidden("Django administration is restricted to staff users.")
        return view(request, *args, **kwargs)

    return wrapped


def _admin_context(request, **extra):
    return {**admin.site.each_context(request), **extra}


def _safe_admin_next(request):
    candidate = request.POST.get("next") or request.GET.get("next") or reverse("admin:index")
    prefix = f"/{settings.ADMIN_PATH}"
    if url_has_allowed_host_and_scheme(
        candidate, allowed_hosts={request.get_host()}
    ) and candidate.startswith(prefix):
        return candidate
    return reverse("admin:index")


def _qr_data_url(device):
    image = qrcode.make(device.config_url)
    output = BytesIO()
    image.save(output, format="PNG")
    return "data:image/png;base64," + base64.b64encode(output.getvalue()).decode("ascii")


def _replace_recovery_codes(user):
    """Invalidate previous static tokens and return a newly generated set once."""

    devices = StaticDevice.objects.filter(user=user).order_by("pk")
    device = devices.first()
    if device is None:
        device = StaticDevice.objects.create(
            user=user, name="Japan47 recovery codes", confirmed=True
        )
    else:
        devices.exclude(pk=device.pk).delete()
        device.token_set.all().delete()
        if not device.confirmed:
            device.confirmed = True
            device.save(update_fields=("confirmed",))
    codes = [StaticToken.random_token() for _ in range(RECOVERY_CODE_COUNT)]
    StaticToken.objects.bulk_create([StaticToken(device=device, token=code) for code in codes])
    return codes


class AdminTwoFactorMiddleware:
    """Keep unverified staff sessions out of every ordinary admin view."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        prefix = f"/{settings.ADMIN_PATH}"
        if not request.path.startswith(prefix):
            return self.get_response(request)

        user = request.user
        if not user.is_authenticated or not user.is_active or not user.is_staff:
            return self.get_response(request)

        allowed = {
            reverse("admin:login"),
            reverse("admin:logout"),
            reverse("admin-2fa-setup"),
            reverse("admin-2fa-verify"),
            reverse("admin-2fa-recovery"),
            reverse("admin-2fa-codes"),
        }
        if request.path in allowed:
            return self.get_response(request)

        has_totp = TOTPDevice.objects.filter(user=user, confirmed=True).exists()
        destination = "admin-2fa-verify" if has_totp else "admin-2fa-setup"
        if not has_totp or not user.is_verified():
            return redirect(f"{reverse(destination)}?next={request.get_full_path()}")
        return self.get_response(request)


@never_cache
@admin_staff_required
@require_http_methods(["GET", "POST"])
def setup(request):
    confirmed = TOTPDevice.objects.filter(user=request.user, confirmed=True).first()
    if confirmed:
        return redirect("admin:index" if request.user.is_verified() else "admin-2fa-verify")

    device = TOTPDevice.objects.filter(user=request.user, confirmed=False).first()
    if device is None:
        device = TOTPDevice.objects.create(
            user=request.user,
            name="Google Authenticator",
            confirmed=False,
        )

    error = None
    if request.method == "POST":
        token = request.POST.get("token", "").strip()
        if len(token) == 6 and token.isdigit() and device.verify_token(token):
            device.confirmed = True
            device.save(update_fields=("confirmed",))
            request.session["japan47_recovery_codes"] = _replace_recovery_codes(request.user)
            otp_login(request, device)
            messages.success(
                request, "Google Authenticator is now required for this admin account."
            )
            return redirect("admin-2fa-codes")
        error = "Enter the current six-digit code from Google Authenticator."

    return render(
        request,
        "admin/2fa_setup.html",
        _admin_context(
            request,
            title="Set up Google Authenticator",
            qr_data_url=_qr_data_url(device),
            error=error,
            next=_safe_admin_next(request),
        ),
    )


@never_cache
@admin_staff_required
@require_http_methods(["GET", "POST"])
def verify(request):
    devices = list(TOTPDevice.objects.filter(user=request.user, confirmed=True))
    if not devices:
        return redirect("admin-2fa-setup")
    error = None
    if request.method == "POST":
        token = request.POST.get("token", "").strip()
        device = next(
            (verify_token(request.user, item.persistent_id, token) for item in devices if token),
            None,
        )
        if device:
            otp_login(request, device)
            return redirect(_safe_admin_next(request))
        error = "That authenticator code is invalid or expired."
    return render(
        request,
        "admin/2fa_verify.html",
        _admin_context(
            request, title="Two-factor verification", error=error, next=_safe_admin_next(request)
        ),
    )


@never_cache
@admin_staff_required
@require_http_methods(["GET", "POST"])
def recovery(request):
    if not TOTPDevice.objects.filter(user=request.user, confirmed=True).exists():
        return redirect("admin-2fa-setup")
    error = None
    if request.method == "POST":
        token = request.POST.get("token", "").strip().lower()
        devices = StaticDevice.objects.filter(user=request.user, confirmed=True)
        device = next(
            (verify_token(request.user, item.persistent_id, token) for item in devices if token),
            None,
        )
        if device:
            otp_login(request, device)
            messages.warning(
                request, "A one-use recovery code was consumed. Regenerate codes if few remain."
            )
            return redirect(_safe_admin_next(request))
        error = "That recovery code is invalid or has already been used."
    return render(
        request,
        "admin/2fa_recovery.html",
        _admin_context(
            request, title="Use a recovery code", error=error, next=_safe_admin_next(request)
        ),
    )


@never_cache
@admin_staff_required
@require_http_methods(["GET", "POST"])
def recovery_codes(request):
    if not request.user.is_verified():
        return redirect("admin-2fa-verify")
    if request.method == "POST":
        request.session["japan47_recovery_codes"] = _replace_recovery_codes(request.user)
        messages.warning(request, "Old unused recovery codes were invalidated.")
        return redirect("admin-2fa-codes")
    codes = request.session.pop("japan47_recovery_codes", None)
    return render(
        request,
        "admin/2fa_codes.html",
        _admin_context(request, title="Recovery codes", recovery_codes=codes),
    )
