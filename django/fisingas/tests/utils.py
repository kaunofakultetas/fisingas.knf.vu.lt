############################################################
#  [*] Shared test fixtures and helpers
#
#  Small factories for the two account kinds and the
#  question bank, plus the login helpers every endpoint
#  test starts with. Everything follows the same
#  conventions the code uses: integer 0/1 flags, aware
#  datetimes for timestamps (local("2026-08-01 10:00:00")
#  builds a Vilnius-time fixture), bcrypt hashes for admins,
#  plaintext passcodes for students.
############################################################


from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.utils import timezone
import json

import bcrypt

from fisingas.phishing_test.models import Question, QuestionImage, QuestionOption
from fisingas.users.models import Student, SystemUser


# Valid magic bytes for the three sniffed image types —
# get_picture only looks at the first bytes, upload_picture
# only at the filename extension
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"fake png body"
JPEG_BYTES = b"\xff\xd8\xff" + b"fake jpeg body"
GIF_BYTES = b"GIF89a" + b"fake gif body"

# The timestamp format used all over the API
# The API's timestamp format: ISO-8601 in Europe/Vilnius with the
# explicit offset, e.g. "2026-08-26T19:09:07+03:00"
TIMESTAMP_RE = r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$"

LOCAL_TZ = ZoneInfo("Europe/Vilnius")


def local(text):
    """'2026-08-01 10:00:00' as an aware Europe/Vilnius datetime — fixture timestamps."""
    return datetime.strptime(text, "%Y-%m-%d %H:%M:%S").replace(tzinfo=LOCAL_TZ)


def is_recent(value, seconds=60):
    """True when value is an aware datetime stamped within the last `seconds`."""
    return (
        isinstance(value, datetime)
        and value.tzinfo is not None
        and timedelta(0) <= timezone.now() - value <= timedelta(seconds=seconds)
    )


# One shared bcrypt hash for every test admin — 4 rounds keeps
# the suite fast, and checkpw does not care how many rounds a
# stored hash was created with
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "correct-admin-password"
ADMIN_PASSWORD_HASH = bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt(rounds=4)).decode()

STUDENT_USERNAME = "STUDENT_ONE"
STUDENT_PASSCODE = "12345678"








############################################################
# Factories
############################################################

def create_admin(email=ADMIN_EMAIL, enabled=1, password_hash=None, last_login=None):
    return SystemUser.objects.create(
        email=email,
        password=ADMIN_PASSWORD_HASH if password_hash is None else password_hash,
        admin=1,
        enabled=enabled,
        last_login=last_login,
    )


def create_student(username=STUDENT_USERNAME, passcode=STUDENT_PASSCODE, **fields):
    return Student.objects.create(username=username, passcode=passcode, **fields)


def create_question(is_phishing=0, is_enabled=1, question="Ar tai fišingas?", image_bytes=PNG_BYTES, created=None):
    image = QuestionImage.objects.create(image=image_bytes, created=created)
    return Question.objects.create(
        is_enabled=is_enabled,
        is_phishing=is_phishing,
        question=question,
        image=image,
        created=created,
    )


def add_option(question, option_text="Pažymėk mane", answer_status=None):
    return QuestionOption.objects.create(
        question=question,
        option_text=option_text,
        answer_status=answer_status,
    )








############################################################
# Request helpers
############################################################

def post_json(client, url, payload):
    return client.post(url, data=json.dumps(payload), content_type="application/json")


def login(client, username, password):
    return post_json(client, "/api/login", {"username": username, "password": password})


def login_admin(client, email=ADMIN_EMAIL, password=ADMIN_PASSWORD):
    response = login(client, email, password)
    assert response.content == b"OK", f"admin login failed: {response.content!r}"
    return response


def login_student(client, username=STUDENT_USERNAME, passcode=STUDENT_PASSCODE):
    response = login(client, username, passcode)
    assert response.content == b"OK", f"student login failed: {response.content!r}"
    return response
