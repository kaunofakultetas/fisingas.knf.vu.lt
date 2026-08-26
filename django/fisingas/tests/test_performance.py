############################################################
#  [*] Regression tests — query-count budgets
#
#  The leaderboard refreshes every few seconds on the
#  projector and the dashboard polls too — the codebase
#  deliberately batches all grading into a fixed number of
#  queries (see grading._judge_answers). These tests pin
#  that number, so an accidental per-row query (N+1) fails
#  loudly instead of melting the event.
#
#  The counts include the request's transaction bookkeeping
#  (SAVEPOINT/RELEASE from ATOMIC_REQUESTS) and, for
#  authenticated endpoints, the session + user reload
#  queries — they are part of every request's real cost.
############################################################


from django.test import TestCase

from fisingas.phishing_test.models import Answer, AnswerSelectedOption, TestResult

from .utils import create_admin, create_student, login_admin, local


def _mixed_population():
    # Three grading modes at once, so every batched query has
    # actual rows to fetch
    frozen = create_student(username="FROZEN", is_finished=1, last_login=local("2026-08-26 10:00:00"))
    TestResult.objects.create(
        student=frozen, question_count=2, answered_question_count=2,
        total_identified_correctly=2, fully_correct_count=2,
        total_options_count=0, total_correct_options_count=0,
        total_points=1.0, finished_at=local("2026-08-01 10:00:00"),
    )
    live = create_student(username="LIVE", last_login=local("2026-08-26 10:00:00"))
    for question_id in (1, 2):
        Answer.objects.create(student=live, question_id=question_id, question_text="", is_phishing=1, answer_status=1)
        AnswerSelectedOption.objects.create(
            student=live, question_id=question_id, option_id=question_id * 10,
            option_text="", right_answer=1, is_selected=1,
        )
    create_student(username="BLANK", last_login=local("2026-08-26 10:00:00"))


class QueryBudgetTests(TestCase):

    def test_leaderboard_query_budget(self):
        _mixed_population()
        with self.assertNumQueries(6):
            self.client.get("/api/leaderboard")

    def test_students_list_query_budget(self):
        create_admin()
        _mixed_population()
        login_admin(self.client)
        with self.assertNumQueries(9):
            self.client.get("/api/admin/students")

    def test_admin_home_query_budget(self):
        create_admin()
        _mixed_population()
        login_admin(self.client)
        with self.assertNumQueries(10):
            self.client.get("/api/admin/home")
