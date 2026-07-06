############################################################
#  [*] Celery — background tasks and their schedule
#
#  Runs in the fisingas-celery container (the same image as
#  the web service, started with `celery -A fisingas worker
#  -B`): one worker process with the beat scheduler embedded
#  — safe because there is exactly one replica; a second
#  worker would need beat split out or every task fires
#  twice. Messages go through the fisingas-redis broker.
#
#  Configuration comes from settings.py (every CELERY_*
#  value), so the broker URL and timezone live with the rest
#  of the configuration. Tasks are auto-discovered from each
#  app's tasks.py.
#
#  Current schedule:
#    - delete_old_students — daily at 03:00 (Europe/Vilnius),
#      removes accounts inactive longer than the retention
#      period (RETENTION_DAYS in users/tasks.py)
############################################################


import os

from celery import Celery
from celery.schedules import crontab


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "fisingas.settings")

app = Celery("fisingas")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()


app.conf.beat_schedule = {
    "delete-old-students": {
        "task": "fisingas.users.tasks.delete_old_students",
        "schedule": crontab(hour=3, minute=0),
    },
}
