from pathlib import Path

from dotenv import load_dotenv

from .local_network import discover_lan_ipv4_addresses

# Local commands deliberately use only backend/.env. ``override=True`` keeps
# exported production variables from silently changing a development run.
DEVELOPMENT_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(DEVELOPMENT_ENV_FILE, override=True)
print("[Japan47 settings] Development environment loaded from backend/.env")

from .base import *  # noqa: E402,F403

DEBUG = env_bool("DJANGO_DEBUG", env_bool("DEBUG", True))  # noqa: F405

# Only development trusts addresses currently assigned to this computer. This
# lets another device on the same Wi-Fi reach runserver without placing a
# changing private IP in backend/.env. Production never imports this module.
LAN_IPV4_ADDRESSES = discover_lan_ipv4_addresses()
ALLOWED_HOSTS = list(dict.fromkeys([*ALLOWED_HOSTS, "localhost", "127.0.0.1", *LAN_IPV4_ADDRESSES]))  # noqa: F405
LAN_VITE_ORIGINS = [f"http://{address}:5173" for address in LAN_IPV4_ADDRESSES]
CORS_ALLOWED_ORIGINS = list(dict.fromkeys([  # noqa: F405
    *CORS_ALLOWED_ORIGINS,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    *LAN_VITE_ORIGINS,
]))
CSRF_TRUSTED_ORIGINS = list(dict.fromkeys([  # noqa: F405
    *CSRF_TRUSTED_ORIGINS,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    *LAN_VITE_ORIGINS,
]))

if LAN_IPV4_ADDRESSES:
    for address in LAN_IPV4_ADDRESSES:
        print(f"[Japan47 network] Phone frontend: http://{address}:5173")
        print(f"[Japan47 network] Phone API:      http://{address}:8000/api/v1/")
else:
    print("[Japan47 network] No private LAN IPv4 address detected; localhost remains available.")

# The toolbar is development-only and helps catch query regressions before
# they reach PostgreSQL. API responses remain JSON; inspect requests in its UI.
INSTALLED_APPS += ["debug_toolbar"]  # noqa: F405
MIDDLEWARE.insert(0, "debug_toolbar.middleware.DebugToolbarMiddleware")  # noqa: F405
INTERNAL_IPS = ["127.0.0.1"]
