############################################################
#  [*] Django backend — image build
#
#  Single image for dev and prod (jauka pattern):
#    - DJANGO_DEBUG=True  → runserver (auto-reload; compose
#      bind-mounts ./django:/app over the baked-in copy)
#    - otherwise          → gunicorn
#
#  Dependencies are pinned here — there is no requirements.txt
#  (same convention as the jauka.knf.vu.lt django service).
############################################################

FROM python:3.13-slim

WORKDIR /app

# Django + configuration helpers
RUN pip install --no-cache-dir                  \
    django==5.2.15                              \
    django-environ==0.13.0

# Infrastructure
RUN pip install --no-cache-dir                  \
    psycopg2-binary==2.9.12                     \
    bcrypt==4.2.1                               \
    gunicorn==26.0.0


# Copy source code
COPY . /app

# Run
EXPOSE 8000
CMD sh -c "\
    if [ \"$DJANGO_DEBUG\" = 'True' ]; then \
        python3 manage.py runserver 0.0.0.0:8000; \
    else \
        gunicorn fisingas.wsgi:application --bind 0.0.0.0:8000 --workers 5; \
    fi"
