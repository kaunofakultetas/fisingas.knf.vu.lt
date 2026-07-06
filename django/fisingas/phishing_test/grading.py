############################################################
#  [*] Grading — all the scoring math in one place
#
#  Grades are computed from the DENORMALIZED answer rows
#  (see models.py): when a test is dealt, the question text,
#  the correct verdict and every option are frozen into
#  Answer/AnswerSelectedOption. Everything here reads only
#  those frozen copies, so grades depend on what the student
#  was actually asked — never on the current state of the
#  question bank.
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
#    - grade = points_sum / question_count × 10, rounded and
#      formatted to two decimals as a string ("8.50")
#    - fully_correct = verdict right AND every option right
#
#  Finished tests are NOT re-judged: student_finish freezes
#  the totals into the TestResult table (finalize_student),
#  and the list endpoints read those rows back as TestSummary
#  objects (stored_summaries) — only students still taking
#  the test are judged live.
#
#  Layout (top to bottom):
#
#    OptionResult / QuestionResult / TestSummary — the result
#      containers, with the scoring math as properties
#    judge_student / judge_unfinished_students — the entry
#      points for live judging
#    summarize          — folds results into a TestSummary
#    finalize_student   — freezes the totals into TestResult
#    stored_summaries / student_summary — read them back
#    _judge_answers     — the shared internal workhorse
############################################################


from dataclasses import dataclass, field

from .models import Answer, AnswerSelectedOption, TestResult








############################################################
# OptionResult
############################################################
#
# One option checkbox of one dealt question, already judged.
# Built from a frozen AnswerSelectedOption row: the option
# text and the expected value were copied there when the
# test was dealt, so this never looks at the live bank.
#
# Used by:
#   - QuestionResult (below) — its .options list
#   - admin_views.student_answers — rendered per option
############################################################

@dataclass
class OptionResult:
    option_text: str
    right_answer: int | None        # frozen expected value (None = admin never set it)
    selected: int                   # what the student left (untouched → 0)

    @property
    def is_correct(self):
        # None never equals 0 or 1 — an option whose expected
        # value was never set can never be correct
        return 1 if self.right_answer == self.selected else 0








############################################################
# QuestionResult
############################################################
#
# One dealt question of one student, already judged. All the
# per-question scoring rules from the header live here as
# properties, so every consumer (admin review, leaderboard,
# student summary) is guaranteed the same math.
#
# Used by:
#   - judge_student / judge_unfinished_students (below) — returned
#   - summarize (below) — folded into a TestSummary
#   - admin_views.student_answers — rendered per question
############################################################

@dataclass
class QuestionResult:
    question_id: int
    question_text: str
    answer: int | None              # student's verdict (None = unanswered)
    is_phishing: int                # frozen correct verdict
    options: list[OptionResult] = field(default_factory=list)

    @property
    def identified_correctly(self):
        # A snapshot frozen without a verdict (None) can never
        # be answered correctly
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
        # A wrong verdict zeroes the question no matter the options;
        # a right one starts at 1.0 and loses 0.1 per missed option
        if not self.identified_correctly:
            return 0.0
        return 1.0 - self.total_options * 0.1 + self.correct_options * 0.1








############################################################
# TestSummary
############################################################
#
# Whole-test totals of one student — derived live from their
# QuestionResults by summarize(), or read back from a frozen
# TestResult row by stored_summaries()/student_summary().
# Both paths meet here, so a stored grade renders exactly
# like a live one.
#
# Used by:
#   - leaderboard.views.leaderboard    — grade column
#   - users.students_views._student_row — student list/detail
############################################################

@dataclass
class TestSummary:
    question_count: int
    answered_question_count: int
    fully_correct_count: int
    total_identified_correctly: int
    total_options_count: int
    total_correct_options_count: int
    total_points: float

    @property
    def fully_correct_percentage(self):
        # Truncated, not rounded — 99.9% reads as 99
        return int(self.fully_correct_count / self.question_count * 100)

    @property
    def test_grade(self):
        # Always a two-decimal string, e.g. "8.50" — the frontend
        # prints it as-is
        return f"{round(self.total_points / self.question_count * 10, 2):.2f}"








############################################################
# judge_student
############################################################
#
# The list of QuestionResult for ONE student — one entry per
# dealt question (Answer row), ordered by question ID.
# Students who never started the test get an empty list.
#
# Used by:
#   - admin_views.student_answers        — the graded test view
#   - users.students_views.student_detail — one student's stats
############################################################

def judge_student(student_id):
    return _judge_answers(
        Answer.objects.filter(student_id=student_id),
        AnswerSelectedOption.objects.filter(student_id=student_id),
    ).get(student_id, [])








############################################################
# judge_unfinished_students
############################################################
#
# {student_id: [QuestionResult, ...]} for every student that
# has dealt questions and is STILL TAKING the test — the
# whole live-grading table in two queries. The list endpoints
# call this instead of judge_student per row, which would
# melt the leaderboard (it refreshes every few seconds on
# the projector).
#
# Finished students are excluded on purpose: their totals
# were frozen into TestResult at finish time and come from
# stored_summaries() below instead.
#
# Used by:
#   - leaderboard.views.leaderboard      — the public board
#   - users.students_views.students_list — the admin table
############################################################

def judge_unfinished_students():
    return _judge_answers(
        Answer.objects.filter(student__is_finished=0),
        AnswerSelectedOption.objects.filter(student__is_finished=0),
    )








############################################################
# summarize
############################################################
#
# Folds one student's QuestionResults into a TestSummary.
# Returns None when the student has no dealt questions — the
# API renders that as '' fields.
#
# Used by:
#   - leaderboard.views.leaderboard     — grade per row
#   - users.students_views._student_row — list + detail rows
############################################################

def summarize(question_results):
    if not question_results:
        return None

    return TestSummary(
        question_count=len(question_results),
        answered_question_count=sum(1 for result in question_results if result.answer is not None),
        fully_correct_count=sum(result.is_fully_correct for result in question_results),
        total_identified_correctly=sum(result.identified_correctly for result in question_results),
        total_options_count=sum(result.total_options for result in question_results),
        total_correct_options_count=sum(result.correct_options for result in question_results),
        total_points=sum(result.points for result in question_results),
    )




############################################################
# finalize_student
############################################################
#
# Freeze one student's totals into the TestResult table —
# the write half of the frozen-grade scheme. Judges the
# student one last time and stores the raw counts; from then
# on the list endpoints read the row instead of re-judging.
#
# update_or_create keeps a double "finish" click harmless.
# A student who finishes without ever dealing a test gets no
# row — summarize() returns None, and the API renders the
# missing row as the usual blank fields.
#
# Used by:
#   - phishing_test.student_views.student_finish — in the
#     same transaction that sets is_finished=1
#   - migration 0006 backfills the same shape for students
#     who finished before this table existed
############################################################

def finalize_student(student_id, finished_at):
    summary = summarize(judge_student(student_id))
    if summary is None:
        return

    TestResult.objects.update_or_create(
        student_id=student_id,
        defaults={
            "question_count": summary.question_count,
            "answered_question_count": summary.answered_question_count,
            "total_identified_correctly": summary.total_identified_correctly,
            "fully_correct_count": summary.fully_correct_count,
            "total_options_count": summary.total_options_count,
            "total_correct_options_count": summary.total_correct_options_count,
            "total_points": summary.total_points,
            "finished_at": finished_at,
        },
    )




############################################################
# stored_summaries
############################################################
#
# {student_id: TestSummary} for every FROZEN TestResult row —
# the read half of the frozen-grade scheme, one query for
# the whole table. The list endpoints overlay these on top
# of the live judgements of the unfinished students.
#
# Used by:
#   - leaderboard.views.leaderboard      — the public board
#   - users.students_views.students_list — the admin table
############################################################

def stored_summaries():
    return {
        row["student_id"]: TestSummary(
            question_count=row["question_count"],
            answered_question_count=row["answered_question_count"],
            fully_correct_count=row["fully_correct_count"],
            total_identified_correctly=row["total_identified_correctly"],
            total_options_count=row["total_options_count"],
            total_correct_options_count=row["total_correct_options_count"],
            total_points=row["total_points"],
        )
        for row in TestResult.objects.values(
            "student_id", "question_count", "answered_question_count",
            "fully_correct_count", "total_identified_correctly",
            "total_options_count", "total_correct_options_count", "total_points",
        )
    }




############################################################
# student_summary
############################################################
#
# The TestSummary of ONE student: the frozen row when the
# test is finished, a live judgement otherwise. None when
# the student never dealt a test.
#
# Falls back to live judging if a finished student somehow
# has no frozen row (finished before the backfill ran) — the
# grade is always derivable from the answer snapshots.
#
# Used by:
#   - users.students_views.student_detail — one student's row
############################################################

def student_summary(student):
    if student.is_finished == 1:
        row = TestResult.objects.filter(student_id=student.id).first()
        if row is not None:
            return TestSummary(
                question_count=row.question_count,
                answered_question_count=row.answered_question_count,
                fully_correct_count=row.fully_correct_count,
                total_identified_correctly=row.total_identified_correctly,
                total_options_count=row.total_options_count,
                total_correct_options_count=row.total_correct_options_count,
                total_points=row.total_points,
            )

    return summarize(judge_student(student.id))








############################################################
# _judge_answers (internal)
############################################################
#
# The shared workhorse: builds {student_id: [QuestionResult]}
# from the given Answer/AnswerSelectedOption rows in exactly
# two queries, whatever the filter.
#
# Both queries fetch plain tuples (values_list) instead of
# model instances — instantiating tens of thousands of model
# objects used to dominate the list endpoints' response time.
#
# Used by:
#   - judge_student (above)             — filtered to one student
#   - judge_unfinished_students (above) — everyone still testing
############################################################

def _judge_answers(answers_queryset, selections_queryset):
    # Frozen option snapshots, grouped per dealt question. Ordered
    # by option ID so the review pages list options in the same
    # order the student saw them
    options_by_answer = {}
    selections = selections_queryset.order_by("option_id").values_list(
        "student_id", "question_id", "option_text", "right_answer", "is_selected",
    )
    for student_id, question_id, option_text, right_answer, is_selected in selections:
        options_by_answer.setdefault((student_id, question_id), []).append(OptionResult(
            option_text=option_text,
            right_answer=right_answer,
            selected=is_selected or 0,     # untouched checkbox counts as unchecked
        ))

    # One QuestionResult per Answer row, its options attached
    results = {}
    answers = answers_queryset.order_by("student_id", "question_id").values_list(
        "student_id", "question_id", "question_text", "answer_status", "is_phishing",
    )
    for student_id, question_id, question_text, answer_status, is_phishing in answers:
        results.setdefault(student_id, []).append(QuestionResult(
            question_id=question_id,
            question_text=question_text,
            answer=answer_status,
            is_phishing=is_phishing,
            options=options_by_answer.get((student_id, question_id), []),
        ))

    return results
