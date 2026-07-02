############################################################
#  [*] Authentication endpoints
#
#  Response bodies are byte-for-byte compatible with the Flask
#  backend (plain-text Lithuanian messages, same JSON keys):
#    POST /api/login
#    GET  /api/checkauth
#    GET  /api/checkauth/admin   (also used by Caddy forward_auth)
############################################################


import bcrypt
from datetime import datetime

from django.http import HttpResponse, JsonResponse

from fisingas.common.auth import get_json, load_user, login, login_required
from fisingas.users.models import Student, SystemUser


# Any valid bcrypt hash — checked against a dummy password when the user does
# not exist, so response timing does not reveal which usernames are taken.
DUMMY_BCRYPT_HASH = b"$2b$12$37rvWwtdP/sb.pZwBklPFeUxoH.KWOXIDjTxiiC9awCYpXIB8EbmS"




def login_view(request):
    """POST /api/login — body {username, password}, returns 'OK' or a message."""
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

        # Admin Login Check (login name is an email → bcrypt hash)
        if "@" in thisUserObject.id:
            if bcrypt.checkpw(postData["password"].encode(), thisUserObject.password.encode()):
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




@login_required
def checkauth(request):
    """GET /api/checkauth — the logged-in user's info; also bumps LastLogin."""
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




@login_required
def checkauth_admin(request):
    """GET /api/checkauth/admin — 200 for admins, 401 otherwise (Caddy forward_auth)."""
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
