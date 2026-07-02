#!/bin/bash

mkdir -p ./_DATA/dropbox
mkdir -p ./_DATA/slides
mkdir -p ./_DATA/postgres
sudo chown -R 1000:1000 ./_DATA



############################# DJANGO SECRET KEY AUTOSETUP ################################
# Only generate if DJANGO_SECRET_KEY doesn't exist in .env
if [ ! -f .env ] || ! grep -q "^DJANGO_SECRET_KEY=" .env; then
    echo "Generating DJANGO_SECRET_KEY..."
    DJANGO_SECRET_KEY="$(openssl rand -hex 32)"

    # Only add newline if file doesn't end with one
    [ -f .env ] && [ -n "$(tail -c1 .env 2>/dev/null)" ] && echo "" >> .env
    echo "DJANGO_SECRET_KEY=$DJANGO_SECRET_KEY" >> .env
    echo "DJANGO_SECRET_KEY added to .env"
fi
#########################################################################################



sudo docker-compose down
sudo docker-compose up -d --build --force-recreate
