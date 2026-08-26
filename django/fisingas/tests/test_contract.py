############################################################
#  [*] Contract tests — responses validated against swagger
#
#  The mechanical guarantee that swagger/swagger.yaml
#  represents reality: real responses from the running
#  views are validated against the spec's response schemas
#  ($refs resolved, OpenAPI 3.0 `nullable` handled), and
#  the content-type claims — including the "plain text is
#  served as text/html" convention — are asserted.
#
#  Needs the mounted spec and two test-only packages;
#  runTests.sh provides both. Without the packages this
#  module skips itself with a visible reason.
############################################################


import os
import unittest

from django.test import Client, TestCase

try:
    import yaml
    from openapi_schema_validator import OAS30Validator
except ImportError:
    raise unittest.SkipTest(
        "contract tests need pyyaml + openapi-schema-validator (runTests.sh installs them)"
    )

from fisingas.phishing_test.models import Answer, AnswerSelectedOption, QuestionLink, TestResult

from .utils import (
    PNG_BYTES,
    add_option,
    create_admin,
    create_question,
    create_student,
    login_admin,
    login_student,
    post_json,
)


# The mounted location (runTests.sh) first, the repo layout second
SPEC_CANDIDATES = [
    "/swagger/swagger.yaml",
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "swagger", "swagger.yaml"),
]








############################################################
# Spec loading and schema lookup
############################################################

_spec_cache = None


def _spec():
    global _spec_cache
    if _spec_cache is None:
        for candidate in SPEC_CANDIDATES:
            if os.path.isfile(candidate):
                with open(candidate) as handle:
                    _spec_cache = yaml.safe_load(handle)
                break
        else:
            raise RuntimeError("swagger.yaml not found — runTests.sh mounts it at /swagger")
    return _spec_cache


def _resolve(node, root):
    # Inline every local $ref so a plain schema validator can walk it
    if isinstance(node, dict):
        if "$ref" in node:
            target = root
            for part in node["$ref"].lstrip("#/").split("/"):
                target = target[part]
            return _resolve(target, root)
        return {key: _resolve(value, root) for key, value in node.items()}
    if isinstance(node, list):
        return [_resolve(item, root) for item in node]
    return node


def _response_schema(spec_path, method, status, ctype):
    spec = _spec()
    response = _resolve(spec["paths"][spec_path][method]["responses"][str(status)], spec)
    return response["content"][ctype]["schema"]


class ContractTestCase(TestCase):

    def assertMatchesSpec(self, response, spec_path, method="get", status=200, ctype="application/json"):
        self.assertEqual(response.status_code, status, response.content[:200])
        self.assertTrue(
            response["Content-Type"].startswith(ctype),
            f"{method.upper()} {spec_path}: Content-Type {response['Content-Type']!r} is not {ctype!r}",
        )
        schema = _response_schema(spec_path, method, status, ctype)
        try:
            OAS30Validator(schema).validate(response.json())
        except Exception as error:
            self.fail(f"{method.upper()} {spec_path} [{status}] response violates swagger: {error}")

    def assertHtmlText(self, response, status=200):
        # The documented convention: plain-text bodies served as text/html
        self.assertEqual(response.status_code, status, response.content[:200])
        self.assertTrue(response["Content-Type"].startswith("text/html"), response["Content-Type"])








############################################################
# Authentication
############################################################

class ContractAuthTests(ContractTestCase):

    def test_checkauth_matches_spec_for_both_roles(self):
        create_admin()
        create_student()

        login_admin(self.client)
        self.assertMatchesSpec(self.client.get("/api/checkauth"), "/api/checkauth")

        student_client = Client()
        login_student(student_client)
        self.assertMatchesSpec(student_client.get("/api/checkauth"), "/api/checkauth")

    def test_checkauth_admin_matches_spec(self):
        create_admin()
        create_student()

        login_admin(self.client)
        self.assertMatchesSpec(self.client.get("/api/checkauth/admin"), "/api/checkauth/admin")

        # The JSON 401 variant (authenticated non-admin)
        student_client = Client()
        login_student(student_client)
        self.assertMatchesSpec(student_client.get("/api/checkauth/admin"), "/api/checkauth/admin", status=401)

    def test_login_and_logout_are_html_text(self):
        create_admin()
        self.assertHtmlText(login_admin(self.client))
        self.assertHtmlText(self.client.post("/api/logout"))

        # A failed login carries the message the same way
        response = post_json(self.client, "/api/login", {"username": "x@y.lt", "password": "wrong-pass"})
        self.assertHtmlText(response)








############################################################
# Registration and the student test flow
############################################################

class ContractStudentTests(ContractTestCase):

    def test_register_matches_spec(self):
        self.assertMatchesSpec(
            post_json(self.client, "/api/student/register", {"username": "CONTRACT"}),
            "/api/student/register", method="post",
        )
        # Duplicate → the error variant of the same schema
        self.assertMatchesSpec(
            post_json(self.client, "/api/student/register", {"username": "CONTRACT"}),
            "/api/student/register", method="post",
        )
        # Malformed body → the documented 400
        self.assertMatchesSpec(
            post_json(self.client, "/api/student/register", {"username": 5}),
            "/api/student/register", method="post", status=400,
        )

    def test_student_questions_matches_spec_in_both_shapes(self):
        student = create_student()
        question = create_question(is_phishing=1)
        add_option(question, answer_status=1)
        QuestionLink.objects.create(image_id=question.image_id, title="t", content="https://x.lt", x="0.1", y="0.2")
        login_student(self.client)

        # The dealt array...
        self.assertMatchesSpec(self.client.get("/api/student/questions"), "/api/student/questions")
        self.assertHtmlText(post_json(self.client, "/api/student/questions", [
            {"questionid": question.id, "selectedanswer": 1},
        ]))

        # ...the finish object...
        self.assertMatchesSpec(self.client.get("/api/student/finish"), "/api/student/finish")

        # ...and the locked {} through the same oneOf
        self.assertMatchesSpec(self.client.get("/api/student/questions"), "/api/student/questions")








############################################################
# Admin surface
############################################################

class ContractAdminTests(ContractTestCase):

    def setUp(self):
        create_admin()
        login_admin(self.client)

    def _mixed_students(self):
        frozen = create_student(username="FROZEN", is_finished=1)
        TestResult.objects.create(
            student=frozen, question_count=2, answered_question_count=2,
            total_identified_correctly=2, fully_correct_count=2,
            total_options_count=0, total_correct_options_count=0,
            total_points=1.0, finished_at="2026-08-01 10:00:00",
        )
        live = create_student(username="LIVE", last_login="2026-08-26 10:00:00")
        Answer.objects.create(student=live, question_id=1, question_text="q", is_phishing=1, answer_status=1)
        AnswerSelectedOption.objects.create(
            student=live, question_id=1, option_id=11,
            option_text="o", right_answer=None, is_selected=None,
        )
        create_student(username="BLANK")
        return live

    def test_students_list_matches_spec(self):
        # Exercises the ""-or-integer oneOf fields on all three row kinds
        self._mixed_students()
        self.assertMatchesSpec(self.client.get("/api/admin/students"), "/api/admin/students")

    def test_student_detail_and_answers_match_spec(self):
        live = self._mixed_students()
        self.assertMatchesSpec(
            self.client.get(f"/api/admin/students/{live.id}"),
            "/api/admin/students/{studentID}",
        )
        self.assertMatchesSpec(
            self.client.get(f"/api/admin/students/{live.id}/answers"),
            "/api/admin/students/{studentID}/answers",
        )

    def test_questions_list_matches_spec_empty_and_populated(self):
        # Empty bank: the null counters
        self.assertMatchesSpec(self.client.get("/api/admin/questions"), "/api/admin/questions")

        question = create_question(is_phishing=1)
        add_option(question, answer_status=None)   # the nullable expected value
        self.assertMatchesSpec(self.client.get("/api/admin/questions"), "/api/admin/questions")

    def test_createnewoption_matches_spec(self):
        question = create_question()
        self.assertMatchesSpec(
            post_json(self.client, "/api/admin/questions/createnewoption", {"questionid": question.id}),
            "/api/admin/questions/createnewoption", method="post",
        )
        # The vanished-question 404 is html text
        self.assertHtmlText(
            post_json(self.client, "/api/admin/questions/createnewoption", {"questionid": 424242}),
            status=404,
        )

    def test_administrators_match_spec(self):
        self.assertMatchesSpec(self.client.get("/api/admin/administrators"), "/api/admin/administrators")

        ok = post_json(self.client, "/api/admin/administrators", {
            "action": "insertupdate", "id": "",
            "email": "second@example.com", "password": "long-enough", "enabled": 1,
        })
        self.assertMatchesSpec(ok, "/api/admin/administrators", method="post")

        error = post_json(self.client, "/api/admin/administrators", {
            "action": "insertupdate", "id": "",
            "email": "third@example.com", "password": "short", "enabled": 1,
        })
        self.assertMatchesSpec(error, "/api/admin/administrators", method="post")

    def test_admin_home_matches_spec(self):
        self._mixed_students()
        self.assertMatchesSpec(self.client.get("/api/admin/home"), "/api/admin/home")

    def test_phishingtestsize_matches_spec(self):
        self.assertMatchesSpec(
            post_json(self.client, "/api/admin/update/phishingtestsize", {"phishingtestsize": 9}),
            "/api/admin/update/phishingtestsize", method="post",
        )

    def test_upload_matches_spec(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        ok = self.client.post("/api/phishingpictures", {"image": SimpleUploadedFile("s.png", PNG_BYTES)})
        self.assertMatchesSpec(ok, "/api/phishingpictures", method="post")

        bad = self.client.post("/api/phishingpictures", {"image": SimpleUploadedFile("s.txt", PNG_BYTES)})
        self.assertMatchesSpec(bad, "/api/phishingpictures", method="post", status=400)

        student_client = Client()
        create_student()
        login_student(student_client)
        forbidden = student_client.post("/api/phishingpictures", {"image": SimpleUploadedFile("s.png", PNG_BYTES)})
        self.assertMatchesSpec(forbidden, "/api/phishingpictures", method="post", status=403)

    def test_picture_links_match_spec(self):
        question = create_question()
        QuestionLink.objects.create(
            image_id=question.image_id, content="https://x.lt",
            x="0.1", y="0.2", w="0.3", h=None,          # the nullable height
        )
        self.assertMatchesSpec(
            self.client.get(f"/api/phishingpictures/{question.id}/links"),
            "/api/phishingpictures/{questionID}/links",
        )








############################################################
# Public endpoints
############################################################

class ContractPublicTests(ContractTestCase):

    def test_leaderboard_matches_spec(self):
        frozen = create_student(username="FROZEN", is_finished=1)
        TestResult.objects.create(
            student=frozen, question_count=2, answered_question_count=2,
            total_identified_correctly=2, fully_correct_count=2,
            total_options_count=0, total_correct_options_count=0,
            total_points=1.0, finished_at="2026-08-01 10:00:00",
        )
        create_student(username="BLANK")
        self.assertMatchesSpec(self.client.get("/api/leaderboard"), "/api/leaderboard")

    def test_nextslide_404_matches_spec(self):
        from unittest.mock import patch
        with patch.dict(os.environ, {"SLIDES_DIRECTORY": "/definitely/not/there"}):
            response = self.client.get("/api/leaderboard/nextslide")
        self.assertMatchesSpec(response, "/api/leaderboard/nextslide", status=404)
