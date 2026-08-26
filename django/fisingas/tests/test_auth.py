############################################################
#  [*] Regression tests — authentication
#
#  POST /api/login, GET /api/checkauth, GET /api/checkauth/admin
#  and the session scheme of common/auth.py: the exact
#  Lithuanian error strings the login page shows verbatim,
#  the cookie contract the frontend depends on, and the
#  "re-loaded on every request" session invalidation.
############################################################


from django.test import TestCase

from fisingas.users.models import Student, SystemUser

from .utils import (
    ADMIN_EMAIL,
    STUDENT_PASSCODE,
    STUDENT_USERNAME,
    TIMESTAMP_RE,
    create_admin,
    create_student,
    login,
    login_admin,
    login_student,
    post_json,
)








############################################################
# Login — pre-auth validation
############################################################

class LoginValidationTests(TestCase):

    def test_non_json_body_asks_for_both_fields(self):
        response = self.client.post("/api/login", data="not json", content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content.decode(), "Įveskite Prisijungimo Vardą ir Slaptažodį.")

    def test_empty_fields_ask_for_both(self):
        response = post_json(self.client, "/api/login", {"username": "", "password": ""})
        self.assertEqual(response.content.decode(), "Įveskite Prisijungimo Vardą ir Slaptažodį.")

    def test_missing_username(self):
        response = post_json(self.client, "/api/login", {"username": "", "password": "x"})
        self.assertEqual(response.content.decode(), "Įveskite Prisijungimo Vardą.")

    def test_missing_password(self):
        response = post_json(self.client, "/api/login", {"username": "user@example.com", "password": ""})
        self.assertEqual(response.content.decode(), "Įveskite Slaptažodį.")

    def test_trailing_slash_is_unknown(self):
        # APPEND_SLASH is off — the API has no slash-suffixed twins
        response = post_json(self.client, "/api/login/", {"username": "a", "password": "b"})
        self.assertEqual(response.status_code, 404)








############################################################
# Login — administrators (email + bcrypt)
############################################################

class AdminLoginTests(TestCase):

    def test_correct_password_logs_in(self):
        create_admin()
        response = login_admin(self.client)
        self.assertEqual(response.content, b"OK")
        self.assertIn("session", response.cookies)

    def test_session_cookie_is_deletable_from_js(self):
        # The login page logs out by dropping the cookie via
        # document.cookie — HttpOnly must stay off, and the
        # cookie must die with the browser (no Max-Age)
        create_admin()
        cookie = login_admin(self.client).cookies["session"]
        self.assertFalse(cookie["httponly"])
        self.assertEqual(cookie["max-age"], "")

    def test_wrong_password_refused(self):
        create_admin()
        response = login(self.client, ADMIN_EMAIL, "wrong-password")
        self.assertEqual(response.content.decode(), "El. Paštas ir/arba Slaptažodis neteisingas.")
        self.assertNotIn("session", response.cookies)

    def test_unknown_email_gets_the_same_message(self):
        # No user enumeration — unknown account and wrong
        # password are indistinguishable
        response = login(self.client, "nobody@example.com", "whatever")
        self.assertEqual(response.content.decode(), "El. Paštas ir/arba Slaptažodis neteisingas.")

    def test_disabled_admin_refused(self):
        create_admin(enabled=0)
        response = login(self.client, ADMIN_EMAIL, "correct-admin-password")
        self.assertEqual(response.content.decode(), "El. Paštas ir/arba Slaptažodis neteisingas.")

    def test_corrupt_hash_counts_as_wrong_password(self):
        # A broken hash in the database must not crash the endpoint
        create_admin(password_hash="not-a-bcrypt-hash")
        response = login(self.client, ADMIN_EMAIL, "whatever")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content.decode(), "El. Paštas ir/arba Slaptažodis neteisingas.")








############################################################
# Login — students (username + plaintext passcode)
############################################################

class StudentLoginTests(TestCase):

    def test_correct_passcode_logs_in(self):
        create_student()
        response = login_student(self.client)
        self.assertEqual(response.content, b"OK")

    def test_wrong_passcode_refused(self):
        create_student()
        response = login(self.client, STUDENT_USERNAME, "00000000")
        self.assertEqual(response.content.decode(), "Vardas ir/arba Slaptažodis neteisingas.")

    def test_unknown_username_gets_the_same_message(self):
        response = login(self.client, "NOBODY", "00000000")
        self.assertEqual(response.content.decode(), "Vardas ir/arba Slaptažodis neteisingas.")

    def test_deactivated_student_refused(self):
        create_student(status=0)
        response = login(self.client, STUDENT_USERNAME, STUDENT_PASSCODE)
        self.assertEqual(response.content.decode(), "Vardas ir/arba Slaptažodis neteisingas.")

    def test_name_existing_in_both_tables_refuses_login(self):
        # load_user refuses to guess when a name matches both an
        # admin and a student — login is simply rejected
        SystemUser.objects.create(email="COLLIDE", password="irrelevant", admin=1, enabled=1)
        create_student(username="COLLIDE", passcode="12345678")
        response = login(self.client, "COLLIDE", "12345678")
        self.assertEqual(response.content.decode(), "Vardas ir/arba Slaptažodis neteisingas.")








############################################################
# GET /api/checkauth
############################################################

class CheckauthTests(TestCase):

    def test_requires_login(self):
        response = self.client.get("/api/checkauth")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.content, b"Unauthorized")

    def test_admin_info(self):
        admin = create_admin()
        login_admin(self.client)
        response = self.client.get("/api/checkauth")
        self.assertEqual(response.json(), {"id": ADMIN_EMAIL, "userid": admin.id, "admin": 1})

    def test_admin_checkauth_bumps_last_login(self):
        admin = create_admin()
        login_admin(self.client)
        self.client.get("/api/checkauth")
        admin.refresh_from_db()
        self.assertRegex(admin.last_login, TIMESTAMP_RE)

    def test_student_info_includes_passcode_and_finish_flag(self):
        student = create_student()
        login_student(self.client)
        response = self.client.get("/api/checkauth")
        self.assertEqual(response.json(), {
            "id": STUDENT_USERNAME,
            "userid": student.id,
            "admin": 0,
            "passcode": STUDENT_PASSCODE,
            "phishingtestfinished": 0,
        })

    def test_student_checkauth_bumps_last_login(self):
        student = create_student()
        login_student(self.client)
        self.client.get("/api/checkauth")
        student.refresh_from_db()
        self.assertRegex(student.last_login, TIMESTAMP_RE)

    def test_finished_student_reports_finished(self):
        create_student(is_finished=1)
        login_student(self.client)
        self.assertEqual(self.client.get("/api/checkauth").json()["phishingtestfinished"], 1)








############################################################
# GET /api/checkauth/admin — the Caddy forward_auth gate
############################################################

class CheckauthAdminTests(TestCase):

    def test_requires_login(self):
        response = self.client.get("/api/checkauth/admin")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.content, b"Unauthorized")

    def test_admin_passes(self):
        admin = create_admin()
        login_admin(self.client)
        response = self.client.get("/api/checkauth/admin")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"id": ADMIN_EMAIL, "userid": admin.id, "admin": 1})

    def test_student_is_rejected(self):
        create_student()
        login_student(self.client)
        response = self.client.get("/api/checkauth/admin")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"message": "Unauthorized"})








############################################################
# Session invalidation — the user is re-loaded per request
############################################################

class SessionInvalidationTests(TestCase):

    def test_disabling_admin_kills_the_live_session(self):
        create_admin()
        login_admin(self.client)
        SystemUser.objects.update(enabled=0)
        self.assertEqual(self.client.get("/api/checkauth").status_code, 401)

    def test_deactivating_student_kills_the_live_session(self):
        create_student()
        login_student(self.client)
        Student.objects.update(status=0)
        self.assertEqual(self.client.get("/api/checkauth").status_code, 401)

    def test_deleting_student_kills_the_live_session(self):
        create_student()
        login_student(self.client)
        Student.objects.all().delete()
        self.assertEqual(self.client.get("/api/checkauth").status_code, 401)

    def test_renaming_student_kills_the_live_session(self):
        # Only the login name lives in the session — renaming the
        # account orphans it immediately
        create_student()
        login_student(self.client)
        Student.objects.update(username="RENAMED")
        self.assertEqual(self.client.get("/api/checkauth").status_code, 401)
