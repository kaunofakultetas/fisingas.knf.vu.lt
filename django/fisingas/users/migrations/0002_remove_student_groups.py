############################################################
#  [*] Remove student groups
#
#  Student groups were never used by the product — the
#  per-group settings were stored but not enforced anywhere.
#  Drops the Student.group column and the StudentGroup table.
############################################################


from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="student",
            name="group",
        ),
        migrations.DeleteModel(
            name="StudentGroup",
        ),
    ]
