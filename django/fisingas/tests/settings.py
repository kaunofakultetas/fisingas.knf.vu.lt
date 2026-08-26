############################################################
#  [*] Test settings — the production settings on SQLite
#
#  Imports the real settings.py, so every regression test
#  runs under the production configuration (middleware,
#  session scheme, APPEND_SLASH, ATOMIC_REQUESTS, ...), and
#  swaps only what a throwaway test container must not
#  depend on:
#
#    - the required env variables get harmless defaults, so
#      no secrets or database have to be wired in
#    - the database becomes in-memory SQLite — the models
#      and migrations are engine-agnostic, and the test
#      container carries no PostgreSQL (settings.py forces
#      the postgres engine whatever DATABASE_URL says, so
#      this override cannot be done with an env var alone)
#    - request logging is silenced, because the suite pins
#      many 4xx responses on purpose
############################################################


import os

os.environ.setdefault("DJANGO_SECRET_KEY", "test-only-secret-key")
os.environ.setdefault("DATABASE_URL", "postgres://unused:unused@unused:5432/unused")

from fisingas.settings import *  # noqa: E402,F401,F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
        # Same request-transaction behaviour as production
        "ATOMIC_REQUESTS": True,
    }
}

# The suite provokes 401/403/404 responses on purpose — keep
# the test output readable (the "django" logger must be
# lowered too: propagated records bypass the root level)
LOGGING["root"]["level"] = "ERROR"  # noqa: F405
LOGGING["loggers"] = {"django": {"level": "ERROR"}}  # noqa: F405
