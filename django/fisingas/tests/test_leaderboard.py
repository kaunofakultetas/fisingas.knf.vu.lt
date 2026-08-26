############################################################
#  [*] Regression tests — public projector endpoints
#
#  GET /api/leaderboard           — no auth, live + frozen grades
#  GET /api/leaderboard/nextslide — a random slide image
#
#  Both are deliberately public; the leaderboard rows must
#  never grow fields the projector should not show (like
#  passcodes).
############################################################


import os
import tempfile
from unittest.mock import patch

from django.test import TestCase

from fisingas.phishing_test.models import Answer, TestResult

from .utils import create_student


BOARD_URL = "/api/leaderboard"
SLIDE_URL = "/api/leaderboard/nextslide"








############################################################
# GET /api/leaderboard
############################################################

class LeaderboardTests(TestCase):

    def test_public_and_empty_by_default(self):
        response = self.client.get(BOARD_URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    def test_blank_field_contract_and_no_passcode_leak(self):
        student = create_student(last_login="2026-08-01 10:00:00")
        self.assertEqual(self.client.get(BOARD_URL).json(), [{
            "id": student.id,
            "username": student.username,
            "questioncount": "",
            "answeredquestioncount": None,
            "testgrade": "",
            "isfinished": 0,
            "lastseen": "2026-08-01 10:00:00",
        }])

    def test_rows_are_newest_first(self):
        create_student(username="OLDER")
        create_student(username="NEWER")
        usernames = [row["username"] for row in self.client.get(BOARD_URL).json()]
        self.assertEqual(usernames, ["NEWER", "OLDER"])

    def test_unfinished_students_are_graded_live(self):
        student = create_student()
        Answer.objects.create(student=student, question_id=1, question_text="", is_phishing=1, answer_status=1)
        Answer.objects.create(student=student, question_id=2, question_text="", is_phishing=0, answer_status=None)

        [row] = self.client.get(BOARD_URL).json()
        self.assertEqual(row["questioncount"], 2)
        self.assertEqual(row["answeredquestioncount"], 1)
        self.assertEqual(row["testgrade"], "5.00")

    def test_finished_students_come_from_the_frozen_row(self):
        # The tampered frozen totals must win over the answers —
        # finished students are never re-judged
        student = create_student(is_finished=1)
        Answer.objects.create(student=student, question_id=1, question_text="", is_phishing=1, answer_status=0)
        TestResult.objects.create(
            student=student, question_count=2, answered_question_count=2,
            total_identified_correctly=2, fully_correct_count=2,
            total_options_count=0, total_correct_options_count=0,
            total_points=2.0, finished_at="2026-08-01 10:00:00",
        )

        [row] = self.client.get(BOARD_URL).json()
        self.assertEqual(row["questioncount"], 2)
        self.assertEqual(row["testgrade"], "10.00")
        self.assertEqual(row["isfinished"], 1)

    def test_deactivated_students_are_still_listed(self):
        # status=0 blocks the login, not the board
        create_student(status=0)
        self.assertEqual(len(self.client.get(BOARD_URL).json()), 1)








############################################################
# GET /api/leaderboard/nextslide
############################################################

class NextSlideTests(TestCase):

    def test_missing_directory_is_a_404(self):
        with patch.dict(os.environ, {"SLIDES_DIRECTORY": "/definitely/not/there"}):
            response = self.client.get(SLIDE_URL)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "Slides directory not found"})

    def test_directory_without_images_is_a_404(self):
        # Stray uploads and subdirectories are not slides
        with tempfile.TemporaryDirectory() as slides_dir:
            open(os.path.join(slides_dir, "notes.pdf"), "wb").write(b"pdf")
            os.mkdir(os.path.join(slides_dir, "folder.png"))

            with patch.dict(os.environ, {"SLIDES_DIRECTORY": slides_dir}):
                response = self.client.get(SLIDE_URL)

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "No slide images found"})

    def test_serves_a_slide_image(self):
        slide_bytes = b"\x89PNG\r\n\x1a\nslide body"
        with tempfile.TemporaryDirectory() as slides_dir:
            open(os.path.join(slides_dir, "slide.png"), "wb").write(slide_bytes)

            with patch.dict(os.environ, {"SLIDES_DIRECTORY": slides_dir}):
                response = self.client.get(SLIDE_URL)
                content = b"".join(response.streaming_content)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "image/png")
        self.assertEqual(content, slide_bytes)

    def test_uppercase_extensions_count_as_images(self):
        with tempfile.TemporaryDirectory() as slides_dir:
            open(os.path.join(slides_dir, "SLIDE.JPG"), "wb").write(b"jpg bytes")

            with patch.dict(os.environ, {"SLIDES_DIRECTORY": slides_dir}):
                response = self.client.get(SLIDE_URL)
                b"".join(response.streaming_content)

        self.assertEqual(response.status_code, 200)
