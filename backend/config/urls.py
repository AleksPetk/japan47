from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from travel import admin_2fa

urlpatterns = [
    path(f"{settings.ADMIN_PATH}2fa/setup/", admin_2fa.setup, name="admin-2fa-setup"),
    path(f"{settings.ADMIN_PATH}2fa/verify/", admin_2fa.verify, name="admin-2fa-verify"),
    path(f"{settings.ADMIN_PATH}2fa/recovery/", admin_2fa.recovery, name="admin-2fa-recovery"),
    path(f"{settings.ADMIN_PATH}2fa/recovery-codes/", admin_2fa.recovery_codes, name="admin-2fa-codes"),
    path(settings.ADMIN_PATH, admin.site.urls),
    path("api/v1/", include("travel.api.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="api-schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="api-schema"), name="api-docs"),
]

if settings.DEBUG:
    import debug_toolbar

    urlpatterns += [path("__debug__/", include(debug_toolbar.urls))]
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
