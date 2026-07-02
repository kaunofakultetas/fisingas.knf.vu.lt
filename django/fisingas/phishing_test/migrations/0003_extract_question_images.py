############################################################
#  [*] Move question pictures into their own table
#
#  Before: the image blob lived in Question.picture, so
#  deleting a question would have destroyed the image that
#  old (frozen) answer snapshots still need to display.
#
#  After: images live in the upload-only QuestionImage table
#  and are linked (PROTECT) from BOTH sides:
#    - Question.image  — the live question bank
#    - Answer.image    — the frozen snapshot of what the
#                        student actually saw
#
#  The data step copies every existing blob into the new
#  table and wires up both links before Question.picture
#  is dropped.
############################################################


import django.db.models.deletion
from django.db import migrations, models




def extract_images(apps, schema_editor):
    Question = apps.get_model("phishing_test", "Question")
    QuestionImage = apps.get_model("phishing_test", "QuestionImage")
    Answer = apps.get_model("phishing_test", "Answer")

    # One image row per question, keeping the question's timestamp
    for question in Question.objects.all().iterator():
        image = QuestionImage.objects.create(
            image=question.picture,
            created=question.created,
        )
        question.image_id = image.id
        question.save(update_fields=["image"])

    # Freeze the image link into every existing answer snapshot
    # (answers whose question was already deleted stay NULL)
    image_by_question = dict(Question.objects.values_list("id", "image_id"))

    answers = list(Answer.objects.all().only("id", "question_id"))
    for answer in answers:
        answer.image_id = image_by_question.get(answer.question_id)
    Answer.objects.bulk_update(answers, ["image"], batch_size=1000)




class Migration(migrations.Migration):

    dependencies = [
        ("phishing_test", "0002_alter_answer_is_phishing"),
    ]

    operations = [
        migrations.CreateModel(
            name="QuestionImage",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.BinaryField()),
                ("created", models.CharField(blank=True, default="", max_length=32)),
            ],
        ),
        migrations.AddField(
            model_name="question",
            name="image",
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.PROTECT, related_name="questions", to="phishing_test.questionimage"),
        ),
        migrations.AddField(
            model_name="answer",
            name="image",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="answers", to="phishing_test.questionimage"),
        ),
        migrations.RunPython(extract_images, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="question",
            name="image",
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="questions", to="phishing_test.questionimage"),
        ),
        migrations.RemoveField(
            model_name="question",
            name="picture",
        ),
    ]
