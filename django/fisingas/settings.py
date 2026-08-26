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
# (never hardcoded). Timestamps are stored as aware UTC
# (USE_TZ) and published by the API as ISO-8601 in the
# local Europe/Vilnius zone with the explicit offset — see
# common/timestamps.py, the one place that knows the policy.
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
# The service only ever runs behind the Caddy endpoint, whose
# site block is a bare `:80` — it forwards whatever Host the
# client sent. Every host is accepted here because nothing in
# the service derives anything from it: no absolute URLs, no
# redirects, no host-dependent cookies. Should that change,
# pin ALLOWED_HOSTS to the real hostname (and constrain the
# Caddy site block to match) instead of trusting it here.
#
# No forwarded-header trust (USE_X_FORWARDED_HOST /
# SECURE_PROXY_SSL_HEADER): nothing reads request.get_host()
# or request.is_secure(), and the Caddyfile neither sets nor
# strips those headers — trusting them would only turn
# client-supplied values into "facts".
############################################################

ALLOWED_HOSTS = ["*"]








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
#   - the cookie is named "session" — the name the frontend
#     was built around
#   - logout is SERVER-SIDE: POST /api/logout flushes the
#     django_session row and the response clears the cookie.
#     That is what lets HttpOnly be ON — JS never needs to
#     touch the cookie, so scripts can never read or leak it
#   - sessions live in PostgreSQL (django_session table) —
#     no Redis
############################################################

SESSION_ENGINE = "django.contrib.sessions.backends.db"
SESSION_COOKIE_NAME = "session"
SESSION_COOKIE_HTTPONLY = True
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
