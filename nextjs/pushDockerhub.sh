#!/bin/bash

# Set variables
CONTAINER_NAME=fisingas-nextjs
BUILD_ARGS=(
    "--build-arg NEXT_PUBLIC_API_URL=http://fisingas-backend:8000/api"
    "--build-arg NEXT_PUBLIC_API_URL_OUTSIDE=https://fisingas.knf.vu.lt/api"
)


# Build the container with arguments
sudo docker build                                               \
    -f Dockerfile.prod                                          \
    ${BUILD_ARGS[@]}                                            \
    -t $CONTAINER_NAME .


# Push to Docker Hub
TODAY=$(date +%Y%m%d)
sudo docker login -u admin@knf.vu.lt
sudo docker tag $CONTAINER_NAME vuknf/$CONTAINER_NAME:latest
sudo docker tag $CONTAINER_NAME vuknf/$CONTAINER_NAME:$TODAY
sudo docker push vuknf/$CONTAINER_NAME:latest
sudo docker push vuknf/$CONTAINER_NAME:$TODAY