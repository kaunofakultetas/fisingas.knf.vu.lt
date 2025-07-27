#!/bin/bash

mkdir -p ./DATABASE

sudo docker-compose down
sudo docker-compose up -d --build --force-recreate
