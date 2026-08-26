############################################################
#  [*] Django backend — image build
#
#  Single image for dev and prod:
#    - DJANGO_DEBUG=True  → runserver (auto-reload; compose
#      bind-mounts ./django:/app over the baked-in copy)
#    - otherwise          → gunicorn
#
#  Dependencies are pinned here
############################################################

FROM python:3.13-slim

WORKDIR /app


RUN apt-get update && apt-get install -y --no-install-recommends \
        dnsutils \
    && rm -rf /var/lib/apt/lists/*


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
#
# gunicorn prints every request to stdout (docker logs). The
# first column is the client IP as forwarded by Caddy
# (X-Forwarded-For) — gunicorn's own %(h)s would only ever
# show the Caddy container's address. The control socket is
# disabled: the root filesystem is read-only, so creating
# ~/.gunicorn would fail with an ERROR on every boot.
EXPOSE 8000
CMD sh -c "\
    if [ \"$DJANGO_DEBUG\" = 'True' ]; then \
        python3 manage.py runserver 0.0.0.0:8000; \
    else \
        gunicorn fisingas.wsgi:application --bind 0.0.0.0:8000 --workers 5 \
            --access-logfile - \
            --access-logformat '%({x-forwarded-for}i)s %(t)s \"%(r)s\" %(s)s %(b)s %(M)sms' \
            --no-control-socket; \
    fi"
