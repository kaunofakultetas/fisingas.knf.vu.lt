############################################################
#  [*] Users app models
#
#  The accounts and system configuration:
#
#    SystemUser — administrator accounts (bcrypt passwords)
#    Student    — student accounts (generated passcodes)
#    Setting    — key/value system settings
#
#  Conventions the API responses are built on:
#    - flag columns are integers (0/1), exposed as 0/1 in the
#      JSON — the frontend compares against those values
#    - timestamps are "YYYY-MM-DD HH:MM:SS" strings, returned
#      verbatim (lastseen, lastlogin); string comparison
#      still sorts them chronologically
############################################################


from django.db import models








############################################################
# SystemUser — administrator account
############################################################
#
# Admins log in with their email; passwords are stored as
# bcrypt hashes ($2b$12$...). Disabled accounts keep their
# row but cannot log in.
#
#   admin:   always 1 — kept as a column because the API
#            exposes it in the user info
#   enabled: 0 blocks the account without deleting it
############################################################

class SystemUser(models.Model):
    email = models.CharField(max_length=255, unique=True)
    password = models.CharField(max_length=255)
    admin = models.IntegerField(default=1)
    enabled = models.IntegerField(default=0)
    last_login = models.CharField(max_length=32, blank=True, default="")

    def __str__(self):
        return self.email








############################################################
# Student — student account
############################################################
#
# Created through public self-registration (or by an admin).
# The passcode is the login password: a generated 8-digit
# code, stored as plain text ON PURPOSE — it is a system-
# issued access code shown back to the student, not a
# user-chosen secret.
#
#   is_finished:       1 locks the test forever
#   status:            1 = active account
#   registration_time: "YYYY-MM-DD HH:MM:SS" set once at
#                      registration ("" for accounts created
#                      before the column existed)
############################################################

class Student(models.Model):
    username = models.CharField(max_length=255, unique=True)
    passcode = models.CharField(max_length=64)
    is_finished = models.IntegerField(default=0)
    last_login = models.CharField(max_length=32, blank=True, default="")
    status = models.IntegerField(default=1)
    registration_time = models.CharField(max_length=32, blank=True, default="")

    def __str__(self):
        return self.username








############################################################
# Setting — key/value system settings
############################################################
#
# One row per setting, addressed by name. Currently only
# PhishingTestSize (how many questions a new test deals)
# lives here.
############################################################

class Setting(models.Model):
    name = models.CharField(max_length=255, primary_key=True)
    value = models.TextField()

    def __str__(self):
        return self.name
