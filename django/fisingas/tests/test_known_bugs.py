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
