############################################################
#  [*] Migration — index Answer.question_id
#
#  The only index covering question_id was the composite
#  unique (student, question_id), whose leading column is
#  student — useless for the deleted-question image fallback
#  in pictures_views._resolve_image, which looks a question
#  up by question_id alone and scanned the whole table.
############################################################


from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("phishing_test", "0007_datetime_columns"),
    ]

    operations = [
        migrations.AlterField(
            model_name="answer",
            name="question_id",
            field=models.IntegerField(db_index=True),
        ),
    ]
