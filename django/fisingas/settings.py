############################################################
#  [*] Django settings — the whole configuration in one file
#
#  Everything environment-specific comes in through env
#  variables (see docker-compose.yml):
#
#    DJANGO_DEBUG      — "True" enables debug mode
#    DJANGO_SECRET_KEY — session signing key
#    DATABASE_URL      — postgres://user:pass@host:5432/db
############################################################


from pathlib import Path

import environ


ROOT_DIR = Path(__file__).resolve(strict=True).parent.parent
env = environ.Env()








############################################################
# General
############################################################
#
# Debug mode and the secret key come from the environment
# (never hardcoded). Times are stored and shown in the
# local Vilnius timezone — the API returns timestamps as
# plain local-time strings.
############################################################

DEBUG = env.bool("DJANGO_DEBUG", False)
SECRET_KEY = env("DJANGO_SECRET_KEY")
TIME_ZONE = "Europe/Vilnius"
LANGUAGE_CODE = "en-us"
USE_I18N = True
USE_TZ = True








############################################################
# Hosting
############################################################
#
# The service only ever runs behind the Caddy endpoint,
# which owns TLS and the Host header — so all hosts are
# accepted here and the forwarded proto header is trusted
# to mark requests as secure.
############################################################

ALLOWED_HOSTS = ["*"]
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")








############################################################
# Databases
############################################################
#
# One PostgreSQL database, configured entirely by the
# DATABASE_URL env variable. ATOMIC_REQUESTS wraps every
# request in a transaction, so a failing request can never
# leave half-written data (e.g. a partially dealt test).
############################################################

DATABASES = {"default": env.db("DATABASE_URL", engine="django.db.backends.postgresql")}
DATABASES["default"]["ATOMIC_REQUESTS"] = True
DEFAULT_AUTO_FIELD = "django.db.models.AutoField"








############################################################
# URLs
############################################################
#
# All /api/* routes live in one file (fisingas/urls.py).
# APPEND_SLASH is off because the API paths have no trailing
# slashes and redirecting POST requests would break them.
############################################################

ROOT_URLCONF = "fisingas.urls"
WSGI_APPLICATION = "fisingas.wsgi.application"
APPEND_SLASH = False








############################################################
# Apps
############################################################
#
# Deliberately minimal — no django.contrib.admin / auth /
# staticfiles: all data is managed through the React admin
# UI, and authentication is a custom session scheme (see
# common/auth.py).
############################################################

INSTALLED_APPS = [
    "django.contrib.sessions",

    "fisingas.users.apps.UsersConfig",
    "fisingas.phishing_test.apps.PhishingTestConfig",
    "fisingas.leaderboard.apps.LeaderboardConfig",
]








############################################################
# Middleware
############################################################
#
# No CSRF middleware: the API relies on the Caddy endpoint's
# same-origin checks instead of CSRF tokens.
############################################################

MIDDLEWARE = [
     # Session support (DB-backed sessions)
    "django.contrib.sessions.middleware.SessionMiddleware",

    # URL normalization, Content-Length, etc.
    "django.middleware.common.CommonMiddleware",
]








############################################################
# Sessions
############################################################
#
# Must stay compatible with the frontend:
#   - the cookie is named "session", because the login page
#     performs logout by dropping that cookie from
#     document.cookie
#   - HttpOnly is off for the same reason (JS must be able
#     to delete it)
#   - sessions live in PostgreSQL (django_session table) —
#     no Redis
############################################################

SESSION_ENGINE = "django.contrib.sessions.backends.db"
SESSION_COOKIE_NAME = "session"
SESSION_COOKIE_HTTPONLY = False
SESSION_EXPIRE_AT_BROWSER_CLOSE = True








############################################################
# Templates
############################################################
#
# Only used by Django's debug error pages — the service
# itself is JSON-only.
############################################################

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








############################################################
# Security
############################################################
#
# The API itself must never render inside an iframe (the
# frontend pages that do embed things, like /slides, embed
# frontend routes — not API responses).
############################################################

X_FRAME_OPTIONS = "DENY"








############################################################
# Logging
############################################################
#
# Everything goes to the console — that is what
# `docker logs fisingas-django` shows. INFO and above by
# default; the handler itself allows DEBUG so a single
# logger level change is enough when digging into a problem.
############################################################

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
