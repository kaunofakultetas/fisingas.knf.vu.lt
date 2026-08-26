#!/bin/bash
############################################################
#  [*] Run the Django regression tests
#
#  Builds the production image and runs the whole suite
#  (fisingas/tests/) inside a throwaway --rm container
#  against an in-memory SQLite database — nothing that is
#  running is touched, and nothing survives the run.
############################################################

set -e
cd "$(dirname "$0")"

sudo docker build -t fisingas-django-test .
sudo docker run --rm fisingas-django-test \
    python3 manage.py test fisingas.tests --settings=fisingas.tests.settings -v 2
