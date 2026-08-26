############################################################
#  [*] Known bugs — pinned as EXPECTED FAILURES
#
#  Every test here asserts the CORRECT behaviour and is
#  decorated with @expectedFailure, because the code does
#  not deliver it yet. The suite therefore stays green
#  while each defect stays documented and executable.
#
#  When one of these bugs gets fixed, its test flips to
#  "unexpected success" and FAILS the suite — the fix is
#  then completed by moving the test (minus the decorator)
#  into the proper topic file.
#
#  One numbered class per bug (KB-01 ...), each banner
#  stating: WHERE the defect lives, the TRIGGER, the IMPACT
#  and a SUGGESTED FIX.
############################################################


from unittest import expectedFailure

from django.db import connection
from django.test import TestCase

from fisingas.phishing_test.grading import OptionResult, QuestionResult
from fisingas.phishing_test.models import Answer

from .utils import (
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    add_option,
    create_admin,
    create_question,
    create_student,
    login_admin,
    login_student,
    post_json,
)








############################################################
# KB-01 — /api/login crashes on non-object JSON bodies
############################################################
#
# WHERE:   users/api/auth_views.py, login_view
# TRIGGER: any syntactically valid JSON body that is not an
#          object — [1,2], "text", 123 — makes
#          postData.get(...) raise AttributeError.
# IMPACT:  HTTP 500 from the PUBLIC login endpoint instead
#          of the usual validation message.
# FIX:     treat non-dict bodies like an empty body
#          (isinstance(postData, dict) check in login_view
#          or in get_json).
############################################################

class KB01LoginNonObjectBody(TestCase):

    @expectedFailure
    def test_json_array_body_gets_the_validation_message(self):
        response = self.client.post("/api/login", data="[1, 2]", content_type="application/json")
        self.assertLess(response.status_code, 500)








############################################################
# KB-02 — /api/login crashes on a non-string username
############################################################
#
# WHERE:   users/api/auth_views.py, login_view (unknown-user
#          branch)
# TRIGGER: {"username": 123, "password": "x"} — the user is
#          not found, and `"@" in postData["username"]`
#          raises TypeError on the int.
# IMPACT:  HTTP 500 from the PUBLIC login endpoint.
# FIX:     validate both credentials are strings before use.
############################################################

class KB02LoginNonStringUsername(TestCase):

    @expectedFailure
    def test_numeric_username_gets_an_error_message(self):
        response = post_json(self.client, "/api/login", {"username": 123, "password": "x"})
        self.assertLess(response.status_code, 500)








############################################################
# KB-03 — /api/login crashes on a non-string password
############################################################
#
# WHERE:   users/api/auth_views.py, login_view (existing
#          admin branch)
# TRIGGER: a real admin email with {"password": 123} —
#          postData["password"].encode() raises
#          AttributeError before bcrypt ever runs.
# IMPACT:  HTTP 500 from the PUBLIC login endpoint; only
#          fires for names that exist, which also leaks
#          account existence (500 vs error message).
# FIX:     same string validation as KB-02.
############################################################

class KB03LoginNonStringPassword(TestCase):

    @expectedFailure
    def test_numeric_password_gets_an_error_message(self):
        create_admin()
        response = post_json(self.client, "/api/login", {"username": ADMIN_EMAIL, "password": 123})
        self.assertLess(response.status_code, 500)








############################################################
# KB-04 — registration accepts usernames longer than the
#         database column
############################################################
#
# WHERE:   users/api/students_views.py, student_register
# TRIGGER: a username that normalizes to more than 255
#          characters (Student.username max_length=255).
# IMPACT:  on PostgreSQL (production) the INSERT dies with
#          DataError -> HTTP 500 on the PUBLIC registration
#          endpoint; on SQLite it is silently stored
#          over-length. Django CharFields do not enforce
#          max_length outside full_clean().
# FIX:     refuse normalized usernames longer than 255 with
#          the usual {"status": "error"} response.
############################################################

class KB04RegisterOverlongUsername(TestCase):

    @expectedFailure
    def test_overlong_username_is_refused(self):
        response = post_json(self.client, "/api/student/register", {"username": "A" * 300})
        self.assertEqual(response.json()["status"], "error")








############################################################
# KB-05 — saving the test crashes on non-numeric values
############################################################
#
# WHERE:   phishing_test/api/student_views.py,
#          student_questions POST
# TRIGGER: a shape-valid payload whose VALUES are garbage:
#          {"selectedanswer": "phishing"} or
#          {"isselected": "x"} — the IntegerField coercion
#          int("phishing") raises inside .update().
# IMPACT:  HTTP 500 from a student-reachable endpoint; the
#          EDGE-02 fix validated the payload's shape, values
#          were left to the fail-loudly convention.
# FIX:     accept only 0/1/None (or at least ints) for
#          selectedanswer / isselected, refusing the rest
#          with the usual error string.
############################################################

class KB05SaveNonNumericValues(TestCase):

    def setUp(self):
        self.student = create_student()
        self.question = create_question(is_phishing=1)
        self.option = add_option(self.question, answer_status=1)
        login_student(self.client)
        self.client.get("/api/student/questions")   # deal

    @expectedFailure
    def test_garbage_verdict_value_is_refused_not_a_crash(self):
        response = post_json(self.client, "/api/student/questions", [{
            "questionid": self.question.id, "selectedanswer": "phishing",
        }])
        self.assertLess(response.status_code, 500)

    @expectedFailure
    def test_garbage_checkbox_value_is_refused_not_a_crash(self):
        response = post_json(self.client, "/api/student/questions", [{
            "questionid": self.question.id,
            "questionoptions": [{"answeroptionid": self.option.id, "isselected": "x"}],
        }])
        self.assertLess(response.status_code, 500)








############################################################
# KB-06 — null link coordinates poison the links endpoint
############################################################
#
# WHERE:   phishing_test/api/pictures_views.py,
#          picture_links POST (str() of null) + _percent
# TRIGGER: POST /links with an area whose x/y/width/height
#          is null — str(None) stores the STRING "None";
#          every subsequent GET then dies in
#          float("None") -> ValueError.
# IMPACT:  one malformed admin POST permanently breaks the
#          links GET for that image with HTTP 500 —
#          including for students taking the test. A legacy
#          row with x="" (the model default) breaks the
#          same way.
# FIX:     refuse null/non-numeric coordinates on POST (or
#          make _percent tolerant of unparseable values).
############################################################

class KB06NullLinkCoordinates(TestCase):

    @expectedFailure
    def test_links_get_survives_a_null_coordinate_area(self):
        create_admin()
        login_admin(self.client)
        question = create_question()

        post_json(self.client, f"/api/phishingpictures/{question.id}/links", {"areas": [
            {"url": "https://x.example", "x": None, "y": 0.5, "width": None, "height": None},
        ]})

        response = self.client.get(f"/api/phishingpictures/{question.id}/links")
        self.assertEqual(response.status_code, 200)








############################################################
# KB-07 — a question's points can go negative
############################################################
#
# WHERE:   phishing_test/grading.py, QuestionResult.points
# TRIGGER: a right verdict on a question with more than 10
#          options, most of them wrong:
#          1 - 0.1*options + 0.1*correct < 0.
# IMPACT:  negative per-question points ("-0.20" rendered
#          verbatim in the answers view) that also drag the
#          whole test grade down below the intended floor.
#          The API caps option count nowhere.
# FIX:     decide the semantics — most likely
#          points = max(0.0, ...) — and/or cap options per
#          question. (Deliberately left as a product call.)
############################################################

class KB07NegativePoints(TestCase):

    @expectedFailure
    def test_points_never_go_below_zero(self):
        result = QuestionResult(
            question_id=1, question_text="", answer=1, is_phishing=1,
            options=[OptionResult("", right_answer=1, selected=0) for _ in range(12)],
        )
        self.assertGreaterEqual(result.points, 0.0)








############################################################
# KB-08 — finished student without a frozen row: blank in
#         the lists, graded in the detail view
############################################################
#
# WHERE:   users/api/students_views.py students_list (and
#          leaderboard/api/views.py leaderboard — same
#          overlay expression)
# TRIGGER: is_finished=1 with answer snapshots but no
#          TestResult row (finished pre-backfill, or a
#          finalize that never landed). The lists overlay
#          frozen rows onto judge_unfinished_students(),
#          which EXCLUDES finished students — so the row
#          renders the never-took-the-test blanks, while
#          student_detail falls back to live judging and
#          shows the real grade.
# IMPACT:  the same student shows "" in the admin table and
#          the leaderboard but "10.00" on their detail page.
# FIX:     give the lists the same fallback student_summary
#          has (live-judge finished students missing a row).
############################################################

class KB08FinishedWithoutFrozenRow(TestCase):

    @expectedFailure
    def test_list_and_detail_agree_on_the_grade(self):
        create_admin()
        student = create_student(is_finished=1)
        Answer.objects.create(student=student, question_id=1, question_text="", is_phishing=1, answer_status=1)
        login_admin(self.client)

        [list_row] = self.client.get("/api/admin/students").json()
        detail_row = self.client.get(f"/api/admin/students/{student.id}").json()
        self.assertEqual(list_row["testgrade"], detail_row["testgrade"])








############################################################
# KB-09 — X_FRAME_OPTIONS is configured but never sent
############################################################
#
# WHERE:   fisingas/settings.py declares
#          X_FRAME_OPTIONS = "DENY", but MIDDLEWARE lacks
#          django.middleware.clickjacking.
#          XFrameOptionsMiddleware — the setting is inert.
# IMPACT:  API responses carry no X-Frame-Options header;
#          only Caddy's CSP (frame-ancestors 'self', a
#          DIFFERENT policy than DENY) stands between API
#          responses and framing.
# FIX:     add the middleware, or drop the misleading
#          setting and rely on the CSP explicitly.
############################################################

class KB09XFrameOptionsInert(TestCase):

    @expectedFailure
    def test_api_responses_carry_the_configured_header(self):
        response = self.client.get("/api/leaderboard")
        self.assertIn("X-Frame-Options", response)








############################################################
# KB-10 — an admin created without "@" can never log in
############################################################
#
# WHERE:   users/api/administrators_views.py insertupdate
#          (no email format check) + auth_views.login_view
#          (the "@" in the login name is the role
#          discriminator).
# TRIGGER: create/edit an administrator whose email has no
#          "@". load_user finds the account, but login_view
#          routes it into the STUDENT branch and compares
#          the plaintext input against the bcrypt HASH —
#          which can never match.
# IMPACT:  a silently unusable admin account; combined with
#          the load_user collision rule it can also block a
#          same-named student from logging in.
# FIX:     insertupdate must refuse emails without "@".
############################################################

class KB10AdminEmailWithoutAtSign(TestCase):

    @expectedFailure
    def test_creating_an_admin_without_at_sign_is_refused(self):
        create_admin()
        login_admin(self.client)
        response = post_json(self.client, "/api/admin/administrators", {
            "action": "insertupdate", "id": "",
            "email": "not-an-email", "password": "long-enough-password", "enabled": 1,
        })
        self.assertEqual(response.json()["type"], "error")








############################################################
# KB-11 — the test-size update crashes on a JSON infinity
############################################################
#
# WHERE:   phishing_test/api/admin_views.py,
#          update_phishingtestsize
# TRIGGER: {"phishingtestsize": 1e999} — Python's json parses
#          an out-of-range literal as inf, and int(inf)
#          raises OverflowError, which the except tuple
#          (TypeError, KeyError, ValueError) does not cover.
# IMPACT:  HTTP 500 instead of the endpoint's own 400.
# FIX:     add OverflowError to the tuple.
############################################################

class KB11TestSizeInfinity(TestCase):

    @expectedFailure
    def test_infinite_test_size_is_a_400(self):
        create_admin()
        login_admin(self.client)
        response = post_json(self.client, "/api/admin/update/phishingtestsize", {"phishingtestsize": float("inf")})
        self.assertEqual(response.status_code, 400)








############################################################
# KB-12 — two views return None for unhandled HTTP verbs
############################################################
#
# WHERE:   users/api/administrators_views.py administrators
#          and phishing_test/api/pictures_views.py
#          picture_links — both dispatch `if GET / elif
#          POST` with no final return.
# TRIGGER: any other verb (PUT, DELETE, PATCH) with a valid
#          session — the view falls off the end and returns
#          None, which Django reports as "didn't return an
#          HttpResponse object".
# IMPACT:  HTTP 500 instead of 405 (student_delete and
#          logout already answer 405 correctly).
# FIX:     `return HttpResponse(status=405)` at the end of
#          both views.
############################################################

class KB12UnhandledVerbsAre500(TestCase):

    def setUp(self):
        create_admin()
        login_admin(self.client)

    @expectedFailure
    def test_put_on_administrators_is_a_405(self):
        self.assertEqual(self.client.put("/api/admin/administrators").status_code, 405)

    @expectedFailure
    def test_delete_on_picture_links_is_a_405(self):
        question = create_question()
        self.assertEqual(self.client.delete(f"/api/phishingpictures/{question.id}/links").status_code, 405)








############################################################
# KB-13 — the links POST trusts the shape of every area
############################################################
#
# WHERE:   phishing_test/api/pictures_views.py picture_links,
#          POST branch (and _percent on the GET side)
# TRIGGER: a body that is not an object (`"areas" in 5` is
#          a TypeError), an area that is not an object
#          (indexing an int), an area missing url/x/y/
#          width/height (KeyError), or an area whose
#          coordinate is a non-numeric string — stored
#          verbatim, so every later GET dies in float().
# IMPACT:  HTTP 500s from an admin endpoint, and for the
#          string coordinate the same permanent poisoning as
#          KB-06 (that pin covers the null case).
# FIX:     validate the whole body before the delete+insert:
#          object with an `areas` list of objects carrying
#          the five keys with numeric coordinates → 400
#          otherwise; and make _percent return None instead
#          of raising for a value it cannot parse.
############################################################

class KB13LinksPostUncheckedShape(TestCase):

    def setUp(self):
        create_admin()
        login_admin(self.client)
        self.question = create_question()
        self.url = f"/api/phishingpictures/{self.question.id}/links"

    def _good_area(self, **overrides):
        return {"url": "https://x.example", "x": 0.1, "y": 0.2, "width": 0.3, "height": 0.4, **overrides}

    @expectedFailure
    def test_non_object_body_is_a_400(self):
        self.assertEqual(post_json(self.client, self.url, 5).status_code, 400)

    @expectedFailure
    def test_non_object_area_is_a_400(self):
        self.assertEqual(post_json(self.client, self.url, {"areas": [5]}).status_code, 400)

    @expectedFailure
    def test_area_missing_keys_is_a_400(self):
        self.assertEqual(post_json(self.client, self.url, {"areas": [{"url": "https://x.example"}]}).status_code, 400)

    @expectedFailure
    def test_string_coordinate_does_not_poison_the_links_get(self):
        post_json(self.client, self.url, {"areas": [self._good_area(x="abc")]})
        self.assertEqual(self.client.get(self.url).status_code, 200)








############################################################
# KB-14 — administrator insertupdate indexes every field
#         unchecked
############################################################
#
# WHERE:   users/api/administrators_views.py administrators,
#          POST insertupdate
# TRIGGER: {"action": "insertupdate"} alone (KeyError on
#          id); an id that is not a number (ValueError in
#          the ORM filter); a password that is not a string
#          (TypeError in len()).
# IMPACT:  HTTP 500 from the admin console endpoint instead
#          of the {"type": "error"} answer its other
#          validations give. The swagger header currently
#          documents this as "fails loudly with a 500" —
#          update that clause together with the fix.
# FIX:     type-check id/email/password/enabled up front and
#          answer 400 {"type": "error", "reason": ...}.
############################################################

class KB14AdministratorsUncheckedFields(TestCase):

    def setUp(self):
        create_admin()
        login_admin(self.client)

    def _post(self, payload):
        return post_json(self.client, "/api/admin/administrators", {"action": "insertupdate", **payload})

    @expectedFailure
    def test_missing_fields_are_a_400(self):
        response = self._post({})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["type"], "error")

    @expectedFailure
    def test_non_numeric_id_is_a_400(self):
        response = self._post({"id": "abc", "email": "kitas@example.com", "password": "", "enabled": 1})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["type"], "error")

    @expectedFailure
    def test_non_string_password_is_a_400(self):
        response = self._post({"id": "", "email": "kitas@example.com", "password": 12345678, "enabled": 1})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["type"], "error")








############################################################
# KB-15 — question actions crash on a body without their keys
############################################################
#
# WHERE:   phishing_test/api/admin_views.py questions_update
# TRIGGER: a valid JSON object missing the key the action
#          reads — {} to createnewoption or deletequestion
#          raises KeyError on postData["questionid"].
# IMPACT:  HTTP 500 instead of the view's own
#          "Error: Invalid request body" 400. As with KB-14,
#          the swagger header documents the 500 today.
# FIX:     resolve the required keys up front (a missing or
#          non-integer id → 400) before dispatching on the
#          action.
############################################################

class KB15QuestionActionsMissingKeys(TestCase):

    def setUp(self):
        create_admin()
        login_admin(self.client)

    @expectedFailure
    def test_createnewoption_without_a_question_id_is_a_400(self):
        self.assertEqual(post_json(self.client, "/api/admin/questions/createnewoption", {}).status_code, 400)

    @expectedFailure
    def test_deletequestion_without_a_question_id_is_a_400(self):
        self.assertEqual(post_json(self.client, "/api/admin/questions/deletequestion", {}).status_code, 400)









############################################################
# KB-16 — Answer.question_id has no index of its own
############################################################
#
# WHERE:   phishing_test/models.py Answer.question_id (plain
#          IntegerField); the only index covering it is the
#          composite unique (student, question_id), whose
#          leading column is student.
# TRIGGER: the deleted-question image fallback in
#          pictures_views._resolve_image filters Answer by
#          question_id alone — a full scan of every answer
#          row ever written, on every picture/links request
#          for a deleted question.
# IMPACT:  performance only (INFO); grows with the table.
# FIX:     db_index=True on Answer.question_id (or a
#          models.Index) + a migration.
############################################################

class KB16AnswerQuestionIdUnindexed(TestCase):

    @expectedFailure
    def test_answer_question_id_is_indexed(self):
        with connection.cursor() as cursor:
            constraints = connection.introspection.get_constraints(cursor, Answer._meta.db_table)
        self.assertTrue(any(
            c["columns"] and c["columns"][0] == "question_id" and (c["index"] or c["unique"])
            for c in constraints.values()
        ), sorted(tuple(c["columns"]) for c in constraints.values()))
