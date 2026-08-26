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

from .utils import ADMIN_PASSWORD_HASH, create_admin, create_student, login_admin, login_student, post_json, local


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
        first = create_admin(last_login=local("2026-01-01 10:00:00"))
        second = create_admin(email="second@example.com", enabled=0)
        login_admin(self.client)

        self.assertEqual(self.client.get(URL).json(), [
            {"id": first.id, "email": first.email, "enabled": 1, "lastseen": "2026-01-01T10:00:00+02:00"},
            {"id": second.id, "email": "second@example.com", "enabled": 0, "lastseen": None},
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

    def test_exactly_8_character_password_is_accepted(self):
        # The minimum is "at least 8" — the boundary itself passes
        response = post_json(self.client, URL, {
            "action": "insertupdate", "id": "",
            "email": "eight@example.com", "password": "12345678", "enabled": 1,
        })
        self.assertEqual(response.json(), {"type": "ok"})

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


    def test_edit_refuses_an_email_taken_by_another_account(self):
        # Used to die on the DB unique constraint as a raw 500 —
        # now the same friendly error the create path always had
        other = create_admin(email="other@example.com")
        response = post_json(self.client, URL, {
            "action": "insertupdate", "id": other.id,
            "email": self.admin.email, "password": "", "enabled": 1,
        })
        self.assertEqual(response.json(), {"type": "error", "reason": "Administrator with this email already exists"})
        other.refresh_from_db()
        self.assertEqual(other.email, "other@example.com")

    def test_edit_keeping_the_same_email_is_allowed(self):
        # The uniqueness check must not trip over the account's own row
        other = create_admin(email="other@example.com", enabled=1)
        response = post_json(self.client, URL, {
            "action": "insertupdate", "id": other.id,
            "email": "other@example.com", "password": "", "enabled": 0,
        })
        self.assertEqual(response.json(), {"type": "ok"})
        other.refresh_from_db()
        self.assertEqual(other.enabled, 0)

    def test_cannot_disable_your_own_account(self):
        response = post_json(self.client, URL, {
            "action": "insertupdate", "id": self.admin.id,
            "email": self.admin.email, "password": "", "enabled": 0,
        })
        self.assertEqual(response.json(), {"type": "error", "reason": "You cannot disable your own account"})
        self.admin.refresh_from_db()
        self.assertEqual(self.admin.enabled, 1)

    def test_editing_your_own_account_while_enabled_is_allowed(self):
        response = post_json(self.client, URL, {
            "action": "insertupdate", "id": self.admin.id,
            "email": self.admin.email, "password": "", "enabled": 1,
        })
        self.assertEqual(response.json(), {"type": "ok"})


    def test_edit_of_an_unknown_id_still_reports_ok(self):
        # Consistent with the silent no-op convention of the other
        # mutation endpoints — filter().update() matches nothing
        response = post_json(self.client, URL, {
            "action": "insertupdate", "id": 424242,
            "email": "ghost@example.com", "password": "", "enabled": 1,
        })
        self.assertEqual(response.json(), {"type": "ok"})


    # ---- delete ----

    def test_delete_removes_the_account(self):
        other = create_admin(email="other@example.com")
        response = post_json(self.client, URL, {"action": "delete", "id": other.id})
        self.assertEqual(response.json(), {"type": "ok"})
        self.assertFalse(SystemUser.objects.filter(id=other.id).exists())

    def test_cannot_delete_your_own_account(self):
        # The frontend sends ids as strings — the guard must hold
        # for both representations
        response = post_json(self.client, URL, {"action": "delete", "id": str(self.admin.id)})
        self.assertEqual(response.json(), {"type": "error", "reason": "You cannot delete your own account"})
        self.assertTrue(SystemUser.objects.filter(id=self.admin.id).exists())

    def test_delete_of_unknown_id_still_reports_ok(self):
        response = post_json(self.client, URL, {"action": "delete", "id": 424242})
        self.assertEqual(response.json(), {"type": "ok"})







############################################################
# POST /api/admin/administrators — field validation
############################################################

class AdministratorsFieldValidationTests(TestCase):

    def setUp(self):
        self.admin = create_admin()
        login_admin(self.client)

    def _post(self, payload):
        return post_json(self.client, URL, {"action": "insertupdate", **payload})

    def _refused_400(self, response):
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["type"], "error")

    def test_missing_fields_are_a_400(self):
        self._refused_400(self._post({}))

    def test_non_string_email_is_a_400(self):
        self._refused_400(self._post({"id": "", "email": 5, "password": "long-enough-password", "enabled": 1}))

    def test_non_numeric_id_is_a_400(self):
        self._refused_400(self._post({"id": "abc", "email": "kitas@example.com", "password": "", "enabled": 1}))

    def test_non_string_password_is_a_400(self):
        self._refused_400(self._post({"id": "", "email": "kitas@example.com", "password": 12345678, "enabled": 1}))

    def test_bad_enabled_flag_is_a_400(self):
        self._refused_400(self._post({"id": "", "email": "kitas@example.com", "password": "long-enough-password", "enabled": "yes"}))

    def test_non_object_body_is_a_400(self):
        response = post_json(self.client, URL, 7)
        self.assertEqual(response.status_code, 400)

    def test_delete_without_a_numeric_id_is_a_400(self):
        response = post_json(self.client, URL, {"action": "delete", "id": "abc"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(SystemUser.objects.count(), 1)

    def test_email_without_at_sign_is_refused(self):
        # "@" is the role discriminator at login — an admin without
        # one would be routed into the student branch and never log in
        response = self._post({"id": "", "email": "not-an-email", "password": "long-enough-password", "enabled": 1})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"type": "error", "reason": "Email address must contain @"})
        self.assertEqual(SystemUser.objects.count(), 1)

    def test_edit_cannot_remove_the_at_sign_either(self):
        response = self._post({"id": self.admin.id, "email": "renamed", "password": "", "enabled": 1})
        self.assertEqual(response.json()["type"], "error")
        self.admin.refresh_from_db()
        self.assertIn("@", self.admin.email)

    def test_digit_string_id_and_string_flags_from_the_form_still_work(self):
        response = self._post({"id": str(self.admin.id), "email": self.admin.email, "password": "", "enabled": "1"})
        self.assertEqual(response.json(), {"type": "ok"})

    def test_other_verbs_are_a_405(self):
        self.assertEqual(self.client.put(URL).status_code, 405)
        self.assertEqual(self.client.delete(URL).status_code, 405)
