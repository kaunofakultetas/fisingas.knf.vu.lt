############################################################
#  [*] Grading — pure-Python replacement of the SQLite views
#
#  The Flask backend computed all grades inside three SQLite
#  views (_VIEW_GetUsersAnswersOptions, _VIEW_GetUsersAnswers,
#  _VIEW_GetUsersTestResults) by joining the live question
#  bank on every request. This module reimplements that math
#  in plain Python — but on top of the DENORMALIZED answer
#  rows (see models.py), so grades depend only on what the
#  student was actually asked, never on the current state of
#  the question bank.
#
#  Scoring rules (per dealt question):
#    - identified_correctly = 1 when the student's verdict
#      (answer_status) equals the frozen is_phishing flag;
#      an unanswered question (NULL) counts as 0
#    - an option is correct when its frozen expected value
#      (right_answer) equals what the student left in the
#      checkbox (unchecked/untouched count as 0); an option
#      whose expected value was never set (NULL) can never
#      be correct
#    - points = 1 - 0.1×options + 0.1×correct_options when
#      the verdict is right, otherwise 0 (so every missed
#      option subtracts 0.1 from the full point)
#
#  Test summary (per student):
#    - grade = points_sum / question_count × 10, rounded to
#      2 decimals and formatted "8.50" (string, like PRINTF)
#    - fully_correct = verdict right AND every option right
#
#  Known deviation from the SQLite views: a question with zero
#  options used to be counted as having one (always incorrect)
#  option, giving at most 0.9 points. Here it simply has zero
#  options and a correct verdict earns the full 1.0 point.
############################################################


from dataclasses import dataclass, field

from .models import Answer, AnswerSelectedOption




# -----------------------------------------------------------
# Result containers
# -----------------------------------------------------------

@dataclass
class OptionResult:
    """One option checkbox of one dealt question, already judged."""

    option_text: str
    right_answer: int | None        # frozen expected value (None = admin never set it)
    selected: int                   # what the student left (untouched → 0)

    @property
    def is_correct(self):
        return 1 if self.right_answer == self.selected else 0


@dataclass
class QuestionResult:
    """One dealt question of one student, already judged."""

    question_id: int
    question_text: str
    answer: int | None              # student's verdict (None = unanswered)
    is_phishing: int                # frozen correct verdict
    options: list[OptionResult] = field(default_factory=list)

    @property
    def identified_correctly(self):
        # is_phishing None = the question was deleted before the SQLite
        # import — such answers can never be correct (matches the old views)
        if self.is_phishing is None:
            return 0
        return 1 if self.answer == self.is_phishing else 0

    @property
    def total_options(self):
        return len(self.options)

    @property
    def correct_options(self):
        return sum(option.is_correct for option in self.options)

    @property
    def is_fully_correct(self):
        return 1 if (self.identified_correctly and self.correct_options == self.total_options) else 0

    @property
    def points(self):
        if not self.identified_correctly:
            return 0.0
        return 1.0 - self.total_options * 0.1 + self.correct_options * 0.1


@dataclass
class TestSummary:
    """Whole-test totals of one student, derived from QuestionResults."""

    question_count: int
    fully_correct_count: int
    total_identified_correctly: int
    total_options_count: int
    total_correct_options_count: int
    total_points: float

    @property
    def fully_correct_percentage(self):
        # CAST(x AS INTEGER) in SQLite truncates — int() does the same
        return int(self.fully_correct_count / self.question_count * 100)

    @property
    def test_grade(self):
        # PRINTF('%.2f', ROUND(points / count * 10, 2))
        return f"{round(self.total_points / self.question_count * 10, 2):.2f}"




# -----------------------------------------------------------
# Judging
# -----------------------------------------------------------

def judge_student(student_id):
    """
    Return the list of QuestionResult for one student — one entry
    per dealt question (Answer row), ordered by question ID.

    Students who never started the test get an empty list.
    """
    return _judge_answers(
        Answer.objects.filter(student_id=student_id),
        AnswerSelectedOption.objects.filter(student_id=student_id),
    ).get(student_id, [])




def judge_all_students():
    """
    Return {student_id: [QuestionResult, ...]} for every student
    that has dealt questions. Used by the list endpoints
    (admin students table, leaderboard) to avoid per-row queries.
    """
    return _judge_answers(
        Answer.objects.all(),
        AnswerSelectedOption.objects.all(),
    )




def summarize(question_results):
    """
    Fold a student's QuestionResults into a TestSummary.
    Returns None when the student has no dealt questions
    (the API renders that as '' fields, like IFNULL(x, '')).
    """
    if not question_results:
        return None

    return TestSummary(
        question_count=len(question_results),
        fully_correct_count=sum(result.is_fully_correct for result in question_results),
        total_identified_correctly=sum(result.identified_correctly for result in question_results),
        total_options_count=sum(result.total_options for result in question_results),
        total_correct_options_count=sum(result.correct_options for result in question_results),
        total_points=sum(result.points for result in question_results),
    )




# -----------------------------------------------------------
# Internals
# -----------------------------------------------------------

def _judge_answers(answers_queryset, selections_queryset):
    """Build {student_id: [QuestionResult, ...]} from the given rows."""

    # Frozen option snapshots, grouped per dealt question
    options_by_answer = {}
    for selection in selections_queryset.order_by("option_id"):
        options_by_answer.setdefault((selection.student_id, selection.question_id), []).append(OptionResult(
            option_text=selection.option_text,
            right_answer=selection.right_answer,
            selected=selection.is_selected or 0,
        ))

    results = {}
    for answer in answers_queryset.order_by("student_id", "question_id"):
        results.setdefault(answer.student_id, []).append(QuestionResult(
            question_id=answer.question_id,
            question_text=answer.question_text,
            answer=answer.answer_status,
            is_phishing=answer.is_phishing,
            options=options_by_answer.get((answer.student_id, answer.question_id), []),
        ))

    return results
