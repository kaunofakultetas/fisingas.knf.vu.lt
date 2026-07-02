############################################################
#  [*] Public leaderboard endpoints (no authentication)
#
#    GET /api/leaderboard           — live grades of everyone
#    GET /api/leaderboard/nextslide — a random projector slide
############################################################


import os
import random

from django.http import FileResponse, JsonResponse

from fisingas.phishing_test.grading import judge_all_students, summarize
from fisingas.users.models import Student


ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}




def leaderboard(request):
    """GET /api/leaderboard — one row per student, newest first."""
    results_by_student = judge_all_students()

    rows = []
    for student in Student.objects.order_by("-id"):
        question_results = results_by_student.get(student.id, [])
        summary = summarize(question_results)

        rows.append({
            "id": student.id,
            "username": student.username,

            "questioncount": summary.question_count if summary else "",
            "answeredquestioncount": (
                sum(1 for result in question_results if result.answer is not None)
                if question_results else None
            ),

            "testgrade": summary.test_grade if summary else "",

            "isfinished": student.is_finished,
            "lastseen": student.last_login,
        })

    return JsonResponse(rows, safe=False)




def nextslide(request):
    """GET /api/leaderboard/nextslide — a random image from the slides directory."""

    SLIDES_DIRECTORY = os.getenv("SLIDES_DIRECTORY", "/slides")

    if not os.path.isdir(SLIDES_DIRECTORY):
        return JsonResponse({"error": "Slides directory not found"}, status=404)

    image_files = [
        f for f in os.listdir(SLIDES_DIRECTORY)
        if os.path.isfile(os.path.join(SLIDES_DIRECTORY, f))
        and os.path.splitext(f)[1].lower() in ALLOWED_EXTENSIONS
    ]

    if not image_files:
        return JsonResponse({"error": "No slide images found"}, status=404)

    random_image = random.choice(image_files)

    return FileResponse(open(os.path.join(SLIDES_DIRECTORY, random_image), "rb"))
