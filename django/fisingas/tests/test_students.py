############################################################
#  [*] Regression tests — student accounts
#
#  POST /api/student/register (the public self-registration
#  and its username normalization), the admin students list
#  with its ""-vs-null blank-field contract, the detail
#  endpoint students may call on themselves, and delete.
############################################################


from django.test import Client, TestCase

from fisingas.phishing_test.models import Answer, QuestionImage, TestResult
from fisingas.users.models import Student

from .utils import (
    TIMESTAMP_RE,
    is_recent,
    local,
    create_admin,
    create_student,
    login,
    login_admin,
    login_student,
    post_json,
)


REGISTER_URL = "/api/student/register"
LIST_URL = "/api/admin/students"








############################################################
# POST /api/student/register — public self-registration
############################################################

class StudentRegisterTests(TestCase):

    def test_registers_with_normalized_username(self):
        # Lowercase → uppercase; everything outside A-Z/0-9/_ is stripped
        response = post_json(self.client, REGISTER_URL, {"username": "jonas petras-99!"})
        data = response.json()

        self.assertEqual(data["status"], "OK")
        self.assertEqual(data["username"], "JONASPETRAS99")
        self.assertEqual(len(data["accessCode"]), 8)
        self.assertTrue(data["accessCode"].isdigit())

        student = Student.objects.get(username="JONASPETRAS99")
        self.assertEqual(student.passcode, data["accessCode"])
        self.assertEqual(student.is_finished, 0)
        self.assertEqual(student.status, 1)
        self.assertTrue(is_recent(student.registration_time))

    def test_registration_stamps_lastseen_with_the_registration_time(self):
        # EDGE-03 fix: a brand-new account counts as "seen" at its
        # exact registration moment — the two columns carry the
        # identical timestamp string, so last-seen based views
        # (admin list month filter, dashboard) can see it right away
        post_json(self.client, REGISTER_URL, {"username": "BRANDNEW"})
        student = Student.objects.get(username="BRANDNEW")
        self.assertTrue(is_recent(student.last_login))
        self.assertEqual(student.last_login, student.registration_time)

    def test_underscore_survives_normalization(self):
        data = post_json(self.client, REGISTER_URL, {"username": "jo_nas"}).json()
        self.assertEqual(data["username"], "JO_NAS")

    def test_returned_code_actually_logs_in(self):
        data = post_json(self.client, REGISTER_URL, {"username": "FRESH"}).json()
        response = login(Client(), data["username"], data["accessCode"])
        self.assertEqual(response.content, b"OK")

    def test_register_response_has_exactly_the_expected_keys(self):
        data = post_json(self.client, REGISTER_URL, {"username": "KEYCHECK"}).json()
        self.assertEqual(set(data.keys()), {"status", "username", "accessCode"})

    def test_lithuanian_letters_are_stripped_not_mapped(self):
        # Ą/Ž are outside A-Z and are dropped, not transliterated
        data = post_json(self.client, REGISTER_URL, {"username": "ąžuolas99"}).json()
        self.assertEqual(data["username"], "UOLAS99")

    def test_deleted_username_can_register_again(self):
        create_student(username="CYCLE").delete()
        data = post_json(self.client, REGISTER_URL, {"username": "CYCLE"}).json()
        self.assertEqual(data["status"], "OK")

    def test_duplicate_name_is_refused(self):
        create_student(username="TAKEN")
        response = post_json(self.client, REGISTER_URL, {"username": "taken"})
        self.assertEqual(response.json(), {
            "status": "error",
            "error": "Vartotojas tokiu vardu jau registruotas",
        })
        self.assertEqual(Student.objects.count(), 1)

    def test_name_with_no_valid_characters_is_refused(self):
        response = post_json(self.client, REGISTER_URL, {"username": "ąčęė!!!"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "error", "error": "Įveskite prisijungimo vardą"})
        self.assertEqual(Student.objects.count(), 0)

    def test_invalid_body_is_a_400(self):
        response = self.client.post(REGISTER_URL, data="not json", content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"status": "error", "error": "Neteisinga užklausa"})

    def test_non_string_username_is_a_400(self):
        response = post_json(self.client, REGISTER_URL, {"username": 12345})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"status": "error", "error": "Neteisinga užklausa"})








############################################################
# GET /api/admin/students — the admin table
############################################################

class StudentsListTests(TestCase):

    def setUp(self):
        create_admin()
        login_admin(self.client)

    def test_requires_login(self):
        self.assertEqual(Client().get(LIST_URL).status_code, 401)

    def test_students_are_refused(self):
        create_student()
        student_client = Client()
        login_student(student_client)
        self.assertEqual(student_client.get(LIST_URL).content, b"Error: Not Admin")

    def test_blank_field_contract_for_students_without_a_test(self):
        # Never-dealt students: "" for the grade columns, but
        # null for answeredquestioncount — the frontend relies
        # on exactly this mix
        student = create_student(registration_time=local("2026-08-01 09:00:00"))
        self.assertEqual(self.client.get(LIST_URL).json(), [{
            "id": student.id,
            "username": student.username,
            "passcode": student.passcode,
            "questioncount": "",
            "answeredquestioncount": None,
            "totalidentifiedcorrectly": "",
            "fullycorrectcount": "",
            "fullycorrectpercentage": "",
            "totaloptionscount": "",
            "totalcorrectoptionscount": "",
            "testgrade": "",
            "isfinished": 0,
            "lastseen": None,
            "registrationtime": "2026-08-01T09:00:00+03:00",
            "status": 1,
        }])

    def test_timestamps_are_iso_8601_in_vilnius_time(self):
        # The wire format: ISO-8601 with the explicit local offset —
        # DST-proof, and parsed identically by every browser's Date
        # whatever the viewer's own timezone. Winter is EET (+02:00),
        # summer EEST (+03:00); a never-set value is null
        create_student(registration_time=local("2026-01-15 10:00:00"), last_login=local("2026-08-15 10:00:00"))

        [row] = self.client.get(LIST_URL).json()
        self.assertEqual(row["registrationtime"], "2026-01-15T10:00:00+02:00")
        self.assertEqual(row["lastseen"], "2026-08-15T10:00:00+03:00")
        self.assertRegex(row["lastseen"], TIMESTAMP_RE)

    def test_rows_are_newest_first(self):
        create_student(username="OLDER")
        create_student(username="NEWER")
        usernames = [row["username"] for row in self.client.get(LIST_URL).json()]
        self.assertEqual(usernames, ["NEWER", "OLDER"])

    def test_unfinished_students_are_graded_live(self):
        student = create_student()
        Answer.objects.create(student=student, question_id=1, question_text="q1", is_phishing=1, answer_status=1)
        Answer.objects.create(student=student, question_id=2, question_text="q2", is_phishing=0, answer_status=None)

        [row] = self.client.get(LIST_URL).json()
        self.assertEqual(row["questioncount"], 2)
        self.assertEqual(row["answeredquestioncount"], 1)
        self.assertEqual(row["totalidentifiedcorrectly"], 1)
        self.assertEqual(row["fullycorrectcount"], 1)
        self.assertEqual(row["fullycorrectpercentage"], 50)
        self.assertEqual(row["testgrade"], "5.00")

    def test_list_mixes_frozen_live_and_blank_rows(self):
        # One response, all three grading modes side by side
        frozen = create_student(username="FROZEN", is_finished=1)
        TestResult.objects.create(
            student=frozen, question_count=2, answered_question_count=2,
            total_identified_correctly=2, fully_correct_count=2,
            total_options_count=0, total_correct_options_count=0,
            total_points=1.0, finished_at=local("2026-08-01 10:00:00"),
        )
        live = create_student(username="LIVE")
        Answer.objects.create(student=live, question_id=1, question_text="", is_phishing=1, answer_status=1)
        create_student(username="BLANK")

        rows = {row["username"]: row for row in self.client.get(LIST_URL).json()}
        self.assertEqual(rows["FROZEN"]["testgrade"], "5.00")
        self.assertEqual(rows["LIVE"]["testgrade"], "10.00")
        self.assertEqual(rows["BLANK"]["testgrade"], "")

    def test_reopened_student_is_graded_live_not_from_the_stale_row(self):
        # is_finished cleared (a retake) but the old TestResult
        # left behind: the list must agree with the detail page
        # and grade the live answers, not republish the old row
        student = create_student()
        Answer.objects.create(student=student, question_id=1, question_text="q1", is_phishing=1, answer_status=1)
        TestResult.objects.create(
            student=student, question_count=4, answered_question_count=3,
            total_identified_correctly=2, fully_correct_count=1,
            total_options_count=5, total_correct_options_count=3,
            total_points=2.0, finished_at=local("2026-08-01 10:00:00"),
        )

        [row] = self.client.get(LIST_URL).json()
        detail = self.client.get(f"{LIST_URL}/{student.id}").json()
        self.assertEqual(row["testgrade"], "10.00")
        self.assertEqual(row["testgrade"], detail["testgrade"])

    def test_finished_students_come_from_the_frozen_row(self):
        # The tampered TestResult (not the answers) must win —
        # that proves the list reads the frozen totals
        student = create_student(is_finished=1)
        Answer.objects.create(student=student, question_id=1, question_text="q1", is_phishing=1, answer_status=1)
        TestResult.objects.create(
            student=student, question_count=4, answered_question_count=3,
            total_identified_correctly=2, fully_correct_count=1,
            total_options_count=5, total_correct_options_count=3,
            total_points=2.0, finished_at=local("2026-08-01 10:00:00"),
        )

        [row] = self.client.get(LIST_URL).json()
        self.assertEqual(row["questioncount"], 4)
        self.assertEqual(row["answeredquestioncount"], 3)
        self.assertEqual(row["fullycorrectpercentage"], 25)
        self.assertEqual(row["testgrade"], "5.00")
        self.assertEqual(row["isfinished"], 1)








############################################################
# GET /api/admin/students/<id> — one student's row
############################################################

class StudentDetailTests(TestCase):

    def test_admin_reads_any_student(self):
        create_admin()
        student = create_student()
        login_admin(self.client)
        response = self.client.get(f"{LIST_URL}/{student.id}")
        self.assertEqual(response.json()["username"], student.username)

    def test_unknown_student_is_a_404(self):
        create_admin()
        login_admin(self.client)
        response = self.client.get(f"{LIST_URL}/424242")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.content, b"Error: Student not found")

    def test_student_reads_their_own_row(self):
        student = create_student()
        login_student(self.client)
        response = self.client.get(f"{LIST_URL}/{student.id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["passcode"], student.passcode)

    def test_detail_prefers_the_frozen_row_for_finished_students(self):
        # The tampered frozen totals must win over the answers on
        # the detail endpoint too
        create_admin()
        student = create_student(is_finished=1)
        Answer.objects.create(student=student, question_id=1, question_text="", is_phishing=1, answer_status=1)
        TestResult.objects.create(
            student=student, question_count=4, answered_question_count=4,
            total_identified_correctly=4, fully_correct_count=4,
            total_options_count=0, total_correct_options_count=0,
            total_points=2.0, finished_at=local("2026-08-01 10:00:00"),
        )
        login_admin(self.client)

        row = self.client.get(f"{LIST_URL}/{student.id}").json()
        self.assertEqual(row["questioncount"], 4)
        self.assertEqual(row["testgrade"], "5.00")

    def test_student_cannot_read_someone_else(self):
        create_student()
        other = create_student(username="OTHER")
        login_student(self.client)
        response = self.client.get(f"{LIST_URL}/{other.id}")
        self.assertEqual(response.content, b"Error: Not Admin")

    def test_finished_student_without_frozen_row_is_judged_live(self):
        # Legacy safety net: finished before the TestResult
        # backfill → the grade still comes from the snapshots
        create_admin()
        student = create_student(is_finished=1)
        Answer.objects.create(student=student, question_id=1, question_text="q1", is_phishing=1, answer_status=1)
        login_admin(self.client)

        row = self.client.get(f"{LIST_URL}/{student.id}").json()
        self.assertEqual(row["questioncount"], 1)
        self.assertEqual(row["testgrade"], "10.00")








############################################################
# POST /api/admin/students/<id>/delete
############################################################

class StudentDeleteTests(TestCase):

    def setUp(self):
        create_admin()
        login_admin(self.client)

    def test_requires_admin(self):
        student = create_student()
        student_client = Client()
        login_student(student_client)
        response = student_client.post(f"{LIST_URL}/{student.id}/delete")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.content, b"Error: Not Admin")

    def test_get_method_is_refused(self):
        student = create_student()
        self.assertEqual(self.client.get(f"{LIST_URL}/{student.id}/delete").status_code, 405)

    def test_unknown_student_is_a_404(self):
        response = self.client.post(f"{LIST_URL}/424242/delete")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.content, b"Error: Student not found")

    def test_delete_cascades_the_test_but_keeps_the_images(self):
        student = create_student()
        image = QuestionImage.objects.create(image=b"bytes", created=None)
        Answer.objects.create(student=student, question_id=1, question_text="q1", image=image, is_phishing=1, answer_status=1)
        TestResult.objects.create(
            student=student, question_count=1, answered_question_count=1,
            total_identified_correctly=1, fully_correct_count=1,
            total_options_count=0, total_correct_options_count=0,
            total_points=1.0, finished_at=None,
        )

        response = self.client.post(f"{LIST_URL}/{student.id}/delete")
        self.assertEqual(response.json(), {"status": "ok"})
        self.assertFalse(Student.objects.filter(id=student.id).exists())
        self.assertFalse(Answer.objects.exists())
        self.assertFalse(TestResult.objects.exists())
        # The upload-only image table is never touched
        self.assertTrue(QuestionImage.objects.filter(id=image.id).exists())







############################################################
# Registration limits
############################################################

class RegisterLimitsTests(TestCase):

    def test_overlong_username_is_refused(self):
        # The column holds 255 characters — longer names get the
        # display-ready message, not a database error
        response = post_json(self.client, "/api/student/register", {"username": "A" * 300})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "error")
        self.assertEqual(response.json()["error"], "Prisijungimo vardas per ilgas (daugiausia 255 simboliai)")
        self.assertFalse(Student.objects.exists())

    def test_255_characters_still_register(self):
        response = post_json(self.client, "/api/student/register", {"username": "A" * 255})
        self.assertEqual(response.json()["status"], "OK")








############################################################
# A finished student without a frozen row
############################################################

class FinishedWithoutFrozenRowTests(TestCase):

    def setUp(self):
        # is_finished=1 with answers but no TestResult — only a hand
        # edit can produce this; the lists must still agree with the
        # detail page instead of showing the never-took-the-test blanks
        create_admin()
        self.student = create_student(is_finished=1)
        Answer.objects.create(student=self.student, question_id=1, question_text="", is_phishing=1, answer_status=1)
        login_admin(self.client)

    def test_list_and_detail_agree_on_the_grade(self):
        [list_row] = self.client.get(LIST_URL).json()
        detail_row = self.client.get(f"{LIST_URL}/{self.student.id}").json()
        self.assertEqual(list_row["testgrade"], "10.00")
        self.assertEqual(list_row["testgrade"], detail_row["testgrade"])
        self.assertEqual(list_row["questioncount"], 1)

    def test_leaderboard_agrees_too(self):
        [row] = Client().get("/api/leaderboard").json()
        self.assertEqual(row["testgrade"], "10.00")
