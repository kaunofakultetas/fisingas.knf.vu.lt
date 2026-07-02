############################################################
#  [*] Users app models
#
#  Mirrors the Flask SQLite tables:
#    System_Users        → SystemUser
#    Users_StudentGroups → StudentGroup
#    Users_Students      → Student
#    System_Settings     → Setting
#
#  Conventions kept from the Flask schema on purpose:
#    - flag columns stay integers (0/1), because the API
#      responses expose them as 0/1 and the frontend
#      compares against those values
#    - timestamps stay "YYYY-MM-DD HH:MM:SS" strings, because
#      the API returns them verbatim (lastseen, lastlogin)
############################################################


from django.db import models




class SystemUser(models.Model):
    """Administrator account. Passwords are bcrypt hashes ($2b$12$...)."""

    email = models.CharField(max_length=255, unique=True)
    password = models.CharField(max_length=255)
    admin = models.IntegerField(default=1)
    enabled = models.IntegerField(default=0)
    last_login = models.CharField(max_length=32, blank=True, default="")

    def __str__(self):
        return self.email




class StudentGroup(models.Model):
    """Optional grouping of students (name shown in the admin students list)."""

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    show_answers = models.IntegerField(default=0)
    time_limit = models.IntegerField(default=0)

    def __str__(self):
        return self.name




class Student(models.Model):
    """
    Student account. The passcode is the plaintext login password
    (generated 8-digit code) — same behaviour as the Flask backend.

    Legacy note: in SQLite, students without a group had GroupID=0
    pointing at no row; here that is a NULL foreign key.
    """

    group = models.ForeignKey(StudentGroup, null=True, blank=True, on_delete=models.SET_NULL, related_name="students")
    username = models.CharField(max_length=255, unique=True)
    passcode = models.CharField(max_length=64)
    is_finished = models.IntegerField(default=0)
    last_login = models.CharField(max_length=32, blank=True, default="")
    status = models.IntegerField(default=1)

    def __str__(self):
        return self.username




class Setting(models.Model):
    """Key/value system settings (e.g. PhishingTestSize)."""

    name = models.CharField(max_length=255, primary_key=True)
    value = models.TextField()

    def __str__(self):
        return self.name
