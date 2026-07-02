############################################################
#  [*] Student test-taking endpoints
#
#    GET  /api/student/questions — deal (first call) and return
#                                  the student's questions
#    POST /api/student/questions — save verdicts + checkboxes
#    GET  /api/student/finish    — lock the test
#
#  Dealing FREEZES the questions: the text, correct verdict,
#  image link and every option are copied into
#  Answer/AnswerSelectedOption, and both the test screens and
#  the grades are built from those copies only (see models.py
#  / grading.py). Admins can edit or delete bank questions
#  without touching tests that are already in progress.
############################################################


import random
from datetime import datetime

from django.http import HttpResponse, JsonResponse

from fisingas.common.auth import get_json, login_required
from fisingas.users.models import Setting, Student
from ..models import Answer, AnswerSelectedOption, Question, QuestionLink, QuestionOption








############################################################
# _deal_questions (helper)
############################################################
#
# First call of the test: pick PhishingTestSize random
# enabled questions and snapshot them for this student.
#
# Two frozen copies are written:
#   Answer               — one per question: its text, the
#                          correct verdict and the image link
#   AnswerSelectedOption — one per option: its text and the
#                          expected checkbox value
#
# From this point on the live question bank is out of the
# picture for this student.
#
# Used by:
#   - student_questions (below), on the first GET
############################################################

def _deal_questions(studentID):
    try:
        testSize = int(Setting.objects.get(name="PhishingTestSize").value)
    except Setting.DoesNotExist:
        testSize = 30

    # min() protects random.sample when the bank is smaller
    # than the configured test size
    dealtQuestions = random.sample(
        list(Question.objects.filter(is_enabled=1).only("id", "question", "is_phishing", "image_id")),
        k=min(testSize, Question.objects.filter(is_enabled=1).count()),
    )

    # answer_status / is_selected start as NULL = "not answered
    # yet"; the POST handler fills them in as the student clicks
    Answer.objects.bulk_create([
        Answer(
            student_id=studentID,
            question_id=question.id,
            question_text=question.question,
            image_id=question.image_id,
            is_phishing=question.is_phishing,
            answer_status=None,
        )
        for question in dealtQuestions
    ])

    AnswerSelectedOption.objects.bulk_create([
        AnswerSelectedOption(
            student_id=studentID,
            question_id=option.question_id,
            option_id=option.id,
            option_text=option.option_text,
            right_answer=option.answer_status,
            is_selected=None,
        )
        for option in QuestionOption.objects.filter(question_id__in=[question.id for question in dealtQuestions])
    ])








############################################################
# _questions_response (helper)
############################################################
#
# The student's test, built entirely from the frozen
# snapshots. Question order is shuffled on every request —
# the frontend keeps its own order once loaded.
#
# Used by:
#   - student_questions (below), on every GET
############################################################

def _questions_response(studentID):
    answers = list(Answer.objects.filter(student_id=studentID))
    random.shuffle(answers)

    # Both lookups grouped in one query each, instead of one
    # query per question
    selectionsByQuestion = {}
    for selection in AnswerSelectedOption.objects.filter(student_id=studentID).order_by("option_id"):
        selectionsByQuestion.setdefault(selection.question_id, []).append(selection)

    # Tooltip links hang off the frozen IMAGE, not the question —
    # they survive question deletion together with the image
    linksByImage = {}
    for link in QuestionLink.objects.filter(image_id__in=[answer.image_id for answer in answers]):
        linksByImage.setdefault(link.image_id, []).append(link)

    return [
        {
            "questionid": answer.question_id,
            "selectedanswer": answer.answer_status,
            "question": answer.question_text,
            "questionoptions": [
                {
                    "answeroptionid": selection.option_id,
                    "answeroption": selection.option_text,
                    "isselected": selection.is_selected,
                }
                for selection in selectionsByQuestion.get(answer.question_id, [])
            ],
            "questionlinks": [
                {
                    "title": link.title,
                    "content": link.content,
                    "x": link.x,
                    "y": link.y,
                }
                for link in linksByImage.get(answer.image_id, [])
            ],
        }
        for answer in answers
    ]








############################################################
# student_questions
############################################################
#
# GET  /api/student/questions — the student's test. The very
#      first call deals (freezes) the questions; every call
#      after that returns the same frozen set with whatever
#      the student answered so far.
# POST /api/student/questions — saves the current state: the
#      Real/Phishing verdict of each question and every
#      checkbox. Called on each click, so a student can
#      close the browser and continue later.
#
# Admins get an empty {} — the test is for students only.
# So does a student whose test is already finished: the
# frozen answers then live on in the summary endpoints.
#
# Used by:
#   - TestHome.jsx — the test-taking page (GET on load,
#     POST on every answer)
############################################################

@login_required
def student_questions(request):
    timeNow = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if not request.current_user.admin:
        studentID = request.current_user.userid

        # Every touch of the test counts as activity — this is
        # what the dashboard's 30-minute progress list keys on
        Student.objects.filter(id=studentID).update(last_login=timeNow)

        # A finished test is locked — no reading, no writing
        if Student.objects.get(id=studentID).is_finished == 1:
            return JsonResponse({})


        if request.method == "GET":
            # No answers yet = first visit → deal the test now
            if not Answer.objects.filter(student_id=studentID).exists():
                _deal_questions(studentID)

            return JsonResponse(_questions_response(studentID), safe=False)


        elif request.method == "POST":
            for questionJson in get_json(request):
                if "questionid" not in questionJson:
                    return HttpResponse("Error: This is not questions state object")

                # The Real/Phishing verdict of this question...
                Answer.objects.filter(
                    student_id=studentID,
                    question_id=questionJson["questionid"],
                ).update(answer_status=questionJson["selectedanswer"])

                # ...and each of its checkboxes. Filtering by the
                # student's own snapshot rows means a forged ID can
                # never write into someone else's test
                for questionOptionJson in questionJson["questionoptions"]:
                    if "answeroptionid" not in questionOptionJson:
                        return HttpResponse("Error: This is not questions state object")

                    AnswerSelectedOption.objects.filter(
                        student_id=studentID,
                        question_id=questionJson["questionid"],
                        option_id=questionOptionJson["answeroptionid"],
                    ).update(is_selected=questionOptionJson["isselected"])

            return HttpResponse("OK")

    return JsonResponse({})








############################################################
# student_finish
############################################################
#
# GET /api/student/finish — mark the test as finished. There
# is no way back: student_questions refuses a finished test,
# and the grade is computed from the answers as they were at
# this moment (unanswered questions count as wrong).
#
# Used by:
#   - TestFinish.jsx — the "finish test" confirmation page
############################################################

@login_required
def student_finish(request):
    timeNow = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if not request.current_user.admin:
        Student.objects.filter(id=request.current_user.userid).update(
            last_login=timeNow,
            is_finished=1,
        )

    return JsonResponse({})
