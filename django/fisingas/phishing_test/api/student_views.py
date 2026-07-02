############################################################
#  [*] Student test-taking endpoints
#
#    GET  /api/student/questions — deal (first call) and return
#                                  the student's questions
#    POST /api/student/questions — save verdicts + checkboxes
#    GET  /api/student/finish    — lock the test
#
#  Dealing FREEZES the questions: the text, correct verdict and
#  every option are copied into Answer/AnswerSelectedOption, and
#  both the test screens and the grades are built from those
#  copies only (see models.py / grading.py).
############################################################


import random
from datetime import datetime

from django.http import HttpResponse, JsonResponse

from fisingas.common.auth import get_json, login_required
from fisingas.users.models import Setting, Student
from ..models import Answer, AnswerSelectedOption, Question, QuestionLink, QuestionOption




def _deal_questions(studentID):
    """
    First call of the test: pick PhishingTestSize random enabled
    questions and snapshot them (with their image link and their
    options) for this student.
    """
    try:
        testSize = int(Setting.objects.get(name="PhishingTestSize").value)
    except Setting.DoesNotExist:
        testSize = 30

    dealtQuestions = random.sample(
        list(Question.objects.filter(is_enabled=1).only("id", "question", "is_phishing", "image_id")),
        k=min(testSize, Question.objects.filter(is_enabled=1).count()),
    )

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




def _questions_response(studentID):
    """
    The student's test, built from the frozen snapshots. Question
    order is shuffled on every request (like ORDER BY RANDOM()).
    """
    answers = list(Answer.objects.filter(student_id=studentID))
    random.shuffle(answers)

    selectionsByQuestion = {}
    for selection in AnswerSelectedOption.objects.filter(student_id=studentID).order_by("option_id"):
        selectionsByQuestion.setdefault(selection.question_id, []).append(selection)

    # Tooltip links hang off the frozen image, not the question
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




@login_required
def student_questions(request):
    timeNow = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if not request.current_user.admin:
        studentID = request.current_user.userid

        # Update LastLogin
        Student.objects.filter(id=studentID).update(last_login=timeNow)

        # If phishing test is already finished - STOP
        if Student.objects.get(id=studentID).is_finished == 1:
            return JsonResponse({})


        if request.method == "GET":
            if not Answer.objects.filter(student_id=studentID).exists():
                _deal_questions(studentID)

            return JsonResponse(_questions_response(studentID), safe=False)


        elif request.method == "POST":
            for questionJson in get_json(request):
                if "questionid" not in questionJson:
                    return HttpResponse("Error: This is not questions state object")

                # Save student Question State
                Answer.objects.filter(
                    student_id=studentID,
                    question_id=questionJson["questionid"],
                ).update(answer_status=questionJson["selectedanswer"])

                # Save student Question Options State
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




@login_required
def student_finish(request):
    """GET /api/student/finish — mark the test as finished (no way back)."""
    timeNow = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if not request.current_user.admin:
        Student.objects.filter(id=request.current_user.userid).update(
            last_login=timeNow,
            is_finished=1,
        )

    return JsonResponse({})
