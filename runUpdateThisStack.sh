#!/bin/bash

mkdir -p ./_DATA/database
mkdir -p ./_DATA/dropbox
mkdir -p ./_DATA/slides
sudo chown -R 1000:1000 ./_DATA

sudo docker-compose down
sudo docker-compose up -d --build --force-recreate
