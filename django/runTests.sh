#!/bin/bash
############################################################
#  [*] Run the Django regression tests
#
#  Builds the production image and runs the whole suite
#  (fisingas/tests/) inside a throwaway --rm container
#  against an in-memory SQLite database — nothing that is
#  running is touched, and nothing survives the run.
#
#  The swagger spec is mounted in read-only and two
#  test-only validator packages are installed inside the
#  throwaway container (never into the image) — that is
#  what lets test_contract.py validate real responses
#  against swagger.yaml.
############################################################

set -e
cd "$(dirname "$0")"

sudo docker build -t fisingas-django-test .
sudo docker run --rm -v "$(pwd)/../swagger:/swagger:ro" fisingas-django-test \
    sh -c "pip install -q --no-cache-dir pyyaml==6.0.2 openapi-schema-validator==0.6.2 \
        && python3 manage.py test fisingas.tests --settings=fisingas.tests.settings -v 2"
