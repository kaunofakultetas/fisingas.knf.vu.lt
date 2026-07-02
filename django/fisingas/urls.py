############################################################
#  [*] URL routing — the complete /api/* surface
#
#  Every route of the service in one file, grouped by app,
#  with each group's imports next to its paths — so this
#  file reads as a table of contents for the whole API.
#
#  Caddy proxies /api/* here and everything else to the
#  frontend, which is why every path carries the api/
#  prefix explicitly. There are no trailing slashes
#  anywhere (APPEND_SLASH is off in settings.py).
#
#  Who may call what is not decided here — @login_required
#  and the per-view admin checks handle that, and the
#  leaderboard group is deliberately open to everyone.
############################################################


from django.urls import path


# Initialize the urlpatterns list
urlpatterns = []







############################################################
# Users — authentication, administrators, students
############################################################
#
# Session login for both account kinds, the admin account
# management, the admin students table, and the public
# self-registration (the only unauthenticated path in this
# group).
#
# Views live in fisingas/users/api/.
############################################################

from fisingas.users.api.auth_views import checkauth, checkauth_admin, login_view
from fisingas.users.api.administrators_views import administrators
from fisingas.users.api.students_views import student_delete, student_detail, student_register, students_list

urlpatterns += [
    path("api/login", login_view),                                        # POST — plain-text "OK" or an error message
    path("api/checkauth", checkauth),                                     # GET  — who is logged in (called on every page load)
    path("api/checkauth/admin", checkauth_admin),                         # GET  — admin gate, also used by Caddy forward_auth

    path("api/admin/administrators", administrators),                     # GET list / POST insertupdate + delete
    path("api/admin/students", students_list),                            # GET  — every student with grading totals
    path("api/admin/students/<int:studentID>", student_detail),           # GET  — one student (also their own results page)
    path("api/admin/students/<int:studentID>/delete", student_delete),    # POST — remove the account with its test

    path("api/student/register", student_register),                       # POST — public self-registration, returns the passcode
]








############################################################
# Phishing test — taking the test, grading, question bank
############################################################
#
# The student test flow (deal / save / finish), the admin
# dashboard and answer review, the question bank editor,
# and the question images with their clickable areas.
#
# Views live in fisingas/phishing_test/api/.
############################################################

from fisingas.phishing_test.api.student_views import student_finish, student_questions
from fisingas.phishing_test.api.admin_views import admin_home, questions_list, questions_update
from fisingas.phishing_test.api.admin_views import student_answers, update_phishingtestsize
from fisingas.phishing_test.api.pictures_views import get_picture, picture_links, upload_picture

urlpatterns += [
    path("api/student/questions", student_questions),                     # GET deals + returns the test / POST saves answers
    path("api/student/finish", student_finish),                           # GET  — lock the test, no way back

    path("api/admin/home", admin_home),                                   # GET  — dashboard counters + live progress
    path("api/admin/students/<int:studentID>/answers", student_answers),  # GET  — the graded test, question by question
    path("api/admin/questions", questions_list),                          # GET  — the whole question bank + counters
    path("api/admin/questions/<str:action>", questions_update),           # POST — createnewoption / updatequestion / deleteoption / deletequestion
    path("api/admin/update/phishingtestsize", update_phishingtestsize),   # POST — how many questions a test deals

    path("api/phishingpictures", upload_picture),                         # POST — upload an image → new empty question
    path("api/phishingpictures/<int:questionID>", get_picture),           # GET  — the raw image bytes
    path("api/phishingpictures/<int:questionID>/links", picture_links),   # GET list / POST replace the clickable areas
]








############################################################
# Leaderboard — public projector endpoints
############################################################
#
# No authentication on purpose: this is what the projector
# shows on the big screen during events.
#
# Views live in fisingas/leaderboard/api/.
############################################################

from fisingas.leaderboard.api.views import leaderboard, nextslide

urlpatterns += [
    path("api/leaderboard", leaderboard),                                 # GET  — live grades of everyone, newest first
    path("api/leaderboard/nextslide", nextslide),                         # GET  — a random slide image from the slides share
]
