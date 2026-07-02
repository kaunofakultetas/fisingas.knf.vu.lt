############################################################
#  [*] Drop unused Question columns
#
#  points, filename, picture_height and picture_width were
#  written on upload but never read anywhere — grading uses
#  its own fixed formula and the image bytes carry their own
#  dimensions and type.
############################################################


from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("phishing_test", "0004_link_links_to_images"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="question",
            name="points",
        ),
        migrations.RemoveField(
            model_name="question",
            name="filename",
        ),
        migrations.RemoveField(
            model_name="question",
            name="picture_height",
        ),
        migrations.RemoveField(
            model_name="question",
            name="picture_width",
        ),
    ]
