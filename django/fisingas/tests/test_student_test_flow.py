############################################################
#  [*] Regression tests — the student test flow
#
#  GET/POST /api/student/questions and GET /api/student/finish:
#  dealing freezes the questions, saving writes only the
#  student's own snapshot rows, finishing locks the test and
#  freezes the totals into TestResult. Ends with a full
#  register → test → finish → leaderboard walk-through.
############################################################


from django.test import Client, TestCase

from fisingas.phishing_test.models import Answer, AnswerSelectedOption, QuestionLink, TestResult
from fisingas.users.models import Setting, Student

from .utils import (
    TIMESTAMP_RE,
    add_option,
    create_admin,
    create_question,
    create_student,
    login,
    login_admin,
    login_student,
    post_json,
)


QUESTIONS_URL = "/api/student/questions"
FINISH_URL = "/api/student/finish"








############################################################
# GET — dealing the test
############################################################

class DealTests(TestCase):

    def setUp(self):
        self.student = create_student()
        login_student(self.client)

    def test_requires_login(self):
        self.assertEqual(Client().get(QUESTIONS_URL).status_code, 401)

    def test_first_get_deals_and_freezes_the_questions(self):
        question = create_question(is_phishing=1, question="Ar tikras šis laiškas?")
        option = add_option(question, option_text="Siuntėjo adresas", answer_status=1)

        data = self.client.get(QUESTIONS_URL).json()

        # The response — one entry per dealt question, nothing
        # about the correct answers leaks to the student
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0], {
            "questionid": question.id,
            "selectedanswer": None,
            "question": "Ar tikras šis laiškas?",
            "questionoptions": [
                {"answeroptionid": option.id, "answeroption": "Siuntėjo adresas", "isselected": None},
            ],
            "questionlinks": [],
        })

        # The frozen snapshot rows
        answer = Answer.objects.get(student=self.student)
        self.assertEqual(answer.question_id, question.id)
        self.assertEqual(answer.question_text, "Ar tikras šis laiškas?")
        self.assertEqual(answer.is_phishing, 1)
        self.assertEqual(answer.image_id, question.image_id)
        self.assertIsNone(answer.answer_status)

        selection = AnswerSelectedOption.objects.get(student=self.student)
        self.assertEqual(selection.option_id, option.id)
        self.assertEqual(selection.option_text, "Siuntėjo adresas")
        self.assertEqual(selection.right_answer, 1)
        self.assertIsNone(selection.is_selected)

    def test_deal_respects_the_test_size_setting(self):
        Setting.objects.create(name="PhishingTestSize", value="1")
        for _ in range(3):
            create_question()

        data = self.client.get(QUESTIONS_URL).json()
        self.assertEqual(len(data), 1)
        self.assertEqual(Answer.objects.filter(student=self.student).count(), 1)

    def test_deal_skips_disabled_questions(self):
        enabled = create_question(is_enabled=1)
        create_question(is_enabled=0)

        data = self.client.get(QUESTIONS_URL).json()
        self.assertEqual([entry["questionid"] for entry in data], [enabled.id])

    def test_small_bank_deals_everything_it_has(self):
        # Default size is 30 — a 2-question bank deals 2
        create_question()
        create_question()
        self.assertEqual(len(self.client.get(QUESTIONS_URL).json()), 2)

    def test_later_gets_return_the_same_frozen_test(self):
        question = create_question(question="Originalus tekstas")
        first = self.client.get(QUESTIONS_URL).json()

        # The bank moves on: new question, edited text — the
        # dealt test must not notice
        create_question(question="Naujas klausimas")
        question.question = "Pakeistas tekstas"
        question.save()

        second = self.client.get(QUESTIONS_URL).json()
        self.assertEqual(len(second), 1)
        self.assertEqual(second[0]["questionid"], first[0]["questionid"])
        self.assertEqual(second[0]["question"], "Originalus tekstas")

    def test_tooltip_links_ride_along_with_raw_coordinates(self):
        question = create_question()
        QuestionLink.objects.create(
            image_id=question.image_id, title="Nuoroda",
            content="https://apgaule.example", x="0.25", y="0.5", w="0.1", h="0.2",
        )

        [entry] = self.client.get(QUESTIONS_URL).json()
        self.assertEqual(entry["questionlinks"], [
            {"title": "Nuoroda", "content": "https://apgaule.example", "x": "0.25", "y": "0.5"},
        ])

    def test_admins_get_an_empty_object(self):
        create_admin()
        admin_client = Client()
        login_admin(admin_client)
        self.assertEqual(admin_client.get(QUESTIONS_URL).json(), {})

    def test_finished_students_are_locked_out(self):
        create_question()
        Student.objects.filter(id=self.student.id).update(is_finished=1)
        self.assertEqual(self.client.get(QUESTIONS_URL).json(), {})
        self.assertFalse(Answer.objects.exists())     # locked test does not even deal








############################################################
# POST — saving the current state
############################################################

class SaveTests(TestCase):

    def setUp(self):
        self.student = create_student()
        self.question = create_question(is_phishing=1)
        self.option = add_option(self.question, answer_status=1)
        login_student(self.client)
        self.client.get(QUESTIONS_URL)   # deal

    def _state(self, selectedanswer, isselected):
        return [{
            "questionid": self.question.id,
            "selectedanswer": selectedanswer,
            "questionoptions": [{"answeroptionid": self.option.id, "isselected": isselected}],
        }]

    def test_post_saves_verdict_and_checkboxes(self):
        response = post_json(self.client, QUESTIONS_URL, self._state(1, 1))
        self.assertEqual(response.content, b"OK")

        answer = Answer.objects.get(student=self.student)
        selection = AnswerSelectedOption.objects.get(student=self.student)
        self.assertEqual(answer.answer_status, 1)
        self.assertEqual(selection.is_selected, 1)

        # ...and the next GET plays the state back
        [entry] = self.client.get(QUESTIONS_URL).json()
        self.assertEqual(entry["selectedanswer"], 1)
        self.assertEqual(entry["questionoptions"][0]["isselected"], 1)

    def test_every_post_writes_the_full_state(self):
        # The frontend always sends everything — leaving a field
        # out resets it to NULL ("not answered")
        post_json(self.client, QUESTIONS_URL, self._state(1, 1))
        post_json(self.client, QUESTIONS_URL, [{"questionid": self.question.id}])

        answer = Answer.objects.get(student=self.student)
        self.assertIsNone(answer.answer_status)

    def test_non_list_body_is_refused(self):
        response = post_json(self.client, QUESTIONS_URL, {"questionid": 1})
        self.assertEqual(response.content, b"Error: This is not questions state object")

    def test_entry_without_questionid_is_refused(self):
        response = post_json(self.client, QUESTIONS_URL, [{"selectedanswer": 1}])
        self.assertEqual(response.content, b"Error: This is not questions state object")

    def test_option_without_id_is_refused(self):
        response = post_json(self.client, QUESTIONS_URL, [{
            "questionid": self.question.id, "questionoptions": [{"isselected": 1}],
        }])
        self.assertEqual(response.content, b"Error: This is not questions state object")

    def test_undealt_question_id_is_a_silent_no_op(self):
        response = post_json(self.client, QUESTIONS_URL, [{"questionid": 424242, "selectedanswer": 1}])
        self.assertEqual(response.content, b"OK")
        self.assertFalse(Answer.objects.filter(question_id=424242).exists())

    def test_students_can_only_write_their_own_snapshot(self):
        # A second student dealt the same bank question — writing
        # through the shared question id must not cross accounts
        create_student(username="SECOND", passcode="87654321")
        other_client = Client()
        login_student(other_client, username="SECOND", passcode="87654321")
        other_client.get(QUESTIONS_URL)   # deal for SECOND

        post_json(self.client, QUESTIONS_URL, self._state(1, 1))
        post_json(other_client, QUESTIONS_URL, [{
            "questionid": self.question.id, "selectedanswer": 0,
            "questionoptions": [{"answeroptionid": self.option.id, "isselected": 0}],
        }])

        self.assertEqual(Answer.objects.get(student=self.student).answer_status, 1)
        self.assertEqual(AnswerSelectedOption.objects.get(student=self.student).is_selected, 1)








############################################################
# GET /api/student/finish — locking and freezing
############################################################

class FinishTests(TestCase):

    def setUp(self):
        self.student = create_student()
        self.phishing = create_question(is_phishing=1)
        self.option_yes = add_option(self.phishing, option_text="taip", answer_status=1)
        self.option_no = add_option(self.phishing, option_text="ne", answer_status=0)
        self.genuine = create_question(is_phishing=0)
        login_student(self.client)

    def _take_the_test(self):
        self.client.get(QUESTIONS_URL)
        # Phishing question fully right; genuine one answered wrong
        post_json(self.client, QUESTIONS_URL, [
            {
                "questionid": self.phishing.id, "selectedanswer": 1,
                "questionoptions": [
                    {"answeroptionid": self.option_yes.id, "isselected": 1},
                    {"answeroptionid": self.option_no.id, "isselected": 0},
                ],
            },
            {"questionid": self.genuine.id, "selectedanswer": 1},
        ])

    def test_requires_login(self):
        self.assertEqual(Client().get(FINISH_URL).status_code, 401)

    def test_finish_locks_the_test_and_freezes_the_totals(self):
        self._take_the_test()
        self.assertEqual(self.client.get(FINISH_URL).json(), {})

        self.student.refresh_from_db()
        self.assertEqual(self.student.is_finished, 1)

        result = TestResult.objects.get(student=self.student)
        self.assertEqual(result.question_count, 2)
        self.assertEqual(result.answered_question_count, 2)
        self.assertEqual(result.total_identified_correctly, 1)
        self.assertEqual(result.fully_correct_count, 1)
        self.assertEqual(result.total_options_count, 2)
        self.assertEqual(result.total_correct_options_count, 2)
        self.assertEqual(result.total_points, 1.0)
        self.assertRegex(result.finished_at, TIMESTAMP_RE)

        # The locked test refuses further reads and writes
        self.assertEqual(self.client.get(QUESTIONS_URL).json(), {})

    def test_second_finish_keeps_the_first_freeze(self):
        self._take_the_test()
        self.client.get(FINISH_URL)
        first = TestResult.objects.get(student=self.student)

        # Even if the snapshots were tampered with afterwards,
        # finishing again must not re-grade
        Answer.objects.filter(student=self.student).update(answer_status=0)
        self.client.get(FINISH_URL)

        second = TestResult.objects.get(student=self.student)
        self.assertEqual(second.total_points, first.total_points)
        self.assertEqual(second.finished_at, first.finished_at)

    def test_unanswered_questions_count_as_wrong(self):
        self.client.get(QUESTIONS_URL)
        post_json(self.client, QUESTIONS_URL, [{
            "questionid": self.genuine.id, "selectedanswer": 0,
        }])
        self.client.get(FINISH_URL)

        result = TestResult.objects.get(student=self.student)
        self.assertEqual(result.question_count, 2)
        self.assertEqual(result.answered_question_count, 1)
        self.assertEqual(result.total_identified_correctly, 1)
        self.assertEqual(result.total_points, 1.0)   # only the answered genuine question scores

    def test_finish_without_a_dealt_test_freezes_nothing(self):
        self.assertEqual(self.client.get(FINISH_URL).json(), {})
        self.student.refresh_from_db()
        self.assertEqual(self.student.is_finished, 1)
        self.assertFalse(TestResult.objects.exists())

    def test_admins_get_an_empty_object(self):
        create_admin()
        admin_client = Client()
        login_admin(admin_client)
        self.assertEqual(admin_client.get(FINISH_URL).json(), {})
        self.assertFalse(TestResult.objects.exists())








############################################################
# The whole journey — register to leaderboard
############################################################

class FullFlowTest(TestCase):

    def test_register_take_finish_and_read_back_everywhere(self):
        create_admin()
        question = create_question(is_phishing=1, question="Suklastotas laiškas")
        option = add_option(question, option_text="Skubinimas", answer_status=1)

        # Register through the public endpoint and log in with
        # the returned access code
        registration = post_json(self.client, "/api/student/register", {"username": "e2e student"}).json()
        self.assertEqual(registration["status"], "OK")
        self.assertEqual(login(self.client, registration["username"], registration["accessCode"]).content, b"OK")
        student_id = self.client.get("/api/checkauth").json()["userid"]

        # Take the test — everything right — and finish
        [entry] = self.client.get(QUESTIONS_URL).json()
        post_json(self.client, QUESTIONS_URL, [{
            "questionid": entry["questionid"], "selectedanswer": 1,
            "questionoptions": [{"answeroptionid": option.id, "isselected": 1}],
        }])
        self.client.get(FINISH_URL)

        # The student sees their own grade...
        own_row = self.client.get(f"/api/admin/students/{student_id}").json()
        self.assertEqual(own_row["testgrade"], "10.00")
        self.assertEqual(own_row["isfinished"], 1)

        # ...and their own graded answers
        [graded] = self.client.get(f"/api/admin/students/{student_id}/answers").json()
        self.assertEqual(graded["answerpoints"], "1.00")

        # The admin table and the public leaderboard agree
        admin_client = Client()
        login_admin(admin_client)
        [admin_row] = admin_client.get("/api/admin/students").json()
        self.assertEqual(admin_row["testgrade"], "10.00")

        [board_row] = Client().get("/api/leaderboard").json()
        self.assertEqual(board_row["username"], registration["username"])
        self.assertEqual(board_row["testgrade"], "10.00")
        self.assertEqual(board_row["isfinished"], 1)
