############################################################
#  [*] Regression tests — admin dashboard + question bank
#
#  GET  /api/admin/home                    — counters + live progress
#  GET  /api/admin/students/<id>/answers   — the graded test
#  GET  /api/admin/questions               — the question bank
#  POST /api/admin/questions/<action>      — bank editing
#  POST /api/admin/update/phishingtestsize — the size setting
############################################################


from datetime import datetime

from django.test import Client, TestCase

from fisingas.phishing_test.models import Answer, AnswerSelectedOption, Question, QuestionImage, QuestionOption
from fisingas.users.models import Setting

from .utils import (
    add_option,
    create_admin,
    create_question,
    create_student,
    login_admin,
    login_student,
    post_json,
)


HOME_URL = "/api/admin/home"
QUESTIONS_URL = "/api/admin/questions"
TESTSIZE_URL = "/api/admin/update/phishingtestsize"


def _now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")








############################################################
# GET /api/admin/home — the dashboard
############################################################

class AdminHomeTests(TestCase):

    def setUp(self):
        create_admin()
        login_admin(self.client)

    def test_requires_login(self):
        self.assertEqual(Client().get(HOME_URL).status_code, 401)

    def test_students_are_refused(self):
        create_student()
        student_client = Client()
        login_student(student_client)
        self.assertEqual(student_client.get(HOME_URL).content, b"Error: Not Admin")

    def test_counters_with_no_size_setting(self):
        create_question(is_enabled=1)
        create_question(is_enabled=0)
        create_student()

        self.assertEqual(self.client.get(HOME_URL).json(), {
            "studentscount": 1,
            "enabledquestionscount": 1,
            "totalquestionscount": 2,
            "phishingtestsize": None,
            "studentsprogress": [],
        })

    def test_size_setting_is_reported(self):
        Setting.objects.create(name="PhishingTestSize", value="17")
        self.assertEqual(self.client.get(HOME_URL).json()["phishingtestsize"], 17)

    def test_finished_students_still_show_in_progress(self):
        # Recently active + dealt questions is all that counts —
        # finished students stay visible with their flag up
        finished = create_student(username="DONE", last_login=_now(), is_finished=1)
        Answer.objects.create(student=finished, question_id=1, question_text="", is_phishing=1, answer_status=1)

        [progress] = self.client.get(HOME_URL).json()["studentsprogress"]
        self.assertEqual(progress["username"], "DONE")
        self.assertEqual(progress["isfinished"], 1)

    def test_progress_lists_recent_students_with_dealt_questions(self):
        now = _now()
        active = create_student(username="ACTIVE", last_login=now)
        stale = create_student(username="STALE", last_login="2020-01-01 00:00:00")
        create_student(username="FRESH", last_login=now)      # recent, but nothing dealt

        Answer.objects.create(student=active, question_id=1, question_text="", is_phishing=1, answer_status=1)
        Answer.objects.create(student=active, question_id=2, question_text="", is_phishing=0, answer_status=None)
        Answer.objects.create(student=stale, question_id=1, question_text="", is_phishing=1, answer_status=1)

        self.assertEqual(self.client.get(HOME_URL).json()["studentsprogress"], [{
            "studentid": active.id,
            "username": "ACTIVE",
            "questioncount": 2,
            "answeredquestioncount": 1,
            "isfinished": 0,
            "lastlogin": now,
        }])








############################################################
# GET /api/admin/students/<id>/answers — the graded test
############################################################

class StudentAnswersTests(TestCase):

    def _freeze_graded_question(self, student):
        Answer.objects.create(
            student=student, question_id=5, question_text="Ar fišingas?",
            is_phishing=1, answer_status=1,
        )
        for option_id, text, right_answer, is_selected in [
            (11, "teisingas", 1, 1),
            (12, "klaidingas", 0, 1),
            (13, "nenustatytas", None, None),
        ]:
            AnswerSelectedOption.objects.create(
                student=student, question_id=5, option_id=option_id,
                option_text=text, right_answer=right_answer, is_selected=is_selected,
            )

    def test_admin_sees_the_graded_questions(self):
        create_admin()
        student = create_student()
        self._freeze_graded_question(student)
        login_admin(self.client)

        self.assertEqual(self.client.get(f"/api/admin/students/{student.id}/answers").json(), [{
            "id": 5,
            "questiontext": "Ar fišingas?",
            "isphishinganswer": 1,
            "isphishing": 1,
            "totaloptionscount": 3,
            "correctoptionscount": 1,
            "answerpoints": "0.80",
            "answeredoptions": [
                {"optiontext": "teisingas", "rightansweroption": 1, "selectedansweroption": 1},
                {"optiontext": "klaidingas", "rightansweroption": 0, "selectedansweroption": 1},
                {"optiontext": "nenustatytas", "rightansweroption": None, "selectedansweroption": 0},
            ],
        }])

    def test_student_reads_their_own_answers(self):
        student = create_student()
        self._freeze_graded_question(student)
        login_student(self.client)
        response = self.client.get(f"/api/admin/students/{student.id}/answers")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)

    def test_unknown_student_yields_an_empty_list(self):
        # No 404 here — a student with nothing dealt and a student
        # that does not exist both render as an empty test
        create_admin()
        login_admin(self.client)
        response = self.client.get("/api/admin/students/424242/answers")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    def test_student_cannot_read_someone_else(self):
        create_student()
        other = create_student(username="OTHER")
        login_student(self.client)
        response = self.client.get(f"/api/admin/students/{other.id}/answers")
        self.assertEqual(response.content, b"Error: Not Admin")

    def test_requires_login(self):
        self.assertEqual(self.client.get("/api/admin/students/1/answers").status_code, 401)








############################################################
# GET /api/admin/questions — the bank with its counters
############################################################

class QuestionsListTests(TestCase):

    def setUp(self):
        create_admin()
        login_admin(self.client)

    def test_students_are_refused(self):
        create_student()
        student_client = Client()
        login_student(student_client)
        self.assertEqual(student_client.get(QUESTIONS_URL).content, b"Error: Not Admin")

    def test_empty_bank_reports_null_counters(self):
        # Nulls, not zeros — the frontend expects exactly this
        self.assertEqual(self.client.get(QUESTIONS_URL).json(), {
            "questioncount": 0,
            "phishingcount": None,
            "goodcount": None,
            "enabledcount": None,
            "optionscount": None,
            "phishingtestsize": None,
            "questions": [],
        })

    def test_bank_counters_and_shape(self):
        Setting.objects.create(name="PhishingTestSize", value="5")
        phishing = create_question(is_phishing=1, is_enabled=1, question="Pirmas", created="2026-08-01 10:00:00")
        first_option = add_option(phishing, option_text="a", answer_status=1)
        second_option = add_option(phishing, option_text="b", answer_status=None)
        genuine = create_question(is_phishing=0, is_enabled=0, question="Antras")
        add_option(genuine, option_text="c", answer_status=0)

        data = self.client.get(QUESTIONS_URL).json()
        self.assertEqual(data["questioncount"], 2)
        self.assertEqual(data["phishingcount"], 1)
        self.assertEqual(data["goodcount"], 1)
        self.assertEqual(data["enabledcount"], 1)
        self.assertEqual(data["optionscount"], 3)
        self.assertEqual(data["phishingtestsize"], 5)

        # Newest first, options in creation order, never-set
        # answers serialized as null
        self.assertEqual([question["questiontext"] for question in data["questions"]], ["Antras", "Pirmas"])
        self.assertEqual(data["questions"][1], {
            "questionid": phishing.id,
            "isenabled": 1,
            "isphishing": 1,
            "questiontext": "Pirmas",
            "questionoptions": [
                {"optionid": first_option.id, "optiontext": "a", "rightoptionanswer": 1},
                {"optionid": second_option.id, "optiontext": "b", "rightoptionanswer": None},
            ],
            "created": "2026-08-01 10:00:00",
        })








############################################################
# POST /api/admin/questions/<action> — editing the bank
############################################################

class QuestionsUpdateTests(TestCase):

    def setUp(self):
        create_admin()
        login_admin(self.client)
        self.question = create_question(is_phishing=0, question="Prieš")
        self.option = add_option(self.question, option_text="sena", answer_status=None)

    def test_students_are_refused(self):
        create_student()
        student_client = Client()
        login_student(student_client)
        response = post_json(student_client, f"{QUESTIONS_URL}/deletequestion", {"questionid": self.question.id})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.content, b"Error: Not Admin")

    def test_invalid_body_is_a_400(self):
        response = self.client.post(f"{QUESTIONS_URL}/updatequestion", data="not json", content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.content, b"Error: Invalid request body")

    def test_unknown_action_is_a_404(self):
        response = post_json(self.client, f"{QUESTIONS_URL}/nonsense", {"questionid": self.question.id})
        self.assertEqual(response.status_code, 404)

    def test_createnewoption_returns_the_new_id(self):
        response = post_json(self.client, f"{QUESTIONS_URL}/createnewoption", {"questionid": self.question.id})
        new_id = response.json()["new_option_id"]

        option = QuestionOption.objects.get(id=new_id)
        self.assertEqual(option.question_id, self.question.id)
        self.assertEqual(option.option_text, "")
        self.assertIsNone(option.answer_status)

    def test_createnewoption_for_a_vanished_question_is_a_404(self):
        # EDGE-01 fix: the two-admins race — the question was
        # deleted while the other admin's page was still open. Used
        # to surface as a raw foreign-key IntegrityError (HTTP 500)
        doomed = create_question()
        post_json(self.client, f"{QUESTIONS_URL}/deletequestion", {"questionid": doomed.id})

        response = post_json(self.client, f"{QUESTIONS_URL}/createnewoption", {"questionid": doomed.id})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.content, b"Error: Question no longer exists")
        self.assertFalse(QuestionOption.objects.filter(question_id=doomed.id).exists())

        # The rolled-back savepoint leaves the transaction healthy —
        # the very same session keeps working
        response = post_json(self.client, f"{QUESTIONS_URL}/createnewoption", {"questionid": self.question.id})
        self.assertIn("new_option_id", response.json())

    def test_createnewoption_for_a_never_existing_question_is_a_404(self):
        response = post_json(self.client, f"{QUESTIONS_URL}/createnewoption", {"questionid": 424242})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.content, b"Error: Question no longer exists")

    def test_updatequestion_saves_verdict_text_and_options(self):
        response = post_json(self.client, f"{QUESTIONS_URL}/updatequestion", {
            "questionid": self.question.id,
            "isphishing": 1,
            "questiontext": "Po",
            "isenabled": 0,
            "questionoptions": [
                {"optionid": self.option.id, "optiontext": "nauja", "rightoptionanswer": 1},
            ],
        })
        self.assertEqual(response.json(), {"status": "ok"})

        self.question.refresh_from_db()
        self.option.refresh_from_db()
        self.assertEqual(self.question.is_phishing, 1)
        self.assertEqual(self.question.question, "Po")
        self.assertEqual(self.question.is_enabled, 0)
        self.assertEqual(self.option.option_text, "nauja")
        self.assertEqual(self.option.answer_status, 1)

    def test_updatequestion_without_isenabled_keeps_the_flag(self):
        disabled = create_question(is_enabled=0)
        post_json(self.client, f"{QUESTIONS_URL}/updatequestion", {
            "questionid": disabled.id, "isphishing": 0, "questiontext": "x", "questionoptions": [],
        })
        disabled.refresh_from_db()
        self.assertEqual(disabled.is_enabled, 0)

    def test_updatequestion_ignores_options_of_other_questions(self):
        other = create_question()
        foreign_option = add_option(other, option_text="svetima", answer_status=0)

        post_json(self.client, f"{QUESTIONS_URL}/updatequestion", {
            "questionid": self.question.id, "isphishing": 0, "questiontext": "Prieš",
            "questionoptions": [
                {"optionid": foreign_option.id, "optiontext": "pagrobta", "rightoptionanswer": 1},
            ],
        })

        foreign_option.refresh_from_db()
        self.assertEqual(foreign_option.option_text, "svetima")
        self.assertEqual(foreign_option.answer_status, 0)

    def test_unknown_ids_are_silent_no_ops(self):
        # updatequestion / deleteoption / deletequestion all use
        # filter() mutations — a vanished id reports ok instead of
        # erroring (only createnewoption differs, with its 404)
        response = post_json(self.client, f"{QUESTIONS_URL}/updatequestion", {
            "questionid": 424242, "isphishing": 1, "questiontext": "x", "questionoptions": [],
        })
        self.assertEqual(response.json(), {"status": "ok"})
        self.assertEqual(
            post_json(self.client, f"{QUESTIONS_URL}/deleteoption", {"optionid": 424242}).json(),
            {"status": "ok"},
        )
        self.assertEqual(
            post_json(self.client, f"{QUESTIONS_URL}/deletequestion", {"questionid": 424242}).json(),
            {"status": "ok"},
        )

    def test_deleteoption_removes_one_option(self):
        response = post_json(self.client, f"{QUESTIONS_URL}/deleteoption", {"optionid": self.option.id})
        self.assertEqual(response.json(), {"status": "ok"})
        self.assertFalse(QuestionOption.objects.filter(id=self.option.id).exists())

    def test_deletequestion_cascades_options_but_keeps_the_image(self):
        student = create_student()
        Answer.objects.create(
            student=student, question_id=self.question.id, question_text="Prieš",
            image_id=self.question.image_id, is_phishing=0, answer_status=1,
        )

        response = post_json(self.client, f"{QUESTIONS_URL}/deletequestion", {"questionid": self.question.id})
        self.assertEqual(response.json(), {"status": "ok"})
        self.assertFalse(Question.objects.filter(id=self.question.id).exists())
        self.assertFalse(QuestionOption.objects.exists())

        # The frozen snapshot and the upload-only image survive
        self.assertTrue(Answer.objects.filter(question_id=self.question.id).exists())
        self.assertTrue(QuestionImage.objects.filter(id=self.question.image_id).exists())








############################################################
# POST /api/admin/update/phishingtestsize
############################################################

class PhishingTestSizeTests(TestCase):

    def setUp(self):
        create_admin()
        login_admin(self.client)

    def test_students_are_refused(self):
        create_student()
        student_client = Client()
        login_student(student_client)
        response = post_json(student_client, TESTSIZE_URL, {"phishingtestsize": 10})
        self.assertEqual(response.status_code, 403)

    def test_creates_and_updates_the_setting(self):
        response = post_json(self.client, TESTSIZE_URL, {"phishingtestsize": 25})
        self.assertEqual(response.json(), {"status": "ok"})
        self.assertEqual(Setting.objects.get(name="PhishingTestSize").value, "25")

        post_json(self.client, TESTSIZE_URL, {"phishingtestsize": 40})
        self.assertEqual(Setting.objects.get(name="PhishingTestSize").value, "40")
        self.assertEqual(Setting.objects.count(), 1)

    def test_float_sizes_truncate_to_int(self):
        # int(7.9) == 7 — a float from the JSON is stored truncated
        post_json(self.client, TESTSIZE_URL, {"phishingtestsize": 7.9})
        self.assertEqual(Setting.objects.get(name="PhishingTestSize").value, "7")

    def test_numeric_strings_are_accepted(self):
        post_json(self.client, TESTSIZE_URL, {"phishingtestsize": "15"})
        self.assertEqual(Setting.objects.get(name="PhishingTestSize").value, "15")

    def test_zero_and_negative_sizes_are_refused(self):
        # 0 would deal empty tests forever; a negative value would
        # crash dealing outright (random.sample refuses negative
        # counts) — both must never reach the Settings table
        Setting.objects.create(name="PhishingTestSize", value="25")
        for bad in (0, -5, "-5"):
            response = post_json(self.client, TESTSIZE_URL, {"phishingtestsize": bad})
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.content, b"Error: Test size must be at least 1")
        self.assertEqual(Setting.objects.get(name="PhishingTestSize").value, "25")

    def test_invalid_values_are_a_400(self):
        for body in ["not json", None]:
            response = self.client.post(TESTSIZE_URL, data=body or "", content_type="application/json")
            self.assertEqual(response.status_code, 400)

        self.assertEqual(post_json(self.client, TESTSIZE_URL, {"phishingtestsize": "daug"}).status_code, 400)
        self.assertEqual(post_json(self.client, TESTSIZE_URL, {"kitas": 5}).status_code, 400)
        self.assertFalse(Setting.objects.exists())
