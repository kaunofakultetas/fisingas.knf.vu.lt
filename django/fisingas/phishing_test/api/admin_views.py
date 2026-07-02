############################################################
#  [*] Admin endpoints of the phishing test
#
#    GET  /api/admin/home                        — dashboard data
#    GET  /api/admin/students/<id>/answers       — graded answers
#    GET  /api/admin/studentgroups               — groups list
#    GET  /api/admin/questions                   — question bank
#    POST /api/admin/questions/<action>          — edit questions
#    POST /api/admin/update/phishingtestsize     — setting
############################################################


from datetime import datetime, timedelta

from django.http import HttpResponse, JsonResponse

from fisingas.common.auth import get_json, login_required
from fisingas.users.models import Setting, Student, StudentGroup
from ..grading import judge_student
from ..models import Answer, Question, QuestionOption




@login_required
def admin_home(request):
    """GET /api/admin/home — counters + progress of recently active students."""
    if not request.current_user.admin:
        return JsonResponse({})

    timeNow_minus30min = (datetime.now() - timedelta(minutes=30)).strftime("%Y-%m-%d %H:%M:%S")


    # Progress of students seen in the last 30 minutes (string
    # comparison works because LastLogin is "YYYY-MM-DD HH:MM:SS")
    studentsProgress = []
    for student in Student.objects.filter(last_login__gt=timeNow_minus30min).order_by("id"):
        answers = list(Answer.objects.filter(student_id=student.id))
        if not answers:
            continue

        studentsProgress.append({
            "studentid": student.id,
            "username": student.username,
            "questioncount": len(answers),
            "answeredquestioncount": sum(1 for answer in answers if answer.answer_status is not None),
            "isfinished": student.is_finished,
            "lastlogin": student.last_login,
        })


    try:
        phishingTestSize = int(Setting.objects.get(name="PhishingTestSize").value)
    except Setting.DoesNotExist:
        phishingTestSize = None

    return JsonResponse({
        "studentscount": Student.objects.count(),
        "enabledquestionscount": Question.objects.filter(is_enabled=1).count(),
        "totalquestionscount": Question.objects.count(),
        "phishingtestsize": phishingTestSize,
        "studentsprogress": studentsProgress,
    })




@login_required
def student_answers(request, studentID):
    """GET /api/admin/students/<id>/answers — the graded test, question by question."""
    if not request.current_user.admin:
        if studentID == request.current_user.userid:
            # Students may read their own answers (finished-test page)
            pass
        else:
            return HttpResponse("Error: Not Admin")

    return JsonResponse([
        {
            "id": result.question_id,
            "questiontext": result.question_text,
            "isphishinganswer": result.answer,
            "isphishing": result.is_phishing,
            "totaloptionscount": result.total_options,
            "correctoptionscount": result.correct_options,
            "answerpoints": f"{result.points:.2f}",
            "answeredoptions": [
                {
                    "optiontext": option.option_text,
                    "rightansweroption": option.right_answer,
                    "selectedansweroption": option.selected,
                }
                for option in result.options
            ],
        }
        for result in judge_student(studentID)
    ], safe=False)




@login_required
def studentgroups(request):
    """GET /api/admin/studentgroups — all groups, newest first."""
    if not request.current_user.admin:
        return HttpResponse("Error: Not Admin")

    return JsonResponse([
        {
            "id": group.id,
            "name": group.name,
            "description": group.description,
            "showanswers": group.show_answers,
            "timelimit": group.time_limit,
        }
        for group in StudentGroup.objects.order_by("-id")
    ], safe=False)




@login_required
def questions_list(request):
    """GET /api/admin/questions — the whole question bank + counters."""
    if not request.current_user.admin:
        return HttpResponse("Error: Not Admin")

    questions = list(Question.objects.order_by("-id").only(
        "id", "is_phishing", "question", "created",
    ))

    optionsByQuestion = {}
    for option in QuestionOption.objects.order_by("id"):
        optionsByQuestion.setdefault(option.question_id, []).append(option)

    phishingCount = sum(question.is_phishing for question in questions) if questions else None

    return JsonResponse({
        "questioncount": len(questions),
        "phishingcount": phishingCount,
        "goodcount": len(questions) - phishingCount if questions else None,
        "questions": [
            {
                "questionid": question.id,
                "isphishing": question.is_phishing,
                "questiontext": question.question,
                "questionoptions": [
                    {
                        "optionid": option.id,
                        "optiontext": option.option_text,
                        "rightoptionanswer": option.answer_status,
                    }
                    for option in optionsByQuestion.get(question.id, [])
                ],
                "created": question.created,
            }
            for question in questions
        ],
    })




@login_required
def questions_update(request, action):
    """POST /api/admin/questions/<action> — createnewoption / updatequestion."""
    if not request.current_user.admin:
        return HttpResponse("Error: Not Admin", status=403)

    postData = get_json(request)
    questionID = postData["questionid"]


    if action == "createnewoption":
        newOption = QuestionOption.objects.create(
            question_id=questionID,
            option_text="",
            answer_status=None,
        )
        return JsonResponse({"new_option_id": newOption.id})


    elif action == "updatequestion":
        Question.objects.filter(id=questionID).update(
            is_phishing=postData["isphishing"],
            question=postData["questiontext"],
        )
        for questionOption in postData["questionoptions"]:
            QuestionOption.objects.filter(id=questionOption["optionid"]).update(
                option_text=questionOption["optiontext"],
                answer_status=questionOption["rightoptionanswer"],
            )
        return JsonResponse({"status": "ok"})


    return HttpResponse(status=404)




@login_required
def update_phishingtestsize(request):
    """POST /api/admin/update/phishingtestsize — how many questions a test deals."""
    if not request.current_user.admin:
        return HttpResponse("Error: Not Admin", status=403)

    postData = get_json(request)
    testSize = int(postData["phishingtestsize"])

    Setting.objects.update_or_create(name="PhishingTestSize", defaults={"value": str(testSize)})

    return JsonResponse({"status": "ok"})
