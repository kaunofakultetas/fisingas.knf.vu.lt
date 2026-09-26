#!/bin/sh
# -----------------------------------------------------------
#  [*] Frontend — regression test runner
#
#  Builds the builder stage of the PRODUCTION Dockerfile (the
#  same node image and npm install that produce dist/) and
#  runs the vitest suite inside a throwaway container — so
#  what gets tested is exactly what ships, and the host needs
#  no node.
# -----------------------------------------------------------
set -e
cd "$(dirname "$0")"

sudo docker build --target builder -t fisingas-vite-check .
sudo docker run --rm --name fisingas-vite-tests --memory=6g --memory-swap=6g --cpus=6 \
  fisingas-vite-check npx vitest run --maxWorkers=4
