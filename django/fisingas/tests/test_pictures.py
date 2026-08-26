############################################################
#  [*] Regression tests — question pictures and links
#
#  POST /api/phishingpictures            — upload → new question
#  GET  /api/phishingpictures/<id>       — the raw bytes
#  GET/POST /api/phishingpictures/<id>/links — clickable areas
#
#  Including the promise the storage design makes: pictures
#  and tooltips of already-dealt tests keep working after
#  the question itself is deleted.
############################################################


from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase

from fisingas.phishing_test.models import Answer, Question, QuestionImage, QuestionLink

from .utils import (
    GIF_BYTES,
    JPEG_BYTES,
    PNG_BYTES,
    TIMESTAMP_RE,
    create_admin,
    create_question,
    create_student,
    login_admin,
    login_student,
    post_json,
)


UPLOAD_URL = "/api/phishingpictures"


def _upload(client, filename, content=PNG_BYTES):
    return client.post(UPLOAD_URL, {"image": SimpleUploadedFile(filename, content)})








############################################################
# POST /api/phishingpictures — upload
############################################################

class UploadPictureTests(TestCase):

    def setUp(self):
        create_admin()
        login_admin(self.client)

    def test_requires_login(self):
        self.assertEqual(_upload(Client(), "shot.png").status_code, 401)

    def test_students_are_refused(self):
        create_student()
        student_client = Client()
        login_student(student_client)
        response = _upload(student_client, "shot.png")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"type": "error", "reason": "Not Admin"})

    def test_upload_creates_the_image_and_an_empty_question(self):
        response = _upload(self.client, "shot.png")
        self.assertEqual(response.json(), {"type": "ok", "message": "Image uploaded successfully"})

        image = QuestionImage.objects.get()
        self.assertEqual(bytes(image.image), PNG_BYTES)
        self.assertRegex(image.created, TIMESTAMP_RE)

        question = Question.objects.get()
        self.assertEqual(question.image_id, image.id)
        self.assertEqual(question.is_enabled, 1)
        self.assertEqual(question.is_phishing, 0)
        self.assertEqual(question.question, "")

    def test_uppercase_extension_is_allowed(self):
        self.assertEqual(_upload(self.client, "SHOT.PNG").json()["type"], "ok")

    def test_missing_file_field_is_a_400(self):
        response = self.client.post(UPLOAD_URL, {})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"type": "error", "reason": "No file part in the request"})

    def test_disallowed_extension_is_a_400(self):
        response = _upload(self.client, "shot.txt")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"type": "error", "reason": "File type not allowed"})
        self.assertFalse(QuestionImage.objects.exists())

    def test_extensionless_filename_is_a_400(self):
        response = _upload(self.client, "png")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"type": "error", "reason": "File type not allowed"})

    def test_exactly_5mb_is_still_accepted(self):
        # The limit is strict "greater than" — an upload of exactly
        # 5MB passes (and the size is now checked before reading)
        exact = PNG_BYTES + b"\x00" * (5 * 1024 * 1024 - len(PNG_BYTES))
        response = _upload(self.client, "exact.png", content=exact)
        self.assertEqual(response.json()["type"], "ok")

    def test_oversized_file_is_a_400(self):
        big = PNG_BYTES + b"\x00" * (5 * 1024 * 1024)
        response = _upload(self.client, "big.png", content=big)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"type": "error", "reason": "File is too large"})
        self.assertFalse(QuestionImage.objects.exists())








############################################################
# GET /api/phishingpictures/<id> — serving the bytes
############################################################

class GetPictureTests(TestCase):

    def setUp(self):
        create_student()
        login_student(self.client)

    def test_requires_login(self):
        question = create_question()
        self.assertEqual(Client().get(f"{UPLOAD_URL}/{question.id}").status_code, 401)

    def test_mimetype_is_sniffed_from_the_magic_bytes(self):
        for image_bytes, expected_type in [
            (PNG_BYTES, "image/png"),
            (JPEG_BYTES, "image/jpeg"),
            (GIF_BYTES, "image/gif"),
            (b"plain bytes with no magic", "application/octet-stream"),
        ]:
            question = create_question(image_bytes=image_bytes)
            response = self.client.get(f"{UPLOAD_URL}/{question.id}")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response["Content-Type"], expected_type)
            self.assertEqual(response.content, image_bytes)

    def test_unknown_question_is_a_404(self):
        self.assertEqual(self.client.get(f"{UPLOAD_URL}/424242").status_code, 404)

    def test_picture_survives_question_deletion_via_the_frozen_snapshot(self):
        question = create_question(image_bytes=JPEG_BYTES)
        student = create_student(username="DEALT")
        Answer.objects.create(
            student=student, question_id=question.id, question_text="",
            image_id=question.image_id, is_phishing=1, answer_status=1,
        )
        question_id = question.id
        question.delete()

        response = self.client.get(f"{UPLOAD_URL}/{question_id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, JPEG_BYTES)

    def test_deleted_question_without_snapshot_is_a_404(self):
        question = create_question()
        question_id = question.id
        question.delete()
        self.assertEqual(self.client.get(f"{UPLOAD_URL}/{question_id}").status_code, 404)








############################################################
# GET/POST /api/phishingpictures/<id>/links
############################################################

class PictureLinksTests(TestCase):

    def setUp(self):
        create_admin()
        login_admin(self.client)
        self.question = create_question()

    def _links_url(self, question_id=None):
        return f"{UPLOAD_URL}/{question_id or self.question.id}/links"

    def test_get_converts_coordinates_to_inflated_percentages(self):
        # Fractions ×101 (not ×100), truncated — the frontend
        # positions its overlays with exactly these values
        link = QuestionLink.objects.create(
            image_id=self.question.image_id, title="", content="https://apgaule.example",
            x="0.25", y="0.5", w="0.1", h=None,
        )

        self.assertEqual(self.client.get(self._links_url()).json(), [{
            "id": link.id,
            "url": "https://apgaule.example",
            "x": "25%",
            "y": "50%",
            "width": "10%",
            "height": None,
        }])

    def test_get_is_allowed_for_students(self):
        create_student()
        student_client = Client()
        login_student(student_client)
        self.assertEqual(student_client.get(self._links_url()).json(), [])

    def test_post_replaces_all_areas(self):
        QuestionLink.objects.create(image_id=self.question.image_id, content="https://sena.example", x="0.9", y="0.9")

        response = post_json(self.client, self._links_url(), {"areas": [
            {"url": "https://nauja.example", "x": 0.1, "y": 0.2, "width": 0.3, "height": 0.4},
        ]})
        self.assertEqual(response.content, b"OK")

        link = QuestionLink.objects.get()     # the old link is gone
        self.assertEqual(link.image_id, self.question.image_id)
        self.assertEqual(link.content, "https://nauja.example")
        self.assertEqual(link.title, "")
        self.assertEqual((link.x, link.y, link.w, link.h), ("0.1", "0.2", "0.3", "0.4"))

    def test_post_without_areas_changes_nothing(self):
        QuestionLink.objects.create(image_id=self.question.image_id, content="https://lieka.example", x="0.1", y="0.1")
        response = post_json(self.client, self._links_url(), {"kita": 1})
        self.assertEqual(response.content, b"OK")
        self.assertEqual(QuestionLink.objects.count(), 1)

    def test_post_requires_admin(self):
        create_student()
        student_client = Client()
        login_student(student_client)
        response = post_json(student_client, self._links_url(), {"areas": []})
        self.assertEqual(response.content, b"Error: Not Admin")

    def test_post_invalid_body_is_a_400(self):
        response = self.client.post(self._links_url(), data="not json", content_type="application/json")
        self.assertEqual(response.status_code, 400)

    def test_links_survive_question_deletion_via_the_frozen_snapshot(self):
        link = QuestionLink.objects.create(image_id=self.question.image_id, content="https://islieka.example", x="0.5", y="0.5")
        student = create_student()
        Answer.objects.create(
            student=student, question_id=self.question.id, question_text="",
            image_id=self.question.image_id, is_phishing=1, answer_status=1,
        )
        question_id = self.question.id
        self.question.delete()

        [row] = self.client.get(self._links_url(question_id)).json()
        self.assertEqual(row["id"], link.id)
        self.assertEqual(row["url"], "https://islieka.example")
