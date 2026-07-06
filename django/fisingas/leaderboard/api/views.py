############################################################
#  [*] Public leaderboard endpoints (no authentication)
#
#  The data behind the projector view (/leaderboard and
#  /slides on the frontend) shown during events. Public on
#  purpose — no session required, students watch it on the
#  big screen.
#
#    GET /api/leaderboard           — live grades of everyone
#    GET /api/leaderboard/nextslide — a random projector slide
############################################################


import os
import random

from django.http import FileResponse, JsonResponse

from fisingas.phishing_test.grading import judge_unfinished_students, stored_summaries, summarize
from fisingas.users.models import Student


# Slide files with any other extension are ignored — the
# filebrowser lets admins drop anything into the directory
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}








############################################################
# leaderboard
############################################################
#
# GET /api/leaderboard — one row per student, newest first.
#
# Finished students come straight from their frozen
# TestResult rows (one query); only the ones still taking
# the test are graded live, in one pass over the frozen
# answer snapshots (see phishing_test/grading.py) — the page
# refreshes every few seconds on the projector, so this
# endpoint has to stay cheap.
#
# Response shape the frontend depends on:
#   - students who never dealt a test get "" for the counts
#     and the grade, not null
#   - answeredquestioncount is null (not "") in that case
#
# Used by:
#   - LeaderboardTable.jsx — polls this every few seconds
############################################################

def leaderboard(request):
    frozen = stored_summaries()
    live = judge_unfinished_students()

    rows = []
    for student in Student.objects.order_by("-id"):
        summary = frozen.get(student.id) or summarize(live.get(student.id, []))

        rows.append({
            "id": student.id,
            "username": student.username,

            # How many questions were dealt vs actually answered —
            # the table shows progress as "answered / dealt"
            "questioncount": summary.question_count if summary else "",
            "answeredquestioncount": summary.answered_question_count if summary else None,

            "testgrade": summary.test_grade if summary else "",

            "isfinished": student.is_finished,
            "lastseen": student.last_login,
        })

    return JsonResponse(rows, safe=False)








############################################################
# nextslide
############################################################
#
# GET /api/leaderboard/nextslide — a random image from the
# slides directory, served as raw bytes.
#
# The directory is the filebrowser "slides" share
# (_DATA/slides/ on the host, mounted into this container),
# so admins manage the slide deck by just uploading and
# deleting files — no database involved.
#
# Used by:
#   - Slides.jsx — alternates between the leaderboard iframe
#     and a fresh slide fetched from here
############################################################

def nextslide(request):
    SLIDES_DIRECTORY = os.getenv("SLIDES_DIRECTORY", "/slides")

    if not os.path.isdir(SLIDES_DIRECTORY):
        return JsonResponse({"error": "Slides directory not found"}, status=404)

    # Only plain image files count — subdirectories and stray
    # uploads (pdf, pptx, ...) are skipped
    image_files = [
        f for f in os.listdir(SLIDES_DIRECTORY)
        if os.path.isfile(os.path.join(SLIDES_DIRECTORY, f))
        and os.path.splitext(f)[1].lower() in ALLOWED_EXTENSIONS
    ]

    if not image_files:
        return JsonResponse({"error": "No slide images found"}, status=404)

    random_image = random.choice(image_files)

    # FileResponse closes the file handle itself and sniffs the
    # Content-Type from the filename
    return FileResponse(open(os.path.join(SLIDES_DIRECTORY, random_image), "rb"))
