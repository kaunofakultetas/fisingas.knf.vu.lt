############################################################
#  [*] Regression tests — the student test flow
#
#  GET/POST /api/student/questions and GET /api/student/finish:
#  dealing freezes the questions, saving writes only the
#  student's own snapshot rows, finishing locks the test and
#  freezes the totals into TestResult. Ends with a full
#  register → test → finish → leaderboard walk-through.
############################################################


from unittest.mock import patch as mock_patch

from django.db import IntegrityError, connection
from django.test import Client, TestCase
from django.test.utils import CaptureQueriesContext

from fisingas.phishing_test.models import Answer, AnswerSelectedOption, TestResult
from fisingas.users.models import Setting, Student

from .utils import (
    is_recent,
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

    def test_deal_draws_only_from_the_enabled_bank(self):
        Setting.objects.create(name="PhishingTestSize", value="2")
        enabled_ids = {create_question().id for _ in range(5)}
        disabled = create_question(is_enabled=0)

        dealt = {entry["questionid"] for entry in self.client.get(QUESTIONS_URL).json()}
        self.assertEqual(len(dealt), 2)
        self.assertTrue(dealt <= enabled_ids)
        self.assertNotIn(disabled.id, dealt)

    def test_repeated_gets_return_the_same_question_set(self):
        for _ in range(3):
            create_question()
        first = {entry["questionid"] for entry in self.client.get(QUESTIONS_URL).json()}
        second = {entry["questionid"] for entry in self.client.get(QUESTIONS_URL).json()}
        self.assertEqual(len(first), 3)
        self.assertEqual(first, second)

    def test_deal_reads_the_enabled_bank_exactly_once(self):
        # The pool and the sample size must come from ONE read —
        # a second count query could see a question an admin
        # enabled in between, hand random.sample a k larger than
        # the pool and crash the student's first request
        create_question()
        create_question()

        with CaptureQueriesContext(connection) as ctx:
            self.client.get(QUESTIONS_URL)

        bank_reads = [q["sql"] for q in ctx.captured_queries if 'FROM "phishing_test_question"' in q["sql"]]
        self.assertEqual(len(bank_reads), 1, bank_reads)

    def test_deal_that_collides_with_an_existing_snapshot_serves_it(self):
        # The one IntegrityError the deal may swallow: a snapshot
        # landed in the meantime (the unique student+question
        # constraint fired). It is logged and the snapshot served
        question = create_question()

        def winner_landed_first(studentID):
            Answer.objects.create(
                student_id=studentID, question_id=question.id, question_text="laimėtojo",
                image_id=question.image_id, is_phishing=question.is_phishing, answer_status=None,
            )
            raise IntegrityError("duplicate key")

        with mock_patch("fisingas.phishing_test.api.student_views._deal_questions", side_effect=winner_landed_first), \
                self.assertLogs("fisingas.phishing_test.api.student_views", level="WARNING"):
            response = self.client.get(QUESTIONS_URL)

        self.assertEqual(response.status_code, 200)
        self.assertEqual([entry["question"] for entry in response.json()], ["laimėtojo"])

    def test_deal_that_fails_without_leaving_a_snapshot_is_not_hidden(self):
        # Any OTHER integrity failure must not be answered with a
        # 200 and an empty test that looks like success — it is
        # logged and re-raised
        create_question()
        with mock_patch("fisingas.phishing_test.api.student_views._deal_questions", side_effect=IntegrityError("broken")), \
                self.assertLogs("fisingas.phishing_test.api.student_views", level="ERROR"), \
                self.assertRaises(IntegrityError):
            self.client.get(QUESTIONS_URL)
        self.assertFalse(Answer.objects.exists())

    def test_question_order_is_fixed_at_deal_time(self):
        # The order is random per student when dealt and then
        # STABLE — the sidebar numbers questions by position, so a
        # reload must not renumber them
        for _ in range(6):
            create_question()

        first = [entry["questionid"] for entry in self.client.get(QUESTIONS_URL).json()]
        self.assertEqual(len(first), 6)
        for _ in range(5):
            self.assertEqual([entry["questionid"] for entry in self.client.get(QUESTIONS_URL).json()], first)

    def test_corrupt_test_size_setting_falls_back_to_the_default(self):
        # Only a hand edit (DBGate) can leave a non-numeric or
        # non-positive value — it must not take every student's
        # first request down with a 500
        create_question()
        create_question()
        for value in ("abc", "", "0", "-3"):
            Answer.objects.all().delete()
            AnswerSelectedOption.objects.all().delete()
            Setting.objects.update_or_create(name="PhishingTestSize", defaults={"value": value})
            self.assertEqual(len(self.client.get(QUESTIONS_URL).json()), 2, value)

    def test_deal_locks_the_student_row_before_checking_for_a_snapshot(self):
        # Two concurrent first GETs are serialised on the student
        # row: the lock (UPDATE users_student) must come before the
        # snapshot check and the deal writes, so the second request
        # blocks, then sees the first one's rows and skips dealing
        # — otherwise disjoint samples would deal a double test
        create_question()

        with CaptureQueriesContext(connection) as ctx:
            self.client.get(QUESTIONS_URL)

        sql = [q["sql"] for q in ctx.captured_queries]
        lock = next(i for i, st in enumerate(sql) if st.startswith('UPDATE "users_student"'))
        snapshot_check = next(i for i, st in enumerate(sql) if 'FROM "phishing_test_answer"' in st)
        deal_write = next(i for i, st in enumerate(sql) if st.startswith('INSERT INTO "phishing_test_answer"'))
        self.assertLess(lock, snapshot_check)
        self.assertLess(lock, deal_write)

    def test_empty_bank_deals_nothing_until_questions_exist(self):
        # A student who opens the test before any questions exist
        # gets an empty test — and is dealt one on a later refresh
        self.assertEqual(self.client.get(QUESTIONS_URL).json(), [])
        self.assertFalse(Answer.objects.exists())

        create_question()
        self.assertEqual(len(self.client.get(QUESTIONS_URL).json()), 1)

    def test_options_added_after_dealing_stay_invisible(self):
        question = create_question()
        add_option(question, option_text="pradinė", answer_status=1)
        self.client.get(QUESTIONS_URL)   # deal with 1 option

        add_option(question, option_text="vėlesnė", answer_status=1)

        [entry] = self.client.get(QUESTIONS_URL).json()
        self.assertEqual(len(entry["questionoptions"]), 1)
        self.assertEqual(AnswerSelectedOption.objects.filter(student=self.student).count(), 1)

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

    def test_tooltip_links_are_not_part_of_the_payload(self):
        # The test page fetches /api/phishingpictures/<id>/links per
        # question — the payload carries exactly the four question
        # keys and nothing else (a former `questionlinks` copy had
        # no consumer and an incompatible coordinate encoding)
        create_question()

        [entry] = self.client.get(QUESTIONS_URL).json()
        self.assertEqual(set(entry), {"questionid", "selectedanswer", "question", "questionoptions"})

    def test_admins_get_an_empty_object(self):
        create_admin()
        admin_client = Client()
        login_admin(admin_client)
        self.assertEqual(admin_client.get(QUESTIONS_URL).json(), {})

    def test_every_touch_of_the_test_bumps_lastseen(self):
        # The dashboard's 30-minute progress list keys on this
        create_question()
        self.client.get(QUESTIONS_URL)
        self.student.refresh_from_db()
        self.assertTrue(is_recent(self.student.last_login))

        # ...and saving counts as activity too
        Student.objects.filter(id=self.student.id).update(last_login=None)
        post_json(self.client, QUESTIONS_URL, [])
        self.student.refresh_from_db()
        self.assertTrue(is_recent(self.student.last_login))

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

    def test_scalar_entries_are_refused_not_a_crash(self):
        # Each of these must come back as the friendly error, never
        # a TypeError → 500 (`in` on a non-dict; the string
        # "questionid" would even pass a substring check and then
        # crash on subscripting)
        for body in ([0], [None], [1.5], [True], ["questionid"]):
            response = post_json(self.client, QUESTIONS_URL, body)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.content, b"Error: This is not questions state object")

    def test_scalar_options_are_refused_not_a_crash(self):
        response = post_json(self.client, QUESTIONS_URL, [{
            "questionid": self.question.id, "questionoptions": [5],
        }])
        self.assertEqual(response.content, b"Error: This is not questions state object")

    def test_non_list_questionoptions_is_refused(self):
        response = post_json(self.client, QUESTIONS_URL, [{
            "questionid": self.question.id, "questionoptions": 5,
        }])
        self.assertEqual(response.content, b"Error: This is not questions state object")

    def test_rejected_payload_writes_nothing(self):
        # The whole payload is validated before any write — a body
        # refused because of a later entry must not leave the
        # earlier entries half-saved
        response = post_json(self.client, QUESTIONS_URL, [
            {
                "questionid": self.question.id, "selectedanswer": 1,
                "questionoptions": [{"answeroptionid": self.option.id, "isselected": 1}],
            },
            0,
        ])
        self.assertEqual(response.content, b"Error: This is not questions state object")
        self.assertIsNone(Answer.objects.get(student=self.student).answer_status)
        self.assertIsNone(AnswerSelectedOption.objects.get(student=self.student).is_selected)

    def test_post_never_deals(self):
        # Only the GET deals — saving into an undealt test is a no-op
        create_student(username="FRESH_POST", passcode="87654321")
        fresh_client = Client()
        login_student(fresh_client, username="FRESH_POST", passcode="87654321")

        response = post_json(fresh_client, QUESTIONS_URL, [])
        self.assertEqual(response.content, b"OK")
        self.assertFalse(Answer.objects.filter(student__username="FRESH_POST").exists())

    def test_cross_question_option_ids_cannot_write(self):
        # An option frozen under one question cannot be addressed
        # through another question's entry
        # Created after the deal — never part of this student's test
        other_question = create_question(is_phishing=0)

        response = post_json(self.client, QUESTIONS_URL, [{
            "questionid": other_question.id,
            "questionoptions": [{"answeroptionid": self.option.id, "isselected": 1}],
        }])
        self.assertEqual(response.content, b"OK")
        selection = AnswerSelectedOption.objects.get(student=self.student)
        self.assertIsNone(selection.is_selected)

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
        self.assertTrue(is_recent(result.finished_at))

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

    def test_finish_locks_the_student_row_before_grading(self):
        # The answers POST takes the student row lock (UPDATE
        # users_student) as its FIRST statement and holds it while
        # it writes the answers. Finish must take that same lock
        # before it grades — otherwise, on Postgres, a POST that
        # commits mid-finish is missing from the frozen TestResult
        # but visible in the live answer review, permanently.
        # SQLite cannot reproduce the race, so this pins the
        # statement order instead: the lock precedes every
        # grading read and the TestResult write
        self._take_the_test()

        with CaptureQueriesContext(connection) as ctx:
            self.client.get(FINISH_URL)

        sql = [query["sql"] for query in ctx.captured_queries]
        lock = next(i for i, statement in enumerate(sql) if statement.startswith('UPDATE "users_student"'))
        first_grading_read = next(i for i, statement in enumerate(sql) if '"phishing_test_answer' in statement)
        freeze = next(i for i, statement in enumerate(sql) if '"phishing_test_testresult"' in statement)

        self.assertLess(lock, first_grading_read)
        self.assertLess(lock, freeze)

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

    def test_checkauth_reflects_the_finished_flag(self):
        self._take_the_test()
        self.assertEqual(self.client.get("/api/checkauth").json()["phishingtestfinished"], 0)
        self.client.get(FINISH_URL)
        self.assertEqual(self.client.get("/api/checkauth").json()["phishingtestfinished"], 1)

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







############################################################
# POST /api/student/questions — value validation
############################################################

class SaveValueValidationTests(TestCase):

    def setUp(self):
        self.student = create_student()
        self.question = create_question(is_phishing=1)
        self.option = add_option(self.question, answer_status=1)
        login_student(self.client)
        self.client.get(QUESTIONS_URL)   # deal

    def _refused(self, payload):
        response = post_json(self.client, QUESTIONS_URL, payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content.decode(), "Error: This is not questions state object")
        # nothing written
        self.assertIsNone(Answer.objects.get(student=self.student).answer_status)
        self.assertIsNone(AnswerSelectedOption.objects.get(student=self.student).is_selected)

    def test_garbage_verdict_value_is_refused(self):
        self._refused([{"questionid": self.question.id, "selectedanswer": "phishing"}])

    def test_out_of_range_verdict_is_refused(self):
        self._refused([{"questionid": self.question.id, "selectedanswer": 2}])

    def test_boolean_verdict_is_refused(self):
        self._refused([{"questionid": self.question.id, "selectedanswer": True}])

    def test_garbage_checkbox_value_is_refused(self):
        self._refused([{
            "questionid": self.question.id,
            "questionoptions": [{"answeroptionid": self.option.id, "isselected": "x"}],
        }])

    def test_non_integer_ids_are_refused(self):
        self._refused([{"questionid": "abc", "selectedanswer": 1}])
        self._refused([{"questionid": self.question.id, "questionoptions": [{"answeroptionid": "abc", "isselected": 1}]}])

    def test_null_values_are_still_accepted(self):
        # null = "not answered" is a legitimate state to save back
        response = post_json(self.client, QUESTIONS_URL, [{
            "questionid": self.question.id, "selectedanswer": None,
            "questionoptions": [{"answeroptionid": self.option.id, "isselected": None}],
        }])
        self.assertEqual(response.content.decode(), "OK")
