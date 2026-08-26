############################################################
#  [*] Regression tests — routing and request plumbing
#
#  The framework-level contracts around the API: unknown
#  paths, the request-size guard, and the ordering of the
#  auth check versus the method check.
############################################################


from django.test import TestCase

from .utils import create_student, login_student


class RoutingTests(TestCase):

    def test_unknown_api_path_is_a_404(self):
        self.assertEqual(self.client.get("/api/does/not/exist").status_code, 404)

    def test_oversized_json_body_is_rejected(self):
        # Django's DATA_UPLOAD_MAX_MEMORY_SIZE (2.5MB default)
        # guards request.body — a huge JSON payload to a public
        # endpoint is a 400, not a memory sink
        response = self.client.post(
            "/api/login",
            data="x" * (3 * 1024 * 1024),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_login_check_comes_before_the_method_check(self):
        # POST-only endpoints still answer 401 (not 405) to
        # anonymous requests — @login_required wraps the view
        create_student()
        self.assertEqual(self.client.get("/api/admin/students/1/delete").status_code, 401)
        login_student(self.client)
        self.assertEqual(self.client.get("/api/admin/students/1/delete").status_code, 403)
