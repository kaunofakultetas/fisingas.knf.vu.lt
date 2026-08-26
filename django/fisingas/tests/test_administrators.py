############################################################
#  [*] Regression tests — administrator management
#
#  GET/POST /api/admin/administrators: the list shape, the
#  insertupdate create/edit rules (password length, unique
#  email, "empty password keeps the current one") and the
#  delete action.
############################################################


from django.test import Client, TestCase

from fisingas.users.models import SystemUser

from .utils import ADMIN_PASSWORD_HASH, create_admin, create_student, login_admin, login_student, post_json


URL = "/api/admin/administrators"








############################################################
# Access control
############################################################

class AdministratorsAccessTests(TestCase):

    def test_requires_login(self):
        self.assertEqual(self.client.get(URL).status_code, 401)

    def test_students_are_refused(self):
        create_student()
        login_student(self.client)
        response = self.client.get(URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"Error: Not Admin")

    def test_students_cannot_post_either(self):
        create_student()
        login_student(self.client)
        response = post_json(self.client, URL, {"action": "delete", "id": 1})
        self.assertEqual(response.content, b"Error: Not Admin")








############################################################
# GET — the accounts table
############################################################

class AdministratorsListTests(TestCase):

    def test_lists_every_account_ordered_by_id(self):
        first = create_admin(last_login="2026-01-01 10:00:00")
        second = create_admin(email="second@example.com", enabled=0)
        login_admin(self.client)

        self.assertEqual(self.client.get(URL).json(), [
            {"id": first.id, "email": first.email, "enabled": 1, "lastseen": "2026-01-01 10:00:00"},
            {"id": second.id, "email": "second@example.com", "enabled": 0, "lastseen": ""},
        ])








############################################################
# POST — insertupdate / delete
############################################################

class AdministratorsMutationTests(TestCase):

    def setUp(self):
        self.admin = create_admin()
        login_admin(self.client)

    def test_invalid_body_is_a_400(self):
        response = self.client.post(URL, data="not json", content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"type": "error", "reason": "Invalid request body"})

    def test_body_without_action_is_a_400(self):
        response = post_json(self.client, URL, {"id": ""})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"type": "error", "reason": "Invalid request body"})

    def test_unknown_action_is_a_plain_error(self):
        response = post_json(self.client, URL, {"action": "explode"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"type": "error"})


    # ---- insertupdate: create ----

    def test_create_stores_a_bcrypt_hash_and_the_account_can_log_in(self):
        response = post_json(self.client, URL, {
            "action": "insertupdate", "id": "",
            "email": "new@example.com", "password": "brand-new-password", "enabled": 1,
        })
        self.assertEqual(response.json(), {"type": "ok"})

        created = SystemUser.objects.get(email="new@example.com")
        self.assertEqual(created.enabled, 1)
        self.assertTrue(created.password.startswith("$2b$"))
        self.assertNotIn("brand-new-password", created.password)

        # The full hashing round-trip: the new account logs in
        login_admin(Client(), email="new@example.com", password="brand-new-password")

    def test_create_refuses_short_password(self):
        response = post_json(self.client, URL, {
            "action": "insertupdate", "id": "", "email": "new@example.com", "password": "short", "enabled": 1,
        })
        self.assertEqual(response.json(), {"type": "error", "reason": "Password must be at least 8 characters long"})
        self.assertFalse(SystemUser.objects.filter(email="new@example.com").exists())

    def test_create_refuses_empty_password(self):
        response = post_json(self.client, URL, {
            "action": "insertupdate", "id": "", "email": "new@example.com", "password": "", "enabled": 1,
        })
        self.assertEqual(response.json(), {"type": "error", "reason": "Password must be at least 8 characters long"})

    def test_create_refuses_taken_email(self):
        response = post_json(self.client, URL, {
            "action": "insertupdate", "id": "", "email": self.admin.email, "password": "long-enough", "enabled": 1,
        })
        self.assertEqual(response.json(), {"type": "error", "reason": "Administrator with this email already exists"})
        self.assertEqual(SystemUser.objects.count(), 1)


    def test_create_refuses_password_over_the_bcrypt_72_byte_limit(self):
        # EDGE-04 fix: bcrypt silently ignores everything past byte
        # 72 — such a password would authenticate on its prefix
        response = post_json(self.client, URL, {
            "action": "insertupdate", "id": "",
            "email": "new@example.com", "password": "a" * 73, "enabled": 1,
        })
        self.assertEqual(response.json(), {"type": "error", "reason": "Password must be at most 72 bytes long"})
        self.assertFalse(SystemUser.objects.filter(email="new@example.com").exists())

    def test_password_limit_counts_utf8_bytes_not_characters(self):
        # 37 Lithuanian letters are 74 bytes — refused...
        refused = post_json(self.client, URL, {
            "action": "insertupdate", "id": "",
            "email": "lt@example.com", "password": "ą" * 37, "enabled": 1,
        })
        self.assertEqual(refused.json(), {"type": "error", "reason": "Password must be at most 72 bytes long"})

        # ...while 36 of them (exactly 72 bytes) still pass and log in
        accepted = post_json(self.client, URL, {
            "action": "insertupdate", "id": "",
            "email": "lt@example.com", "password": "ą" * 36, "enabled": 1,
        })
        self.assertEqual(accepted.json(), {"type": "ok"})
        login_admin(Client(), email="lt@example.com", password="ą" * 36)

    def test_72_ascii_characters_still_fit(self):
        response = post_json(self.client, URL, {
            "action": "insertupdate", "id": "",
            "email": "long@example.com", "password": "a" * 72, "enabled": 1,
        })
        self.assertEqual(response.json(), {"type": "ok"})
        login_admin(Client(), email="long@example.com", password="a" * 72)

    def test_edit_also_refuses_an_oversized_password(self):
        other = create_admin(email="other@example.com")
        response = post_json(self.client, URL, {
            "action": "insertupdate", "id": other.id,
            "email": other.email, "password": "a" * 73, "enabled": 1,
        })
        self.assertEqual(response.json(), {"type": "error", "reason": "Password must be at most 72 bytes long"})
        other.refresh_from_db()
        self.assertEqual(other.password, ADMIN_PASSWORD_HASH)


    # ---- insertupdate: edit ----

    def test_edit_with_empty_password_keeps_the_current_one(self):
        other = create_admin(email="other@example.com", enabled=1)
        response = post_json(self.client, URL, {
            "action": "insertupdate", "id": other.id,
            "email": "renamed@example.com", "password": "", "enabled": 0,
        })
        self.assertEqual(response.json(), {"type": "ok"})

        other.refresh_from_db()
        self.assertEqual(other.email, "renamed@example.com")
        self.assertEqual(other.enabled, 0)
        self.assertEqual(other.password, ADMIN_PASSWORD_HASH)

    def test_edit_with_password_replaces_the_hash(self):
        other = create_admin(email="other@example.com")
        post_json(self.client, URL, {
            "action": "insertupdate", "id": other.id,
            "email": other.email, "password": "replacement-password", "enabled": 1,
        })
        other.refresh_from_db()
        self.assertNotEqual(other.password, ADMIN_PASSWORD_HASH)
        self.assertTrue(other.password.startswith("$2b$"))

        login_admin(Client(), email="other@example.com", password="replacement-password")

    def test_edit_refuses_short_password_too(self):
        other = create_admin(email="other@example.com")
        response = post_json(self.client, URL, {
            "action": "insertupdate", "id": other.id, "email": other.email, "password": "short", "enabled": 1,
        })
        self.assertEqual(response.json(), {"type": "error", "reason": "Password must be at least 8 characters long"})
        other.refresh_from_db()
        self.assertEqual(other.password, ADMIN_PASSWORD_HASH)


    # ---- delete ----

    def test_delete_removes_the_account(self):
        other = create_admin(email="other@example.com")
        response = post_json(self.client, URL, {"action": "delete", "id": other.id})
        self.assertEqual(response.json(), {"type": "ok"})
        self.assertFalse(SystemUser.objects.filter(id=other.id).exists())

    def test_delete_of_unknown_id_still_reports_ok(self):
        response = post_json(self.client, URL, {"action": "delete", "id": 424242})
        self.assertEqual(response.json(), {"type": "ok"})
