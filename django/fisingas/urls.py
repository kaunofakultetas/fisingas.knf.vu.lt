############################################################
#  [*] URL routing — the complete /api/* surface
#
#  Every path (and its response shape) matches the Flask
#  backend one-to-one, so the frontend works unchanged no
#  matter which backend Caddy points at.
############################################################


from django.urls import path



urlpatterns = []




# ------------------------------------------------------------
# Users: authentication, administrators, students
# ------------------------------------------------------------
from fisingas.users.api.auth_views import checkauth, checkauth_admin, login_view
from fisingas.users.api.administrators_views import administrators
from fisingas.users.api.students_views import student_detail, student_register, students_list

urlpatterns += [
    path("api/login", login_view),
    path("api/checkauth", checkauth),
    path("api/checkauth/admin", checkauth_admin),

    path("api/admin/administrators", administrators),
    path("api/admin/students", students_list),
    path("api/admin/students/<int:studentID>", student_detail),

    path("api/student/register", student_register),
]
# ------------------------------------------------------------
# ------------------------------------------------------------
# ------------------------------------------------------------




# ------------------------------------------------------------
# Phishing test: taking the test, grading, question bank
# ------------------------------------------------------------
from fisingas.phishing_test.api.student_views import student_finish, student_questions
from fisingas.phishing_test.api.admin_views import admin_home, questions_list, questions_update
from fisingas.phishing_test.api.admin_views import student_answers, studentgroups, update_phishingtestsize
from fisingas.phishing_test.api.pictures_views import get_picture, picture_links, upload_picture

urlpatterns += [
    path("api/student/questions", student_questions),
    path("api/student/finish", student_finish),

    path("api/admin/home", admin_home),
    path("api/admin/students/<int:studentID>/answers", student_answers),
    path("api/admin/studentgroups", studentgroups),
    path("api/admin/questions", questions_list),
    path("api/admin/questions/<str:action>", questions_update),
    path("api/admin/update/phishingtestsize", update_phishingtestsize),

    path("api/phishingpictures", upload_picture),
    path("api/phishingpictures/<int:questionID>", get_picture),
    path("api/phishingpictures/<int:questionID>/links", picture_links),
]
# ------------------------------------------------------------
# ------------------------------------------------------------
# ------------------------------------------------------------




# ------------------------------------------------------------
# Leaderboard: public projector endpoints
# ------------------------------------------------------------
from fisingas.leaderboard.api.views import leaderboard, nextslide

urlpatterns += [
    path("api/leaderboard", leaderboard),
    path("api/leaderboard/nextslide", nextslide),
]
# ------------------------------------------------------------
# ------------------------------------------------------------
# ------------------------------------------------------------
