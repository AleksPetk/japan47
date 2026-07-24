from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views.badges import BadgesView
from .views.common import HealthView, HomeView, SearchView
from .views.community import (
    CollectionViewSet,
    ContentReportViewSet,
    FavoriteViewSet,
    FollowViewSet,
    ItineraryViewSet,
    VisitedPlaceViewSet,
)
from .views.destinations import PlaceViewSet, ReviewViewSet
from .views.prefectures import PrefectureViewSet
from .views.regions import RegionViewSet
from .views.support import SupportTicketView
from .views.accounts import PasswordResetConfirmView, PasswordResetRequestView, ResendVerificationView, VerifyEmailView
from .views.users import (
    ContributorDetailView,
    CurrentProfileView,
    LogoutView,
    RegistrationView,
    ThrottledTokenObtainPairView,
    VerifiedTokenRefreshView,
)

router = DefaultRouter()
router.register("regions", RegionViewSet, basename="region")
router.register("prefectures", PrefectureViewSet, basename="prefecture")
router.register("places", PlaceViewSet, basename="place")
router.register("reviews", ReviewViewSet, basename="review")
router.register("favorites", FavoriteViewSet, basename="favorite")
router.register("visited-places", VisitedPlaceViewSet, basename="visited-place")
router.register("collections", CollectionViewSet, basename="collection")
router.register("itineraries", ItineraryViewSet, basename="itinerary")
router.register("reports", ContentReportViewSet, basename="report")
router.register("contributors", FollowViewSet, basename="contributor-actions")

urlpatterns = [
    path("", include(router.urls)),
    path("health/", HealthView.as_view(), name="health"),
    path("home/", HomeView.as_view(), name="home"),
    path("search/", SearchView.as_view(), name="search"),
    path("badges/", BadgesView.as_view(), name="badges"),
    path("support/", SupportTicketView.as_view(), name="support"),
    path("contributors/<int:user_id>/", ContributorDetailView.as_view(), name="contributor-detail"),
    path("profile/", CurrentProfileView.as_view(), name="profile"),
    path("auth/register/", RegistrationView.as_view(), name="register"),
    path("auth/login/", ThrottledTokenObtainPairView.as_view(), name="token-obtain"),
    path("auth/refresh/", VerifiedTokenRefreshView.as_view(), name="token-refresh"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/verify-email/", VerifyEmailView.as_view(), name="verify-email"),
    path("auth/resend-verification/", ResendVerificationView.as_view(), name="resend-verification"),
    path("auth/password-reset/request/", PasswordResetRequestView.as_view(), name="password-reset-request"),
    path("auth/password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
]
