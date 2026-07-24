from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return Response(
            {"error": {"code": "server_error", "message": "An unexpected server error occurred."}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    fields = response.data if isinstance(exc, ValidationError) else None
    if fields:
        message = "Please correct the highlighted fields."
        code = "validation_error"
    else:
        detail = response.data.get("detail", "Request failed.") if isinstance(response.data, dict) else response.data
        message = str(detail)
        code = getattr(exc, "default_code", "request_error")

    response.data = {
        "error": {
            "code": code,
            "message": message,
            **({"fields": fields} if fields else {}),
        }
    }
    if response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
        response.data["error"]["retry_after"] = response.headers.get("Retry-After")
    return response
