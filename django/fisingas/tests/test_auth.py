############################################################
#  [*] Regression tests — authentication
#
#  POST /api/login, GET /api/checkauth, GET /api/checkauth/admin
#  and the session scheme of common/auth.py: the exact
#  Lithuanian error strings the login page shows verbatim,
#  the cookie contract the frontend depends on, and the
#  "re-loaded on every request" session invalidation.
############################################################


from django.contrib.sessions.models import Session
from django.test import Client, TestCase

from fisingas.users.models import Student, SystemUser

from .utils import (
    is_recent,
    ADMIN_EMAIL,
    STUDENT_PASSCODE,
    STUDENT_USERNAME,
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

    def test_get_login_returns_the_validation_message(self):
        # No 405 here — a bodyless GET walks the normal validation
        # path and gets the first message
        response = self.client.get("/api/login")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content.decode(), "Įveskite Prisijungimo Vardą ir Slaptažodį.")

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

    def test_session_cookie_is_httponly_and_browser_scoped(self):
        # Logout goes through POST /api/logout, so JS never needs
        # to touch the cookie — HttpOnly must be ON (out of reach
        # of scripts), and the cookie must still die with the
        # browser (no Max-Age)
        create_admin()
        cookie = login_admin(self.client).cookies["session"]
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["max-age"], "")
        # Lax is what keeps cross-site POSTs from carrying the session
        self.assertEqual(cookie["samesite"], "Lax")

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

    def test_pre_normalization_name_does_not_log_in(self):
        # Registration normalizes "mixed99" to "MIXED99" and shows
        # that name back — login does NOT normalize, so only the
        # normalized form works
        create_student(username="MIXED99", passcode="12345678")
        response = login(self.client, "mixed99", "12345678")
        self.assertEqual(response.content.decode(), "Vardas ir/arba Slaptažodis neteisingas.")
        self.assertEqual(login(self.client, "MIXED99", "12345678").content, b"OK")

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

    def test_garbage_session_cookie_is_anonymous(self):
        # A cookie value that matches no session row is simply an
        # empty session — 401, never an error
        self.client.cookies["session"] = "not-a-real-session-key"
        self.assertEqual(self.client.get("/api/checkauth").status_code, 401)

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
        self.assertTrue(is_recent(admin.last_login))

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
        self.assertTrue(is_recent(student.last_login))

    def test_finished_student_reports_finished(self):
        create_student(is_finished=1)
        login_student(self.client)
        self.assertEqual(self.client.get("/api/checkauth").json()["phishingtestfinished"], 1)








############################################################
# GET /api/checkauth/admin — the Caddy forward_auth gate
############################################################

class CheckauthAdminTests(TestCase):

    def test_bumps_only_the_admins_lastseen(self):
        admin = create_admin()
        student = create_student()

        login_admin(self.client)
        self.client.get("/api/checkauth/admin")
        admin.refresh_from_db()
        self.assertTrue(is_recent(admin.last_login))

        # A rejected student leaves no lastseen trace here
        student_client = Client()
        login_student(student_client)
        student_client.get("/api/checkauth/admin")
        student.refresh_from_db()
        self.assertIsNone(student.last_login)

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
# POST /api/logout — server-side session invalidation
############################################################

class LogoutTests(TestCase):

    def test_logout_kills_the_server_side_session(self):
        create_admin()
        login_admin(self.client)
        self.assertEqual(Session.objects.count(), 1)

        response = self.client.post("/api/logout")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"OK")

        # The django_session row is gone — not just the cookie
        self.assertEqual(Session.objects.count(), 0)
        self.assertEqual(self.client.get("/api/checkauth").status_code, 401)

    def test_captured_cookie_value_is_dead_after_logout(self):
        # The point of the whole fix: a cookie value captured
        # BEFORE logging out (shared/kiosk machines at events)
        # must not be resumable afterwards
        create_admin()
        login_admin(self.client)
        stolen = self.client.cookies["session"].value

        self.client.post("/api/logout")

        self.client.cookies["session"] = stolen
        self.assertEqual(self.client.get("/api/checkauth").status_code, 401)

    def test_logout_clears_the_browser_cookie(self):
        create_admin()
        login_admin(self.client)
        cookie = self.client.post("/api/logout").cookies["session"]
        self.assertEqual(cookie.value, "")
        self.assertIn(cookie["max-age"], (0, "0"))

    def test_logout_works_for_students_too(self):
        create_student()
        login_student(self.client)
        self.client.post("/api/logout")
        self.assertEqual(Session.objects.count(), 0)
        self.assertEqual(self.client.get("/api/checkauth").status_code, 401)

    def test_logout_without_a_session_is_harmless(self):
        response = self.client.post("/api/logout")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"OK")

    def test_logout_only_ends_the_current_session(self):
        # Sessions are per-browser: logging out on one device must
        # not kill the same account's session on another
        create_admin()
        login_admin(self.client)
        other_device = Client()
        login_admin(other_device)
        self.assertEqual(Session.objects.count(), 2)

        self.client.post("/api/logout")

        self.assertEqual(Session.objects.count(), 1)
        self.assertEqual(other_device.get("/api/checkauth").status_code, 200)

    def test_logout_refuses_get(self):
        # Deliberately POST-only — a cross-site top-level GET
        # navigation must not be able to log people out
        create_admin()
        login_admin(self.client)
        self.assertEqual(self.client.get("/api/logout").status_code, 405)
        # ...and the session survived the refused attempt
        self.assertEqual(self.client.get("/api/checkauth").status_code, 200)








############################################################
# Session invalidation — the user is re-loaded per request
############################################################

class SessionInvalidationTests(TestCase):

    def test_relogin_replaces_the_session_user(self):
        # One browser, two logins — the second one wins outright
        create_admin()
        create_student()
        login_admin(self.client)
        login_student(self.client)
        self.assertEqual(self.client.get("/api/checkauth").json()["admin"], 0)

    def test_renaming_admin_kills_the_live_session(self):
        create_admin()
        login_admin(self.client)
        SystemUser.objects.update(email="renamed@example.com")
        self.assertEqual(self.client.get("/api/checkauth").status_code, 401)

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
