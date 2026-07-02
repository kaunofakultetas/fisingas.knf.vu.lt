"""
Base settings to build other settings files upon.
"""
from pathlib import Path

import environ


ROOT_DIR = Path(__file__).resolve(strict=True).parent.parent
env = environ.Env()


# GENERAL
# ------------------------------------------------------------------------------
DEBUG = env.bool("DJANGO_DEBUG", False)
TIME_ZONE = "Europe/Vilnius"
LANGUAGE_CODE = "en-us"
USE_I18N = True
USE_TZ = True


# DATABASES
# ------------------------------------------------------------------------------
DATABASES = {"default": env.db("DATABASE_URL", engine="django.db.backends.postgresql")}
DATABASES["default"]["ATOMIC_REQUESTS"] = True
DEFAULT_AUTO_FIELD = "django.db.models.AutoField"


# URLS
# ------------------------------------------------------------------------------
ROOT_URLCONF = "fisingas.urls"
WSGI_APPLICATION = "fisingas.wsgi.application"
APPEND_SLASH = False


# APPS
# ------------------------------------------------------------------------------
# Deliberately minimal — no django.contrib.admin / auth / staticfiles:
# all data is managed through the React admin UI, and authentication is a
# custom session scheme replicated from the Flask backend (see common/auth.py).
DJANGO_APPS = [
    "django.contrib.sessions",
]
LOCAL_APPS = [
    "fisingas.users.apps.UsersConfig",
    "fisingas.phishing_test.apps.PhishingTestConfig",
    "fisingas.leaderboard.apps.LeaderboardConfig",
]
INSTALLED_APPS = DJANGO_APPS + LOCAL_APPS


# MIDDLEWARE
# ------------------------------------------------------------------------------
# No CSRF middleware: the API mirrors the Flask backend, which relies on the
# Caddy endpoint's same-origin checks instead of CSRF tokens.
MIDDLEWARE = [
    "django.contrib.sessions.middleware.SessionMiddleware",     # Session support (DB-backed sessions)
    "django.middleware.common.CommonMiddleware",                # URL normalization, Content-Length, etc.
]


# SESSIONS
# ------------------------------------------------------------------------------
# Must stay compatible with the existing frontend:
#   - the cookie is named "session" (same as Flask), because the login page
#     performs logout by dropping that cookie from document.cookie
#   - HttpOnly is off for the same reason (JS must be able to delete it)
#   - sessions live in PostgreSQL (django_session table) — no Redis
SESSION_ENGINE = "django.contrib.sessions.backends.db"
SESSION_COOKIE_NAME = "session"
SESSION_COOKIE_HTTPONLY = False
SESSION_EXPIRE_AT_BROWSER_CLOSE = True


# TEMPLATES
# ------------------------------------------------------------------------------
# Only used by Django's debug error pages — the service itself is JSON-only.
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
            ],
        },
    }
]


# SECURITY
# ------------------------------------------------------------------------------
X_FRAME_OPTIONS = "DENY"


# LOGGING
# ------------------------------------------------------------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "%(levelname)s %(asctime)s %(module)s "
            "%(process)d %(thread)d %(message)s"
        }
    },
    "handlers": {
        "console": {
            "level": "DEBUG",
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        }
    },
    "root": {"level": "INFO", "handlers": ["console"]},
}
