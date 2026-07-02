############################################################
#  [*] Add Student.registration_time
#
#  "YYYY-MM-DD HH:MM:SS" string set once when the account is
#  registered, shown in the admin students table. Accounts
#  created before this column existed keep "".
############################################################


from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0002_remove_student_groups"),
    ]

    operations = [
        migrations.AddField(
            model_name="student",
            name="registration_time",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
    ]
