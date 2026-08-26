############################################################
#  [*] Regression tests — the grading math
#
#  phishing_test/grading.py top to bottom: the per-option
#  and per-question scoring rules, the summary (grade string
#  and truncated percentage), live judging from the frozen
#  snapshots, and the freeze/read-back cycle of TestResult.
############################################################


from django.test import TestCase

from fisingas.phishing_test.grading import (
    OptionResult,
    QuestionResult,
    TestSummary,
    finalize_student,
    judge_student,
    judge_unfinished_students,
    stored_summaries,
    student_summary,
    summarize,
)
from fisingas.phishing_test.models import Answer, AnswerSelectedOption, TestResult

from .utils import create_student


def _question(answer, is_phishing, options=()):
    return QuestionResult(
        question_id=1, question_text="", answer=answer,
        is_phishing=is_phishing, options=list(options),
    )


def _summary(**overrides):
    fields = dict(
        question_count=2, answered_question_count=2, fully_correct_count=1,
        total_identified_correctly=1, total_options_count=0,
        total_correct_options_count=0, total_points=1.0,
    )
    fields.update(overrides)
    return TestSummary(**fields)








############################################################
# OptionResult — one judged checkbox
############################################################

class OptionResultTests(TestCase):

    def test_matching_expectation_is_correct(self):
        self.assertEqual(OptionResult("", right_answer=1, selected=1).is_correct, 1)
        self.assertEqual(OptionResult("", right_answer=0, selected=0).is_correct, 1)

    def test_mismatch_is_wrong(self):
        self.assertEqual(OptionResult("", right_answer=1, selected=0).is_correct, 0)
        self.assertEqual(OptionResult("", right_answer=0, selected=1).is_correct, 0)

    def test_never_set_expectation_is_never_correct(self):
        self.assertEqual(OptionResult("", right_answer=None, selected=0).is_correct, 0)
        self.assertEqual(OptionResult("", right_answer=None, selected=1).is_correct, 0)








############################################################
# QuestionResult — one judged question
############################################################

class QuestionResultTests(TestCase):

    def test_identified_correctly_compares_verdicts(self):
        self.assertEqual(_question(answer=1, is_phishing=1).identified_correctly, 1)
        self.assertEqual(_question(answer=0, is_phishing=0).identified_correctly, 1)
        self.assertEqual(_question(answer=0, is_phishing=1).identified_correctly, 0)

    def test_unanswered_counts_as_wrong(self):
        self.assertEqual(_question(answer=None, is_phishing=0).identified_correctly, 0)

    def test_snapshot_without_a_verdict_is_never_correct(self):
        # Even an unanswered question must not "match" a NULL verdict
        self.assertEqual(_question(answer=None, is_phishing=None).identified_correctly, 0)
        self.assertEqual(_question(answer=1, is_phishing=None).identified_correctly, 0)

    def test_wrong_verdict_zeroes_the_question(self):
        result = _question(answer=0, is_phishing=1, options=[OptionResult("", 1, 1)])
        self.assertEqual(result.points, 0.0)
        self.assertEqual(result.is_fully_correct, 0)

    def test_everything_right_scores_the_full_point(self):
        result = _question(answer=1, is_phishing=1, options=[OptionResult("", 1, 1), OptionResult("", 0, 0)])
        self.assertAlmostEqual(result.points, 1.0)
        self.assertEqual(result.is_fully_correct, 1)

    def test_each_missed_option_costs_a_tenth(self):
        options = [
            OptionResult("", right_answer=1, selected=1),      # right
            OptionResult("", right_answer=0, selected=1),      # wrong
            OptionResult("", right_answer=None, selected=0),   # never set → wrong
        ]
        result = _question(answer=1, is_phishing=1, options=options)
        self.assertEqual(result.total_options, 3)
        self.assertEqual(result.correct_options, 1)
        self.assertAlmostEqual(result.points, 0.8)
        self.assertEqual(result.is_fully_correct, 0)








############################################################
# TestSummary — grade string and percentage
############################################################

class TestSummaryTests(TestCase):

    def test_grade_is_a_two_decimal_string(self):
        self.assertEqual(_summary(question_count=2, total_points=1.0).test_grade, "5.00")
        self.assertEqual(_summary(question_count=1, total_points=1.0).test_grade, "10.00")

    def test_grade_rounds_to_two_decimals(self):
        self.assertEqual(_summary(question_count=3, total_points=2.5).test_grade, "8.33")

    def test_percentage_is_truncated_not_rounded(self):
        summary = _summary(question_count=3, fully_correct_count=2)
        self.assertEqual(summary.fully_correct_percentage, 66)








############################################################
# summarize — folding results into totals
############################################################

class SummarizeTests(TestCase):

    def test_no_dealt_questions_means_no_summary(self):
        self.assertIsNone(summarize([]))

    def test_totals_add_up_across_questions(self):
        results = [
            _question(answer=1, is_phishing=1, options=[OptionResult("", 1, 1), OptionResult("", 0, 0)]),
            _question(answer=1, is_phishing=0, options=[OptionResult("", 1, 0)]),
            _question(answer=None, is_phishing=1),
        ]
        summary = summarize(results)
        self.assertEqual(summary.question_count, 3)
        self.assertEqual(summary.answered_question_count, 2)
        self.assertEqual(summary.fully_correct_count, 1)
        self.assertEqual(summary.total_identified_correctly, 1)
        self.assertEqual(summary.total_options_count, 3)
        self.assertEqual(summary.total_correct_options_count, 2)
        self.assertAlmostEqual(summary.total_points, 1.0)








############################################################
# Judging the frozen snapshots
############################################################

def _freeze(student, question_id, is_phishing, answer_status, options=()):
    Answer.objects.create(
        student=student, question_id=question_id, question_text=f"Q{question_id}",
        image=None, is_phishing=is_phishing, answer_status=answer_status,
    )
    for option_id, right_answer, is_selected in options:
        AnswerSelectedOption.objects.create(
            student=student, question_id=question_id, option_id=option_id,
            option_text=f"O{option_id}", right_answer=right_answer, is_selected=is_selected,
        )


class JudgeStudentTests(TestCase):

    def setUp(self):
        self.student = create_student()

    def test_one_result_per_dealt_question_ordered_by_id(self):
        _freeze(self.student, 7, is_phishing=1, answer_status=1)
        _freeze(self.student, 3, is_phishing=0, answer_status=None)
        results = judge_student(self.student.id)
        self.assertEqual([result.question_id for result in results], [3, 7])

    def test_never_started_student_gets_an_empty_list(self):
        self.assertEqual(judge_student(self.student.id), [])

    def test_untouched_checkbox_counts_as_unchecked(self):
        _freeze(self.student, 1, is_phishing=1, answer_status=1, options=[(11, 0, None)])
        [result] = judge_student(self.student.id)
        [option] = result.options
        self.assertEqual(option.selected, 0)
        self.assertEqual(option.is_correct, 1)    # expected unchecked, left untouched

    def test_options_come_back_ordered_by_option_id(self):
        _freeze(self.student, 1, is_phishing=1, answer_status=1, options=[(12, 0, None), (11, 1, 1)])
        [result] = judge_student(self.student.id)
        self.assertEqual([option.option_text for option in result.options], ["O11", "O12"])

    def test_unfinished_judging_excludes_finished_students(self):
        finished = create_student(username="FINISHED", is_finished=1)
        _freeze(self.student, 1, is_phishing=1, answer_status=1)
        _freeze(finished, 1, is_phishing=1, answer_status=1)

        results = judge_unfinished_students()
        self.assertEqual(set(results.keys()), {self.student.id})








############################################################
# Freezing totals and reading them back
############################################################

class FreezeAndReadBackTests(TestCase):

    def setUp(self):
        self.student = create_student()
        # One fully right question with two options, one unanswered
        _freeze(self.student, 1, is_phishing=1, answer_status=1, options=[(11, 1, 1), (12, 0, 0)])
        _freeze(self.student, 2, is_phishing=0, answer_status=None)

    def test_finalize_writes_the_raw_totals(self):
        finalize_student(self.student.id, finished_at="2026-08-01 12:00:00")

        row = TestResult.objects.get(student=self.student)
        self.assertEqual(row.question_count, 2)
        self.assertEqual(row.answered_question_count, 1)
        self.assertEqual(row.total_identified_correctly, 1)
        self.assertEqual(row.fully_correct_count, 1)
        self.assertEqual(row.total_options_count, 2)
        self.assertEqual(row.total_correct_options_count, 2)
        self.assertEqual(row.total_points, 1.0)
        self.assertEqual(row.finished_at, "2026-08-01 12:00:00")

    def test_finalize_without_answers_writes_nothing(self):
        empty = create_student(username="EMPTY")
        finalize_student(empty.id, finished_at="2026-08-01 12:00:00")
        self.assertFalse(TestResult.objects.filter(student=empty).exists())

    def test_finalize_twice_keeps_one_row(self):
        finalize_student(self.student.id, finished_at="2026-08-01 12:00:00")
        finalize_student(self.student.id, finished_at="2026-08-02 09:00:00")

        [row] = TestResult.objects.filter(student=self.student)
        self.assertEqual(row.finished_at, "2026-08-02 09:00:00")

    def test_stored_summary_renders_exactly_like_a_live_one(self):
        finalize_student(self.student.id, finished_at="2026-08-01 12:00:00")
        live = summarize(judge_student(self.student.id))
        stored = stored_summaries()[self.student.id]
        self.assertEqual(stored, live)

    def test_student_summary_prefers_the_frozen_row_when_finished(self):
        finalize_student(self.student.id, finished_at="2026-08-01 12:00:00")
        self.student.is_finished = 1
        self.student.save()
        TestResult.objects.filter(student=self.student).update(total_points=9.0)

        self.assertEqual(student_summary(self.student).total_points, 9.0)

    def test_student_summary_falls_back_to_live_when_the_row_is_missing(self):
        self.student.is_finished = 1
        self.student.save()

        summary = student_summary(self.student)
        self.assertEqual(summary.question_count, 2)
        self.assertEqual(summary.total_points, 1.0)

    def test_student_summary_judges_live_while_unfinished(self):
        # A frozen row of a still-running test is ignored
        finalize_student(self.student.id, finished_at="2026-08-01 12:00:00")
        TestResult.objects.filter(student=self.student).update(total_points=9.0)

        self.assertEqual(student_summary(self.student).total_points, 1.0)
