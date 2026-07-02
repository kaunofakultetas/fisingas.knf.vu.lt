############################################################
#  [*] Admin endpoints of the phishing test
#
#  Everything the React admin UI needs to run the show: the
#  dashboard, the graded answers of a student, the groups
#  list, and the question bank editor.
#
#    GET  /api/admin/home                    — dashboard data
#    GET  /api/admin/students/<id>/answers   — graded answers
#    GET  /api/admin/studentgroups           — groups list
#    GET  /api/admin/questions               — question bank
#    POST /api/admin/questions/<action>      — edit questions
#    POST /api/admin/update/phishingtestsize — setting
############################################################


from datetime import datetime, timedelta

from django.http import HttpResponse, JsonResponse

from fisingas.common.auth import get_json, login_required
from fisingas.users.models import Setting, Student, StudentGroup
from ..grading import judge_student
from ..models import Answer, Question, QuestionOption








############################################################
# admin_home
############################################################
#
# GET /api/admin/home — the dashboard: student and question
# counters, the current test size setting, and the live
# progress of every student seen in the last 30 minutes.
#
# Used by:
#   - Home.jsx            — the admin dashboard page
#   - StudentProgress.jsx — the live progress widget on it
############################################################

@login_required
def admin_home(request):
    if not request.current_user.admin:
        return JsonResponse({})

    timeNow_minus30min = (datetime.now() - timedelta(minutes=30)).strftime("%Y-%m-%d %H:%M:%S")


    # Progress of students seen in the last 30 minutes (string
    # comparison works because LastLogin is "YYYY-MM-DD HH:MM:SS").
    # Students who were dealt no questions yet are left out — there
    # is no progress to show for them
    studentsProgress = []
    for student in Student.objects.filter(last_login__gt=timeNow_minus30min).order_by("id"):
        answers = list(Answer.objects.filter(student_id=student.id))
        if not answers:
            continue

        studentsProgress.append({
            "studentid": student.id,
            "username": student.username,

            # "answered / dealt" — answer_status stays NULL until
            # the student actually picks Real or Phishing
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








############################################################
# student_answers
############################################################
#
# GET /api/admin/students/<id>/answers — the graded test of
# one student, question by question, with the per-option
# verdicts. All content comes from the FROZEN answer
# snapshots (see grading.py), so this view keeps working —
# and keeps showing the same grade — even after the original
# questions are edited or deleted.
#
# Not admin-only: a student may read their own answers (the
# finished-test summary page), just nobody else's.
#
# Used by:
#   - StudentAnswers.jsx          — admin answer review
#   - StudentTestSummaryTable.jsx — condensed summary table
#     (also embedded in the student's own TestFinish page)
############################################################

@login_required
def student_answers(request, studentID):
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

            # The student's verdict vs the frozen correct one
            "isphishinganswer": result.answer,
            "isphishing": result.is_phishing,

            "totaloptionscount": result.total_options,
            "correctoptionscount": result.correct_options,

            # Two decimals as text — the frontend prints it as-is
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








############################################################
# studentgroups
############################################################
#
# GET /api/admin/studentgroups — all groups, newest first.
# Groups carry the per-group test settings (show answers
# after finishing, time limit).
#
# Used by:
#   - StudentGroupsTable.jsx — the groups admin page
############################################################

@login_required
def studentgroups(request):
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








############################################################
# questions_list
############################################################
#
# GET /api/admin/questions — the whole LIVE question bank
# (newest first) with every question's options, plus the
# phishing/good counters shown above the list.
#
# This is the editable bank — changes here never touch the
# frozen snapshots that grades are built from.
#
# Used by:
#   - Questions.jsx — the question bank admin page
############################################################

@login_required
def questions_list(request):
    if not request.current_user.admin:
        return HttpResponse("Error: Not Admin")

    questions = list(Question.objects.order_by("-id").only(
        "id", "is_phishing", "question", "created",
    ))

    # All options in one query, grouped by question, instead of
    # one query per question
    optionsByQuestion = {}
    for option in QuestionOption.objects.order_by("id"):
        optionsByQuestion.setdefault(option.question_id, []).append(option)

    # An empty bank reports null counters, not zeros — the
    # frontend expects that
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








############################################################
# questions_update
############################################################
#
# POST /api/admin/questions/<action> — edits to the live
# question bank. Two actions exist:
#
#   createnewoption — adds an empty option to a question and
#                     returns its new ID (the UI edits it
#                     in place afterwards)
#   updatequestion  — saves the question's verdict + text
#                     and the text/answer of every option
#
# Only the LIVE bank changes — tests that were already dealt
# keep their frozen copies and their grades.
#
# Used by:
#   - QuestionsList.jsx — autosaves updatequestion on edit
#     (no save button) and calls createnewoption from the
#     "add option" button
############################################################

@login_required
def questions_update(request, action):
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








############################################################
# update_phishingtestsize
############################################################
#
# POST /api/admin/update/phishingtestsize — how many random
# questions a new test deals to a student. Stored in the
# key-value Settings table; already-dealt tests keep their
# size.
#
# Used by:
#   - Home.jsx — the test size input on the dashboard
############################################################

@login_required
def update_phishingtestsize(request):
    if not request.current_user.admin:
        return HttpResponse("Error: Not Admin", status=403)

    postData = get_json(request)
    testSize = int(postData["phishingtestsize"])

    Setting.objects.update_or_create(name="PhishingTestSize", defaults={"value": str(testSize)})

    return JsonResponse({"status": "ok"})
