"""
WSGI config for the Fisingas project.

Exposes the module-level ``application`` used by gunicorn
(and by Django's development server via WSGI_APPLICATION).
"""
import os

from django.core.wsgi import get_wsgi_application


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "fisingas.settings")

application = get_wsgi_application()
