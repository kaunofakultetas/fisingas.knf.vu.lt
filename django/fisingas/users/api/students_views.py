############################################################
#  [*] Student endpoints
#
#    GET  /api/admin/students          — admin students table
#    GET  /api/admin/students/<id>     — one student (also used
#                                        by the student's own
#                                        results page)
#    POST /api/student/register        — public self-registration
############################################################


import random
import re

from django.http import HttpResponse, JsonResponse

from fisingas.common.auth import get_json, login_required
from fisingas.phishing_test.grading import judge_all_students, judge_student, summarize
from fisingas.users.models import Student




def _student_row(student, question_results):
    """
    One row of the students table — same keys and blank-field
    behaviour as the Flask SQL (IFNULL(x, '') for the grade
    columns, JSON null for the progress of students who never
    started).
    """
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




@login_required
def students_list(request):
    """GET /api/admin/students — every student, newest first."""
    if not request.current_user.admin:
        return HttpResponse("Error: Not Admin")

    results_by_student = judge_all_students()

    return JsonResponse([
        _student_row(student, results_by_student.get(student.id, []))
        for student in Student.objects.select_related("group").order_by("-id")
    ], safe=False)




@login_required
def student_detail(request, studentID):
    """GET /api/admin/students/<id> — admins, or the student themselves."""
    if not request.current_user.admin:
        if studentID == request.current_user.userid:
            # Students may read their own row (finished-test summary page)
            pass
        else:
            return HttpResponse("Error: Not Admin")

    student = Student.objects.select_related("group").get(id=studentID)

    return JsonResponse(_student_row(student, judge_student(studentID)))




def student_register(request):
    """POST /api/student/register — body {username}, returns the access code."""
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
