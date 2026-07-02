############################################################
#  [*] Authentication endpoints
#
#    POST /api/login           — plain-text 'OK' or a message
#    GET  /api/checkauth       — the logged-in user's info
#    GET  /api/checkauth/admin — admin gate (Caddy forward_auth)
#
#  One login form serves two kinds of accounts: admins log
#  in with an email + bcrypt-checked password, students with
#  a username + generated passcode. The "@" in the login
#  name is what tells them apart (see common/auth.py).
############################################################


import bcrypt
from datetime import datetime

from django.http import HttpResponse, JsonResponse

from fisingas.common.auth import get_json, load_user, login, login_required
from fisingas.users.models import Student, SystemUser


# Any valid bcrypt hash — checked against a dummy password when the user does
# not exist, so response timing does not reveal which usernames are taken.
DUMMY_BCRYPT_HASH = b"$2b$12$37rvWwtdP/sb.pZwBklPFeUxoH.KWOXIDjTxiiC9awCYpXIB8EbmS"








############################################################
# login_view
############################################################
#
# POST /api/login — body {username, password}. Responds with
# plain text: "OK" on success, otherwise a Lithuanian
# message the login page shows verbatim. On success the
# session cookie is set (see common/auth.py).
#
# The failure message never reveals whether the account
# exists, and a dummy bcrypt check keeps the response time
# identical either way (no user enumeration by timing).
#
# Used by:
#   - Login.jsx — the sign-in form
############################################################

def login_view(request):
    postData = get_json(request)

    # Preauth Checks
    if not postData or (not postData.get("username") and not postData.get("password")):
        return HttpResponse("Įveskite Prisijungimo Vardą ir Slaptažodį.")

    if not postData.get("username"):
        return HttpResponse("Įveskite Prisijungimo Vardą.")

    if not postData.get("password"):
        return HttpResponse("Įveskite Slaptažodį.")


    # Authentication
    thisUserObject = load_user(postData["username"])
    if thisUserObject is not None:

        # Admin Login Check (login name is an email → bcrypt hash).
        # A corrupt hash in the database counts as a wrong
        # password instead of crashing the endpoint
        if "@" in thisUserObject.id:
            try:
                passwordOk = bcrypt.checkpw(postData["password"].encode(), thisUserObject.password.encode())
            except ValueError:
                passwordOk = False

            if passwordOk:
                login(request, thisUserObject)
                return HttpResponse("OK")
            return HttpResponse("El. Paštas ir/arba Slaptažodis neteisingas.")

        # Student Login Check (plaintext passcode)
        else:
            if postData["password"] == thisUserObject.password:
                login(request, thisUserObject)
                return HttpResponse("OK")
            return HttpResponse("Vardas ir/arba Slaptažodis neteisingas.")


    else:
        # Dummy check to prevent time-based user enumeration
        bcrypt.checkpw(b"Prevents time based user enumeration attack.", DUMMY_BCRYPT_HASH)
        if "@" in postData["username"]:
            return HttpResponse("El. Paštas ir/arba Slaptažodis neteisingas.")
        else:
            return HttpResponse("Vardas ir/arba Slaptažodis neteisingas.")








############################################################
# checkauth
############################################################
#
# GET /api/checkauth — who is logged in. The frontend calls
# this on every page load to decide what to render; every
# call also bumps the user's LastLogin, which is what the
# "last seen" columns and the dashboard's 30-minute activity
# list are built on.
#
# Students additionally get their passcode (shown on their
# profile) and whether their test is already finished.
#
# Used by:
#   - AuthProvider.jsx — the session context around the app
############################################################

@login_required
def checkauth(request):
    timeNow = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    user = request.current_user

    # All Users
    user_info = {
        "id": user.id,
        "userid": user.userid,
        "admin": user.admin,
    }


    # Admin
    if user.admin:
        SystemUser.objects.filter(id=user.userid).update(last_login=timeNow)


    # Student
    else:
        user_info["passcode"] = user.password

        Student.objects.filter(id=user.userid).update(last_login=timeNow)

        user_info["phishingtestfinished"] = Student.objects.get(id=user.userid).is_finished


    return JsonResponse(user_info)








############################################################
# checkauth_admin
############################################################
#
# GET /api/checkauth/admin — 200 with the user info for
# admins, 401 for everyone else. Caddy calls this as
# forward_auth before letting requests through to the
# admin-only services (filebrowser), so admin rights are
# enforced at the gateway, not just in the UI.
#
# Used by:
#   - Caddy (endpoint/Caddyfile) — the admin_auth snippet
############################################################

@login_required
def checkauth_admin(request):
    timeNow = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    user = request.current_user

    if user.admin:
        SystemUser.objects.filter(id=user.userid).update(last_login=timeNow)

        return JsonResponse({
            "id": user.id,
            "userid": user.userid,
            "admin": user.admin,
        })

    return JsonResponse({"message": "Unauthorized"}, status=401)
