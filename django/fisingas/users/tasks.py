############################################################
#  [*] Users background tasks (Celery)
#
#    delete_old_students — daily retention sweep
#
#  Scheduled in fisingas/celery.py, executed by the
#  fisingas-celery container. Output goes to the console —
#  `docker logs fisingas-celery` shows every run.
############################################################


import logging
from datetime import datetime, timedelta

from celery import shared_task

from fisingas.users.models import Student


logger = logging.getLogger(__name__)

# Accounts must be BOTH inactive and registered longer ago
# than this to be removed
RETENTION_DAYS = 180









############################################################
# delete_old_students
############################################################
#
# Remove student accounts untouched for RETENTION_DAYS —
# both their last activity (last_login) and their
# registration are older than the cutoff, so a fresh account
# that never logged in survives. The timestamps are "YYYY-MM-DD
# HH:MM:SS" strings whose string order IS chronological
# order (the convention all account timestamps follow), so
# plain < comparison is safe.
#
# Pre-import accounts with "" in both fields count as old
# and are removed too ("" sorts before any date).
#
# Deleting a Student CASCADEs to their frozen answers,
# checkbox selections and TestResult row — same cleanup the
# admin delete button does. Question images are untouched
# (upload-only table). Admin accounts live in SystemUser and
# are never touched.
#
# Scheduled:
#   - daily at 03:00 Europe/Vilnius (fisingas/celery.py)
############################################################

@shared_task
def delete_old_students():
    cutoff = (datetime.now() - timedelta(days=RETENTION_DAYS)).strftime("%Y-%m-%d %H:%M:%S")

    _, deleted_per_table = Student.objects.filter(
        last_login__lt=cutoff,
        registration_time__lt=cutoff,
    ).delete()

    deleted_students = deleted_per_table.get("users.Student", 0)
    logger.info("delete_old_students: cutoff=%s deleted=%d (%s)", cutoff, deleted_students, deleted_per_table)
    return deleted_students
