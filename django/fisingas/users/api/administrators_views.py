############################################################
#  [*] Administrator management endpoints
#
#    GET  /api/admin/administrators — list all admin accounts
#    POST /api/admin/administrators — insertupdate / delete
############################################################


import bcrypt

from django.http import HttpResponse, JsonResponse

from fisingas.common.timestamps import to_api
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
#                  characters and at most 72 bytes — the
#                  bcrypt input limit); a non-empty id edits an
#                  existing one (same unique-email rule), and
#                  the password is only replaced when one was
#                  typed in (an empty field means "keep the
#                  current"); disabling your own account is
#                  refused (self-lockout guard)
#   delete       — removes the account by id (never your own)
#
# Passwords are stored as bcrypt hashes (12 rounds) — only
# admin accounts have real passwords; students use generated
# passcodes (see students_views.py).
#
# Used by:
#   - AdministratorsList.jsx     — the accounts table
#   - AddEditAdministrator.jsx   — the create/edit dialog
############################################################

def _is_account_id(value):
    # "" = create; otherwise a positive integer, as a number or a
    # digit string (the form sends what the grid gave it)
    if value == "":
        return True
    if isinstance(value, bool):
        return False
    if isinstance(value, int):
        return value > 0
    return isinstance(value, str) and value.isdigit()


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
                "lastseen": to_api(admin.last_login),
            }
            for admin in SystemUser.objects.order_by("id")
        ], safe=False)


    elif request.method == "POST":
        postData = get_json(request)
        if not isinstance(postData, dict) or "action" not in postData:
            return JsonResponse({"type": "error", "reason": "Invalid request body"}, status=400)

        if postData["action"] == "insertupdate":
            # Field shape first — a body that is not what the admin
            # form sends is refused with a 400 instead of a crash
            email = postData.get("email")
            password = postData.get("password", "")
            enabled = postData.get("enabled")
            accountId = postData.get("id")
            if not isinstance(email, str) or len(email) > 255:
                return JsonResponse({"type": "error", "reason": "Invalid email"}, status=400)
            if not isinstance(password, str):
                return JsonResponse({"type": "error", "reason": "Invalid password"}, status=400)
            if not _is_account_id(accountId):
                return JsonResponse({"type": "error", "reason": "Invalid id"}, status=400)
            if isinstance(enabled, bool) or enabled not in (0, 1, "0", "1"):
                return JsonResponse({"type": "error", "reason": "Invalid enabled flag"}, status=400)
            enabled = int(enabled)

            # The login name decides the role by its "@": an
            # administrator without one would be routed into the
            # student branch and could never log in
            if "@" not in email:
                return JsonResponse({"type": "error", "reason": "Email address must contain @"})

            # A typed-in password must meet the minimum length —
            # both when creating and when changing an existing one
            if len(password) != 0 and len(password) < 8:
                return JsonResponse({"type": "error", "reason": "Password must be at least 8 characters long"})

            # ...and must fit bcrypt's 72-BYTE input limit: bcrypt
            # silently ignores everything past byte 72, so a longer
            # password would authenticate on its truncated prefix.
            # Counted in UTF-8 bytes, not characters — Lithuanian
            # letters are 2 bytes each, so 37 of them already exceed it
            if len(password.encode()) > 72:
                return JsonResponse({"type": "error", "reason": "Password must be at most 72 bytes long"})

            # New account — the password is mandatory and the
            # email must not be taken by another account
            if accountId == "":
                if len(password) == 0:
                    return JsonResponse({"type": "error", "reason": "Password must be at least 8 characters long"})
                if SystemUser.objects.filter(email=email).exists():
                    return JsonResponse({"type": "error", "reason": "Administrator with this email already exists"})

                SystemUser.objects.create(
                    email=email,
                    password=bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode(),
                    enabled=enabled,
                )

            # Existing account — password only changed when one was typed in
            else:
                # The email must stay unique on edit too — otherwise
                # the update dies on the DB constraint as a raw 500
                if SystemUser.objects.filter(email=email).exclude(id=accountId).exists():
                    return JsonResponse({"type": "error", "reason": "Administrator with this email already exists"})

                # An admin must not disable their OWN account — the
                # session dies on the next request, and if they were
                # the last enabled admin nobody could log in to undo it
                if int(accountId) == request.current_user.userid and enabled == 0:
                    return JsonResponse({"type": "error", "reason": "You cannot disable your own account"})

                updatedFields = {
                    "email": email,
                    "enabled": enabled,
                }
                if len(password) != 0:
                    updatedFields["password"] = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()

                SystemUser.objects.filter(id=accountId).update(**updatedFields)

            return JsonResponse({"type": "ok"})


        elif postData["action"] == "delete":
            accountId = postData.get("id")
            if not _is_account_id(accountId) or accountId == "":
                return JsonResponse({"type": "error", "reason": "Invalid id"}, status=400)

            # Same self-lockout guard as disabling: whoever is logged
            # in can never remove themselves, so at least one working
            # admin account survives any sequence of actions
            if int(accountId) == request.current_user.userid:
                return JsonResponse({"type": "error", "reason": "You cannot delete your own account"})

            SystemUser.objects.filter(id=accountId).delete()
            return JsonResponse({"type": "ok"})

        return JsonResponse({"type": "error"})

    return HttpResponse(status=405)
