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
        self.assertEqual(student.last_login, "")
        self.assertRegex(student.registration_time, TIMESTAMP_RE)

    def test_underscore_survives_normalization(self):
        data = post_json(self.client, REGISTER_URL, {"username": "jo_nas"}).json()
        self.assertEqual(data["username"], "JO_NAS")

    def test_returned_code_actually_logs_in(self):
        data = post_json(self.client, REGISTER_URL, {"username": "FRESH"}).json()
        response = login(Client(), data["username"], data["accessCode"])
        self.assertEqual(response.content, b"OK")

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
        student = create_student(registration_time="2026-08-01 09:00:00")
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
            "lastseen": "",
            "registrationtime": "2026-08-01 09:00:00",
            "status": 1,
        }])

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

    def test_finished_students_come_from_the_frozen_row(self):
        # The tampered TestResult (not the answers) must win —
        # that proves the list reads the frozen totals
        student = create_student(is_finished=1)
        Answer.objects.create(student=student, question_id=1, question_text="q1", is_phishing=1, answer_status=1)
        TestResult.objects.create(
            student=student, question_count=4, answered_question_count=3,
            total_identified_correctly=2, fully_correct_count=1,
            total_options_count=5, total_correct_options_count=3,
            total_points=2.0, finished_at="2026-08-01 10:00:00",
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
        image = QuestionImage.objects.create(image=b"bytes", created="")
        Answer.objects.create(student=student, question_id=1, question_text="q1", image=image, is_phishing=1, answer_status=1)
        TestResult.objects.create(
            student=student, question_count=1, answered_question_count=1,
            total_identified_correctly=1, fully_correct_count=1,
            total_options_count=0, total_correct_options_count=0,
            total_points=1.0, finished_at="",
        )

        response = self.client.post(f"{LIST_URL}/{student.id}/delete")
        self.assertEqual(response.json(), {"status": "ok"})
        self.assertFalse(Student.objects.filter(id=student.id).exists())
        self.assertFalse(Answer.objects.exists())
        self.assertFalse(TestResult.objects.exists())
        # The upload-only image table is never touched
        self.assertTrue(QuestionImage.objects.filter(id=image.id).exists())
