# Load the Celery app on Django startup so @shared_task
# decorators bind to it (the standard Celery+Django hook)
from .celery import app as celery_app

__all__ = ("celery_app",)
