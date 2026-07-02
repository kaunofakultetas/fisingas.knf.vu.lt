############################################################
#  [*] Phishing test app models
#
#  Three groups of tables:
#
#  Images (upload-only, never edited or deleted):
#    QuestionImage
#
#  Question bank (owned by admins, freely editable):
#    PhishingTest_Questions               → Question
#    PhishingTest_QuestionsOptions        → QuestionOption
#    PhishingTest_QuestionsLinks          → QuestionLink
#
#  Student answers (DENORMALIZED — frozen at deal time):
#    PhishingTest_Answers                 → Answer
#    PhishingTest_AnswersSelectedOptions  → AnswerSelectedOption
#
#  When a test is dealt to a student, the question text, the
#  correct verdict, the image link and every option (text +
#  expected value) are COPIED into the answer rows. From that
#  moment the student's test and grade depend only on these
#  copies — admins can edit, disable or (in the future) delete
#  questions and options without breaking grades that were
#  already given. That is why Answer/AnswerSelectedOption
#  reference questions by plain integer ID instead of a foreign
#  key, and reference the shared QuestionImage directly.
#
#  Grading is computed from the answer rows by grading.py.
############################################################


from django.db import models

from fisingas.users.models import Student




# -----------------------------------------------------------
# Images (upload-only)
# -----------------------------------------------------------

class QuestionImage(models.Model):
    """
    A question screenshot, stored as bytes. Rows are UPLOAD-ONLY:
    once created they are never edited or deleted, so both the
    live question and every frozen answer snapshot can point at
    the same row forever. PROTECT on the referencing foreign keys
    enforces this at the database level.
    """

    image = models.BinaryField()
    created = models.CharField(max_length=32, blank=True, default="")

    def __str__(self):
        return f"Image #{self.pk}"




# -----------------------------------------------------------
# Question bank
# -----------------------------------------------------------

class Question(models.Model):
    """
    One phishing-test question: a screenshot plus its correct
    verdict.

      is_phishing:  1 = the screenshot is a phishing attempt
      is_enabled:   only enabled questions are dealt to students
    """

    is_enabled = models.IntegerField(default=1)
    points = models.IntegerField(default=1)
    is_phishing = models.IntegerField(default=0)
    question = models.TextField(blank=True, default="")
    filename = models.CharField(max_length=255, blank=True, default="")
    image = models.ForeignKey(QuestionImage, on_delete=models.PROTECT, related_name="questions")
    picture_height = models.IntegerField(default=0)
    picture_width = models.IntegerField(default=0)
    created = models.CharField(max_length=32, blank=True, default="")

    def __str__(self):
        return f"Question #{self.pk}"




class QuestionOption(models.Model):
    """
    A checkbox shown under the question ("kas išdavė fišingą?").

      answer_status:  1 = should be checked, 0 = should not,
                      NULL = never set by an admin (legacy '')
    """

    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="options")
    option_text = models.TextField(blank=True, default="")
    answer_status = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return f"Option #{self.pk} of question #{self.question_id}"




class QuestionLink(models.Model):
    """
    A clickable area on a question IMAGE with the URL it "leads"
    to (shown as a tooltip). Coordinates are stored as text
    fractions of the image size (e.g. "0.42"), exactly as the
    Flask backend stored and returned them.

    Belongs to the image (not the question) on purpose: the
    coordinates only make sense on that exact image, and frozen
    answer snapshots reference the image too — so old graded
    tests keep their tooltips even after the question is deleted
    or repointed to a new upload.
    """

    image = models.ForeignKey(QuestionImage, on_delete=models.CASCADE, related_name="links")
    title = models.TextField(blank=True, default="")
    content = models.TextField(blank=True, default="")
    x = models.CharField(max_length=32, blank=True, default="")
    y = models.CharField(max_length=32, blank=True, default="")
    w = models.CharField(max_length=32, null=True, blank=True)
    h = models.CharField(max_length=32, null=True, blank=True)

    def __str__(self):
        return f"Link #{self.pk} of image #{self.image_id}"




# -----------------------------------------------------------
# Student answers (denormalized snapshots)
# -----------------------------------------------------------

class Answer(models.Model):
    """
    A question dealt to a student, with their verdict and a frozen
    copy of what was asked.

      question_id:    the Question's ID at deal time — an integer
                      on purpose, NOT a foreign key (the question
                      may be edited or deleted later)
      question_text:  copy of Question.question at deal time
      image:          link to the (upload-only) QuestionImage the
                      student saw — survives question deletion
      is_phishing:    copy of the correct verdict at deal time;
                      NULL only for legacy rows whose question was
                      already deleted before the SQLite import —
                      those count as never-correct, like they did
                      in the Flask grade views
      answer_status:  1 = student said "phishing", 0 = "real",
                      NULL = not answered yet
    """

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="answers")
    question_id = models.IntegerField()
    question_text = models.TextField(blank=True, default="")
    image = models.ForeignKey(QuestionImage, null=True, blank=True, on_delete=models.PROTECT, related_name="answers")
    is_phishing = models.IntegerField(null=True, blank=True)
    answer_status = models.IntegerField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["student", "question_id"], name="unique_student_question_answer"),
        ]

    def __str__(self):
        return f"Answer of student #{self.student_id} to question #{self.question_id}"




class AnswerSelectedOption(models.Model):
    """
    The student's checkbox state for one option of one dealt
    question, with a frozen copy of the option itself.

      option_id:     the QuestionOption's ID at deal time — an
                     integer on purpose, NOT a foreign key
      option_text:   copy of QuestionOption.option_text at deal time
      right_answer:  copy of QuestionOption.answer_status at deal
                     time (1 = should be checked, 0 = should not,
                     NULL = the admin never set it)
      is_selected:   1 = checked, 0 = unchecked, NULL = untouched
    """

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="selected_options")
    question_id = models.IntegerField()
    option_id = models.IntegerField()
    option_text = models.TextField(blank=True, default="")
    right_answer = models.IntegerField(null=True, blank=True)
    is_selected = models.IntegerField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["student", "question_id", "option_id"], name="unique_student_question_option"),
        ]

    def __str__(self):
        return f"Selection of student #{self.student_id} for option #{self.option_id}"
