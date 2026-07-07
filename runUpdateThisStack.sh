#!/bin/bash

############################################################
#  [*] Stack setup / update script
#
#  The ONLY manual step is creating docker-compose.yml from
#  the sample (it stays out of git so every deployment can
#  tune it):
#
#  Everything else is automatic and safe to re-run:
#    - 1. Creates the ./_DATA directories
#    - 2. Checks that docker / docker-compose are installed
#    - 3. Generates DJANGO_SECRET_KEY into .env (once)
#    - 4. Creates the required docker networks (once)
#    - 5. (Re)builds and (re)starts all containers
#    - 6. Applies database migrations
#    - 7. Creates the first admin account (only on an empty
#      database) and prints its credentials
############################################################







############################################################
# STEP 1: DATA DIRECTORIES
# Create data directories if they don't exist
############################################################
mkdir -p ./_DATA/dropbox
mkdir -p ./_DATA/slides
mkdir -p ./_DATA/postgres
sudo chown -R 1000:1000 ./_DATA
############################################################








############################################################
# STEP 2: PREFLIGHT CHECKS 
# Friendly errors instead of cryptic failures further down
############################################################
if ! command -v docker > /dev/null; then
    echo "ERROR: docker is not installed. Install it first: https://docs.docker.com/engine/install/"
    exit 1
fi

if ! command -v docker-compose > /dev/null; then
    echo "ERROR: docker-compose is not installed. Install it first: https://docs.docker.com/compose/install/"
    exit 1
fi

if [ ! -f docker-compose.yml ]; then
    echo "ERROR: docker-compose.yml not found."
    echo ""
    echo "Create it from the sample and review it (this is the only manual step):"
    echo ""
    echo "    cp docker-compose.yml.sample docker-compose.yml"
    echo ""
    echo "Then run this script again."
    exit 1
fi
############################################################








############################################################
# STEP 3: DJANGO SECRET KEY AUTOSETUP
# Generate DJANGO_SECRET_KEY if it doesn't exist in .env
############################################################
if [ ! -f .env ] || ! grep -q "^DJANGO_SECRET_KEY=" .env; then
    echo "Generating DJANGO_SECRET_KEY..."
    DJANGO_SECRET_KEY="$(openssl rand -hex 32)"

    # Only add newline if file doesn't end with one
    [ -f .env ] && [ -n "$(tail -c1 .env 2>/dev/null)" ] && echo "" >> .env
    echo "DJANGO_SECRET_KEY=$DJANGO_SECRET_KEY" >> .env
    echo "DJANGO_SECRET_KEY added to .env"
fi
############################################################








############################################################
# STEP 4: DBGATE BASIC AUTH AUTOSETUP
# Generate DBGATE credentials if they don't exist in .env
############################################################
if [ ! -f .env ] || ! grep -q "^DBGATE_PASSWORD=" .env; then
    echo "Generating DBGATE credentials..."
    DBGATE_PASSWORD="$(openssl rand -hex 32)"
    DBGATE_AUTH_HEADER="$(echo -n "dbgate:$DBGATE_PASSWORD" | base64 -w 0)"

    # Only add newline if file doesn't end with one
    [ -f .env ] && [ -n "$(tail -c1 .env 2>/dev/null)" ] && echo "" >> .env
    echo "DBGATE_PASSWORD=$DBGATE_PASSWORD" >> .env
    echo "DBGATE_AUTH_HEADER=$DBGATE_AUTH_HEADER" >> .env
    echo "DBGATE credentials added to .env"
fi
#########################################################################################








############################################################
# STEP 5: (RE)START THE STACK
# Create docker networks if they don't exist
############################################################
sudo docker network create --subnet=172.18.0.0/24 external
sudo docker-compose down
sudo docker-compose up -d --build --force-recreate
############################################################








############################################################
# STEP 6: DATABASE MIGRATIONS
# Wait until Django can reach PostgreSQL, then apply the
# migrations. Retried because the very first start includes
# the PostgreSQL init which takes a few seconds.
############################################################
echo "Applying database migrations..."
for attempt in $(seq 1 30); do
    if sudo docker exec fisingas-django python3 manage.py migrate --noinput 2>/dev/null; then
        echo "Database migrations applied."
        break
    fi

    if [ "$attempt" = "30" ]; then
        echo "ERROR: Django could not apply migrations. Check the logs:"
        echo "    sudo docker logs fisingas-django"
        echo "    sudo docker logs fisingas-postgres"
        exit 1
    fi
    sleep 2
done
############################################################








############################################################
# STEP 7: FIRST ADMIN AUTOSETUP
# Only on an empty database: create the first administrator
# account so the fresh install is actually loginable.
############################################################
CREATED="$(sudo docker exec fisingas-django python3 manage.py shell -c "
import bcrypt
from fisingas.users.models import SystemUser
if not SystemUser.objects.exists():
    SystemUser.objects.create(
        email='admin@admin.com',
        password=bcrypt.hashpw(b'admin', bcrypt.gensalt(rounds=12)).decode(),
        admin=1,
        enabled=1,
    )
    print('CREATED')
")"

if [ "$CREATED" = "CREATED" ]; then
    echo ""
    echo "=========================================================="
    echo "  First admin account created:"
    echo ""
    echo "      Email:    admin@admin.com"
    echo "      Password: admin"
    echo ""
    echo "  CHANGE THIS PASSWORD IMMEDIATELY on the"
    echo "  Administrators page after logging in."
    echo "=========================================================="
fi
############################################################








echo ""
echo "Stack is up. Open http://localhost (or this server's domain)."


