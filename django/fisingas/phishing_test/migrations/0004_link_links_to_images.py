############################################################
#  [*] Repoint question links from the question to its image
#
#  The clickable areas are coordinates ON the image (fractions
#  of its size), and the frozen answer snapshots reference the
#  image too — so hanging the links off QuestionImage keeps
#  the tooltips of old graded tests alive even after the
#  question is deleted or repointed to a new upload.
############################################################


import django.db.models.deletion
from django.db import migrations, models




def repoint_links(apps, schema_editor):
    Question = apps.get_model("phishing_test", "Question")
    QuestionLink = apps.get_model("phishing_test", "QuestionLink")

    image_by_question = dict(Question.objects.values_list("id", "image_id"))

    links = list(QuestionLink.objects.all().only("id", "question_id"))
    for link in links:
        link.image_id = image_by_question.get(link.question_id)
    QuestionLink.objects.bulk_update(links, ["image"], batch_size=1000)

    # Links whose question vanished before the SQLite import have no
    # image to attach to — nothing displays them anyway
    QuestionLink.objects.filter(image__isnull=True).delete()




class Migration(migrations.Migration):

    dependencies = [
        ("phishing_test", "0003_extract_question_images"),
    ]

    operations = [
        migrations.AddField(
            model_name="questionlink",
            name="image",
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name="links", to="phishing_test.questionimage"),
        ),
        migrations.RunPython(repoint_links, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="questionlink",
            name="question",
        ),
        migrations.AlterField(
            model_name="questionlink",
            name="image",
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="links", to="phishing_test.questionimage"),
        ),
    ]
