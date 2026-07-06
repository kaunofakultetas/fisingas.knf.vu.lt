############################################################
#  [*] TestResult — freeze the grades of finished tests
#
#  Adds the TestResult table (one row of raw grading totals
#  per finished student, written by student_finish from now
#  on) and BACKFILLS it for every student who finished before
#  the table existed, by judging their frozen answer
#  snapshots one last time.
#
#  The scoring math below mirrors phishing_test/grading.py
#  AS OF THIS MIGRATION on purpose — migrations must not
#  import live code, and grades are pure functions of the
#  frozen snapshots, so re-running this backfill always
#  reproduces exactly what student_finish would have written.
#
#  finished_at is unknown for historical students — their
#  last_login (the final activity on the locked test) is the
#  closest record of it.
############################################################


import django.db.models.deletion
from django.db import migrations, models




def backfill_finished_students(apps, schema_editor):
    Student = apps.get_model("users", "Student")
    Answer = apps.get_model("phishing_test", "Answer")
    AnswerSelectedOption = apps.get_model("phishing_test", "AnswerSelectedOption")
    TestResult = apps.get_model("phishing_test", "TestResult")

    # Option totals per dealt question: [dealt, correct].
    # An option is correct when its frozen expected value equals
    # what the student left (untouched counts as unchecked); an
    # expected value that was never set (NULL) is never correct
    option_totals = {}
    selections = AnswerSelectedOption.objects.filter(student__is_finished=1).values_list(
        "student_id", "question_id", "right_answer", "is_selected",
    )
    for student_id, question_id, right_answer, is_selected in selections:
        totals = option_totals.setdefault((student_id, question_id), [0, 0])
        totals[0] += 1
        if right_answer == (is_selected or 0):
            totals[1] += 1

    # Fold every dealt question into its student's totals.
    # Points are collected into a list and folded with sum() in
    # the same (student_id, question_id) order grading.summarize
    # uses — sum() does compensated float summation on 3.12+, so
    # anything else would store subtly different totals
    totals_by_student = {}
    answers = Answer.objects.filter(student__is_finished=1).order_by("student_id", "question_id").values_list(
        "student_id", "question_id", "answer_status", "is_phishing",
    )
    for student_id, question_id, answer_status, is_phishing in answers:
        options_count, correct_options = option_totals.get((student_id, question_id), (0, 0))

        # A snapshot frozen without a verdict (NULL) can never be
        # answered correctly
        identified = 1 if (is_phishing is not None and answer_status == is_phishing) else 0

        # A wrong verdict zeroes the question no matter the options;
        # a right one starts at 1.0 and loses 0.1 per missed option
        points = (1.0 - options_count * 0.1 + correct_options * 0.1) if identified else 0.0

        totals = totals_by_student.setdefault(student_id, {
            "question_count": 0,
            "answered_question_count": 0,
            "total_identified_correctly": 0,
            "fully_correct_count": 0,
            "total_options_count": 0,
            "total_correct_options_count": 0,
            "points": [],
        })
        totals["question_count"] += 1
        totals["answered_question_count"] += 1 if answer_status is not None else 0
        totals["total_identified_correctly"] += identified
        totals["fully_correct_count"] += 1 if (identified and correct_options == options_count) else 0
        totals["total_options_count"] += options_count
        totals["total_correct_options_count"] += correct_options
        totals["points"].append(points)

    last_login_by_student = dict(
        Student.objects.filter(id__in=totals_by_student).values_list("id", "last_login")
    )

    TestResult.objects.bulk_create([
        TestResult(
            student_id=student_id,
            finished_at=last_login_by_student.get(student_id, ""),
            total_points=sum(totals.pop("points")),
            **totals,
        )
        for student_id, totals in totals_by_student.items()
    ], batch_size=1000)




class Migration(migrations.Migration):

    dependencies = [
        ("phishing_test", "0005_drop_unused_question_columns"),
        ("users", "0003_student_registration_time"),
    ]

    operations = [
        migrations.CreateModel(
            name="TestResult",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("question_count", models.IntegerField()),
                ("answered_question_count", models.IntegerField()),
                ("total_identified_correctly", models.IntegerField()),
                ("fully_correct_count", models.IntegerField()),
                ("total_options_count", models.IntegerField()),
                ("total_correct_options_count", models.IntegerField()),
                ("total_points", models.FloatField()),
                ("finished_at", models.CharField(blank=True, default="", max_length=32)),
                ("student", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="test_result", to="users.student")),
            ],
        ),
        migrations.RunPython(backfill_finished_students, migrations.RunPython.noop),
    ]
