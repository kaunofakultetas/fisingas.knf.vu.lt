############################################################
#  [*] Student endpoints
#
#    GET  /api/admin/students      — admin students table
#    GET  /api/admin/students/<id> — one student (also used by
#                                    the student's own results
#                                    page)
#    POST /api/student/register    — public self-registration
############################################################


import random
import re

from django.http import HttpResponse, JsonResponse

from fisingas.common.auth import get_json, login_required
from fisingas.phishing_test.grading import judge_all_students, judge_student, summarize
from fisingas.users.models import Student








############################################################
# _student_row (helper)
############################################################
#
# One student as a JSON row — account fields plus their
# grading totals. The blank-field contract the frontend
# expects: students who never started the test get "" for
# the grade columns but null for answeredquestioncount.
#
# Used by:
#   - students_list (below)  — one row per student
#   - student_detail (below) — a single row
############################################################

def _student_row(student, question_results):
    summary = summarize(question_results)
    answered_count = sum(1 for result in question_results if result.answer is not None)

    return {
        "id": student.id,
        "username": student.username,
        "passcode": student.passcode,
        "groupname": student.group.name if student.group else None,

        "questioncount": summary.question_count if summary else "",
        "answeredquestioncount": answered_count if question_results else None,
        "totalidentifiedcorrectly": summary.total_identified_correctly if summary else "",

        "fullycorrectcount": summary.fully_correct_count if summary else "",
        "fullycorrectpercentage": summary.fully_correct_percentage if summary else "",

        "totaloptionscount": summary.total_options_count if summary else "",
        "totalcorrectoptionscount": summary.total_correct_options_count if summary else "",

        "testgrade": summary.test_grade if summary else "",

        "isfinished": student.is_finished,
        "lastseen": student.last_login,
        "status": student.status,
    }








############################################################
# students_list
############################################################
#
# GET /api/admin/students — every student, newest first,
# each with their full grading totals. Grades everyone in
# one pass (judge_all_students) instead of one query per
# row.
#
# Used by:
#   - StudentsListTable.jsx — the admin students table
############################################################

@login_required
def students_list(request):
    if not request.current_user.admin:
        return HttpResponse("Error: Not Admin")

    results_by_student = judge_all_students()

    return JsonResponse([
        _student_row(student, results_by_student.get(student.id, []))
        for student in Student.objects.select_related("group").order_by("-id")
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

    student = Student.objects.select_related("group").get(id=studentID)

    return JsonResponse(_student_row(student, judge_student(studentID)))








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
# Used by:
#   - Login.jsx — the "create account" form
############################################################

def student_register(request):
    postData = get_json(request)
    username = re.sub(r"[^A-Z0-9_]", "", postData["username"].upper())


    if not Student.objects.filter(username=username).exists():
        accessCode = str(random.randint(10**7, 10**8 - 1))
        Student.objects.create(
            group=None,
            username=username,
            passcode=accessCode,
            is_finished=0,
            last_login="",
            status=1,
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
