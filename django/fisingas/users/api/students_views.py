############################################################
#  [*] Student endpoints
#
#    GET  /api/admin/students                — admin students table
#    GET  /api/admin/students/<id>           — one student (also used
#                                              by the student's own
#                                              results page)
#    POST /api/admin/students/<id>/delete    — remove the account
#    POST /api/student/register              — public self-registration
############################################################


import random
import re
from datetime import datetime

from django.http import HttpResponse, JsonResponse

from fisingas.common.auth import get_json, login_required
from fisingas.phishing_test.grading import judge_unfinished_students, stored_summaries, student_summary, summarize
from fisingas.users.models import Student








############################################################
# _student_row (helper)
############################################################
#
# One student as a JSON row — account fields plus their
# grading totals (a TestSummary: frozen for finished
# students, judged live otherwise — see grading.py). The
# blank-field contract the frontend expects: students who
# never started the test (summary is None) get "" for the
# grade columns but null for answeredquestioncount.
#
# Used by:
#   - students_list (below)  — one row per student
#   - student_detail (below) — a single row
############################################################

def _student_row(student, summary):
    return {
        "id": student.id,
        "username": student.username,
        "passcode": student.passcode,

        "questioncount": summary.question_count if summary else "",
        "answeredquestioncount": summary.answered_question_count if summary else None,
        "totalidentifiedcorrectly": summary.total_identified_correctly if summary else "",

        "fullycorrectcount": summary.fully_correct_count if summary else "",
        "fullycorrectpercentage": summary.fully_correct_percentage if summary else "",

        "totaloptionscount": summary.total_options_count if summary else "",
        "totalcorrectoptionscount": summary.total_correct_options_count if summary else "",

        "testgrade": summary.test_grade if summary else "",

        "isfinished": student.is_finished,
        "lastseen": student.last_login,
        "registrationtime": student.registration_time,
        "status": student.status,
    }








############################################################
# students_list
############################################################
#
# GET /api/admin/students — every student, newest first,
# each with their full grading totals. Finished students
# come straight from their frozen TestResult rows (one
# query); only the ones still taking the test are graded
# live, in one pass (judge_unfinished_students) instead of
# one query per row.
#
# Used by:
#   - StudentsListTable.jsx — the admin students table
############################################################

@login_required
def students_list(request):
    if not request.current_user.admin:
        return HttpResponse("Error: Not Admin")

    frozen = stored_summaries()
    live = judge_unfinished_students()

    return JsonResponse([
        _student_row(student, frozen.get(student.id) or summarize(live.get(student.id, [])))
        for student in Student.objects.order_by("-id")
    ], safe=False)








############################################################
# student_detail
############################################################
#
# GET /api/admin/students/<id> — one student's row.
#
# Not admin-only: a student may read their own row (the
# finished-test summary page shows their grade through this
# endpoint), just nobody else's.
#
# Used by:
#   - StudentInformation.jsx — the admin student page
#   - TestFinish.jsx         — the student's own summary
############################################################

@login_required
def student_detail(request, studentID):
    if not request.current_user.admin:
        if studentID == request.current_user.userid:
            # Students may read their own row (finished-test summary page)
            pass
        else:
            return HttpResponse("Error: Not Admin")

    try:
        student = Student.objects.get(id=studentID)
    except Student.DoesNotExist:
        return HttpResponse("Error: Student not found", status=404)

    return JsonResponse(_student_row(student, student_summary(student)))








############################################################
# student_delete
############################################################
#
# POST /api/admin/students/<id>/delete — remove the student
# account for good, together with their dealt test and
# grades (the answer snapshots CASCADE with the account).
# The question images stay — they live in the upload-only
# QuestionImage table.
#
# Used by:
#   - StudentInformation.jsx — the hold-to-delete button
############################################################

@login_required
def student_delete(request, studentID):
    if not request.current_user.admin:
        return HttpResponse("Error: Not Admin", status=403)
    if request.method != "POST":
        return HttpResponse(status=405)

    deleted, _ = Student.objects.filter(id=studentID).delete()
    if not deleted:
        return HttpResponse("Error: Student not found", status=404)

    return JsonResponse({"status": "ok"})








############################################################
# student_register
############################################################
#
# POST /api/student/register — public self-registration,
# body {username}. The username is uppercased and stripped
# to A-Z, 0-9 and underscore; the response carries the
# generated 8-digit access code the student will log in
# with. Duplicate names are refused with a Lithuanian
# error message the login page shows verbatim.
#
# This is the only unauthenticated POST endpoint, so the
# body is validated instead of trusted: a malformed body or
# a name with no valid characters left is refused.
#
# Used by:
#   - Login.jsx — the "create account" form
############################################################

def student_register(request):
    postData = get_json(request)
    if postData is None or not isinstance(postData.get("username"), str):
        return JsonResponse({"status": "error", "error": "Neteisinga užklausa"}, status=400)

    username = re.sub(r"[^A-Z0-9_]", "", postData["username"].upper())
    if not username:
        return JsonResponse({"status": "error", "error": "Įveskite prisijungimo vardą"})


    if not Student.objects.filter(username=username).exists():
        accessCode = str(random.randint(10**7, 10**8 - 1))
        Student.objects.create(
            username=username,
            passcode=accessCode,
            is_finished=0,
            last_login="",
            status=1,
            registration_time=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        )
        return JsonResponse({
            "status": "OK",
            "username": username,
            "accessCode": accessCode,
        })

    else:
        return JsonResponse({
            "status": "error",
            "error": "Vartotojas tokiu vardu jau registruotas",
        })
