############################################################
#  [*] One-time data migration: Flask SQLite → PostgreSQL
#
#  Usage (inside the fisingas-django container):
#      python3 manage.py import_flask_db
#
#  Reads the Flask database mounted read-only at
#  FLASK_SQLITE_PATH (default /database/fisingas.db). The file
#  is first copied to /tmp so the live Flask backend is never
#  touched, not even with a read lock.
#
#  The import REPLACES everything on the Django side (wipes
#  the tables first) and keeps all primary keys, then resets
#  the PostgreSQL sequences.
#
#  Denormalization: the Flask schema stored answers as bare
#  (StudentID, QuestionID) pairs. Here every answer row gets
#  a frozen copy of the question text / verdict / options,
#  taken from the question bank at import time — the same
#  snapshot a fresh deal would have made.
############################################################


import os
import shutil
import sqlite3

from django.core.management.base import BaseCommand
from django.db import connection, transaction

from fisingas.phishing_test.models import Answer, AnswerSelectedOption, Question, QuestionImage, QuestionLink, QuestionOption
from fisingas.users.models import Setting, Student, StudentGroup, SystemUser




def int_or_none(value):
    """SQLite kept '' in some integer columns — treat those as NULL."""
    if value is None or value == "":
        return None
    return int(value)




class Command(BaseCommand):
    help = "Import all data from the Flask SQLite database into PostgreSQL"

    def handle(self, *args, **options):
        source_path = os.getenv("FLASK_SQLITE_PATH", "/database/fisingas.db")

        # Work on a copy — never open the live Flask database
        working_copy = "/tmp/fisingas-import.db"
        shutil.copyfile(source_path, working_copy)

        sqlite = sqlite3.connect(f"file:{working_copy}?mode=ro", uri=True)
        sqlite.row_factory = sqlite3.Row

        with transaction.atomic():
            self.wipe()
            self.import_users(sqlite)
            self.import_question_bank(sqlite)
            self.import_answers(sqlite)
        self.reset_sequences()

        sqlite.close()
        os.remove(working_copy)
        self.stdout.write(self.style.SUCCESS("Import finished"))




    def wipe(self):
        AnswerSelectedOption.objects.all().delete()
        Answer.objects.all().delete()
        QuestionLink.objects.all().delete()
        QuestionOption.objects.all().delete()
        Question.objects.all().delete()
        QuestionImage.objects.all().delete()
        Student.objects.all().delete()
        StudentGroup.objects.all().delete()
        SystemUser.objects.all().delete()
        Setting.objects.all().delete()




    def import_users(self, sqlite):
        for row in sqlite.execute("SELECT * FROM System_Users"):
            SystemUser.objects.create(
                id=row["ID"],
                email=row["Email"],
                password=row["Password"],
                admin=row["Admin"],
                enabled=row["Enabled"],
                last_login=row["LastLogin"] or "",
            )
        self.stdout.write(f"System users:     {SystemUser.objects.count()}")

        for row in sqlite.execute("SELECT * FROM Users_StudentGroups"):
            StudentGroup.objects.create(
                id=row["GroupID"],
                name=row["Name"],
                description=row["Description"],
                show_answers=row["ShowAnswers"],
                time_limit=row["TimeLimit"],
            )
        self.stdout.write(f"Student groups:   {StudentGroup.objects.count()}")

        group_ids = set(StudentGroup.objects.values_list("id", flat=True))
        for row in sqlite.execute("SELECT * FROM Users_Students"):
            Student.objects.create(
                id=row["StudentID"],
                # GroupID=0 meant "no group" in SQLite
                group_id=row["GroupID"] if row["GroupID"] in group_ids else None,
                username=row["Username"],
                passcode=row["Passcode"],
                is_finished=row["IsFinished"],
                last_login=row["LastLogin"] or "",
                status=row["Status"],
            )
        self.stdout.write(f"Students:         {Student.objects.count()}")

        for row in sqlite.execute("SELECT * FROM System_Settings"):
            Setting.objects.create(name=row["Name"], value=str(row["Value"]))
        self.stdout.write(f"Settings:         {Setting.objects.count()}")




    def import_question_bank(self, sqlite):
        for row in sqlite.execute("SELECT * FROM PhishingTest_Questions"):
            # The blob goes into the upload-only image table; the
            # question row only links to it
            image = QuestionImage.objects.create(
                image=row["Picture"],
                created=row["Created"],
            )
            Question.objects.create(
                id=row["QuestionID"],
                is_enabled=row["IsEnabled"],
                points=row["Points"],
                is_phishing=row["IsPhishing"],
                question=row["Question"],
                filename=row["Filename"],
                image=image,
                picture_height=row["PictureHeight"],
                picture_width=row["PictureWidth"],
                created=row["Created"],
            )
        self.stdout.write(f"Questions:        {Question.objects.count()}")

        # SQLite had no foreign keys — options/links of questions that no
        # longer exist are silently dropped here
        question_ids = set(Question.objects.values_list("id", flat=True))

        skipped = 0
        for row in sqlite.execute("SELECT * FROM PhishingTest_QuestionsOptions"):
            if row["QuestionID"] not in question_ids:
                skipped += 1
                continue
            QuestionOption.objects.create(
                id=row["QuestionOptionID"],
                question_id=row["QuestionID"],
                option_text=row["QuestionOptionText"],
                answer_status=int_or_none(row["AnswerStatus"]),
            )
        self.stdout.write(f"Question options: {QuestionOption.objects.count()} (skipped {skipped} orphans)")

        # Links belong to the image, so orphans (of deleted questions)
        # have nothing to attach to and are dropped
        image_by_question = dict(Question.objects.values_list("id", "image_id"))

        skipped = 0
        for row in sqlite.execute("SELECT * FROM PhishingTest_QuestionsLinks"):
            if row["QuestionID"] not in question_ids:
                skipped += 1
                continue
            QuestionLink.objects.create(
                id=row["QuestionLinkID"],
                image_id=image_by_question[row["QuestionID"]],
                title=row["Title"],
                content=row["Content"],
                x=str(row["X"]),
                y=str(row["Y"]),
                w=str(row["W"]) if row["W"] is not None else None,
                h=str(row["H"]) if row["H"] is not None else None,
            )
        self.stdout.write(f"Question links:   {QuestionLink.objects.count()} (skipped {skipped} orphans)")




    def import_answers(self, sqlite):
        # Snapshots are frozen from the question bank as it is NOW —
        # the same rows the SQLite grade views joined live until today:
        #   - an answer whose question was deleted stays, with an unknown
        #     verdict (is_phishing NULL) — it graded as 0 points before
        #     and keeps grading as 0 points
        #   - the frozen option set is ALL live options of the question
        #     (like the views), with the student's IsSelected merged in;
        #     stored selections whose option was deleted are dropped,
        #     because the views never counted them either
        questions = {question.id: question for question in Question.objects.only("id", "question", "is_phishing", "image_id")}
        options_by_question = {}
        for option in QuestionOption.objects.order_by("id"):
            options_by_question.setdefault(option.question_id, []).append(option)

        student_ids = set(Student.objects.values_list("id", flat=True))

        selections = {
            (row["StudentID"], row["QuestionOptionID"]): int_or_none(row["IsSelected"])
            for row in sqlite.execute("SELECT * FROM PhishingTest_AnswersSelectedOptions")
        }

        skipped = 0
        deleted_questions = 0
        for row in sqlite.execute("SELECT * FROM PhishingTest_Answers"):
            if row["StudentID"] not in student_ids:
                skipped += 1
                continue

            question = questions.get(row["QuestionID"])
            if question is None:
                deleted_questions += 1

            Answer.objects.create(
                student_id=row["StudentID"],
                question_id=row["QuestionID"],
                question_text=question.question if question else "",
                image_id=question.image_id if question else None,
                is_phishing=question.is_phishing if question else None,
                answer_status=int_or_none(row["AnswerStatus"]),
            )

            AnswerSelectedOption.objects.bulk_create([
                AnswerSelectedOption(
                    student_id=row["StudentID"],
                    question_id=row["QuestionID"],
                    option_id=option.id,
                    option_text=option.option_text,
                    right_answer=option.answer_status,
                    is_selected=selections.get((row["StudentID"], option.id)),
                )
                for option in options_by_question.get(row["QuestionID"], [])
            ])

        self.stdout.write(f"Answers:          {Answer.objects.count()} "
                          f"(skipped {skipped} of deleted students, "
                          f"{deleted_questions} of deleted questions kept)")
        self.stdout.write(f"Selected options: {AnswerSelectedOption.objects.count()}")




    def reset_sequences(self):
        """Point each PostgreSQL sequence past the highest imported ID."""
        tables = [
            SystemUser, StudentGroup, Student,
            QuestionImage, Question, QuestionOption, QuestionLink,
            Answer, AnswerSelectedOption,
        ]
        with connection.cursor() as cursor:
            for model in tables:
                table = model._meta.db_table
                cursor.execute(
                    f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
                    f"COALESCE((SELECT MAX(id) FROM {table}), 0) + 1, false)"
                )
