############################################################
#  [*] Administrator management endpoints
#
#    GET  /api/admin/administrators — list all admin accounts
#    POST /api/admin/administrators — insertupdate / delete
############################################################


import bcrypt

from django.http import HttpResponse, JsonResponse

from fisingas.common.auth import get_json, login_required
from fisingas.users.models import SystemUser








############################################################
# administrators
############################################################
#
# GET  /api/admin/administrators — every admin account with
#      its enabled flag and last activity.
# POST /api/admin/administrators — one endpoint for all
#      mutations, dispatched by the "action" field:
#
#   insertupdate — id "" creates a new account (the email
#                  must be free and the password at least 8
#                  characters); a non-empty id edits an
#                  existing one, and the password is only
#                  replaced when one was typed in (an empty
#                  field means "keep the current")
#   delete       — removes the account by id
#
# Passwords are stored as bcrypt hashes (12 rounds) — only
# admin accounts have real passwords; students use generated
# passcodes (see students_views.py).
#
# Used by:
#   - AdministratorsList.jsx     — the accounts table
#   - AddEditAdministrator.jsx   — the create/edit dialog
############################################################

@login_required
def administrators(request):
    if not request.current_user.admin:
        return HttpResponse("Error: Not Admin")


    if request.method == "GET":
        return JsonResponse([
            {
                "id": admin.id,
                "email": admin.email,
                "enabled": admin.enabled,
                "lastseen": admin.last_login,
            }
            for admin in SystemUser.objects.order_by("id")
        ], safe=False)


    elif request.method == "POST":
        postData = get_json(request)
        if postData is None or "action" not in postData:
            return JsonResponse({"type": "error", "reason": "Invalid request body"}, status=400)

        if postData["action"] == "insertupdate":
            password = postData.get("password", "")

            # A typed-in password must meet the minimum length —
            # both when creating and when changing an existing one
            if len(password) != 0 and len(password) < 8:
                return JsonResponse({"type": "error", "reason": "Password must be at least 8 characters long"})

            # New account — the password is mandatory and the
            # email must not be taken by another account
            if postData["id"] == "":
                if len(password) == 0:
                    return JsonResponse({"type": "error", "reason": "Password must be at least 8 characters long"})
                if SystemUser.objects.filter(email=postData["email"]).exists():
                    return JsonResponse({"type": "error", "reason": "Administrator with this email already exists"})

                SystemUser.objects.create(
                    email=postData["email"],
                    password=bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode(),
                    enabled=postData["enabled"],
                )

            # Existing account — password only changed when one was typed in
            else:
                updatedFields = {
                    "email": postData["email"],
                    "enabled": postData["enabled"],
                }
                if len(password) != 0:
                    updatedFields["password"] = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()

                SystemUser.objects.filter(id=postData["id"]).update(**updatedFields)

            return JsonResponse({"type": "ok"})


        elif postData["action"] == "delete":
            SystemUser.objects.filter(id=postData["id"]).delete()
            return JsonResponse({"type": "ok"})

        return JsonResponse({"type": "error"})
