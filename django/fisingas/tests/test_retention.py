############################################################
#  [*] Regression tests — the retention sweep
#
#  users/management/commands/delete_old_students.py — the
#  daily cron job that deletes student accounts untouched
#  for RETENTION_DAYS (180). The one piece of code that
#  destroys data on a schedule, previously untested.
############################################################


from datetime import datetime, timedelta
from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from fisingas.phishing_test.models import Answer, QuestionImage, TestResult
from fisingas.users.models import Student

from .utils import create_admin, create_student


def _days_ago(days):
    return (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")


def _run():
    call_command("delete_old_students", stdout=StringIO())


class DeleteOldStudentsTests(TestCase):

    def test_deletes_students_inactive_beyond_retention_with_their_test(self):
        student = create_student(last_login=_days_ago(200), registration_time=_days_ago(220))
        image = QuestionImage.objects.create(image=b"bytes", created="")
        Answer.objects.create(student=student, question_id=1, question_text="", image=image, is_phishing=1, answer_status=1)
        TestResult.objects.create(
            student=student, question_count=1, answered_question_count=1,
            total_identified_correctly=1, fully_correct_count=1,
            total_options_count=0, total_correct_options_count=0,
            total_points=1.0, finished_at=_days_ago(200),
        )

        _run()

        self.assertFalse(Student.objects.exists())
        self.assertFalse(Answer.objects.exists())        # CASCADEs with the account
        self.assertFalse(TestResult.objects.exists())
        self.assertTrue(QuestionImage.objects.exists())  # upload-only images stay

    def test_keeps_students_with_recent_activity(self):
        # Registered long ago but seen recently — both conditions
        # must be old for deletion
        create_student(last_login=_days_ago(5), registration_time=_days_ago(300))
        _run()
        self.assertEqual(Student.objects.count(), 1)

    def test_keeps_fresh_registrations_that_never_logged_in(self):
        # Legacy accounts with an empty lastseen ("" sorts before
        # any date) survive on their recent registration alone
        create_student(last_login="", registration_time=_days_ago(5))
        _run()
        self.assertEqual(Student.objects.count(), 1)

    def test_removes_pre_import_accounts_with_blank_fields(self):
        # "" in BOTH fields counts as old — documented on purpose
        create_student(last_login="", registration_time="")
        _run()
        self.assertFalse(Student.objects.exists())

    def test_retention_boundary_is_180_days(self):
        create_student(username="FRESH_SIDE", last_login=_days_ago(179), registration_time=_days_ago(179))
        create_student(username="STALE_SIDE", last_login=_days_ago(181), registration_time=_days_ago(181))

        _run()

        self.assertEqual(
            [student.username for student in Student.objects.all()],
            ["FRESH_SIDE"],
        )

    def test_admin_accounts_are_never_touched(self):
        create_admin(last_login="2020-01-01 00:00:00")
        _run()
        from fisingas.users.models import SystemUser
        self.assertEqual(SystemUser.objects.count(), 1)
