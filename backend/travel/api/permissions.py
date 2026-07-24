from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsOwnerOrStaff(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        owner = (
            getattr(obj, "author", None)
            or getattr(obj, "user", None)
            or getattr(obj, "owner", None)
            or getattr(obj, "reporter", None)
        )
        return bool(request.user.is_authenticated and (request.user.is_staff or owner == request.user))
