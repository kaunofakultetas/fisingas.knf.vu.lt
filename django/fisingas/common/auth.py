############################################################
#  [*] Session authentication — replicates Flask-Login
#
#  The Flask backend kept only the login name in the session
#  cookie and re-loaded the user from the database on every
#  request (user_loader). This module does the same on top of
#  Django's DB-backed sessions:
#
#    - login(request, user)      → stores the login name
#    - get_current_user(request) → re-loads the user, or None
#    - @login_required           → 401 when not logged in,
#                                  else sets request.current_user
#
#  A "user" is either an administrator (SystemUser, login name
#  is the email — always contains '@') or a student (login name
#  is the username — uppercase A-Z/0-9/_ only, never '@').
############################################################


import json
from dataclasses import dataclass
from functools import wraps

from django.http import HttpResponse

from fisingas.users.models import Student, SystemUser




@dataclass
class SessionUser:
    """The authenticated user attached to a request (request.current_user)."""

    id: str             # login name — email (admins) or username (students)
    userid: int         # SystemUser.id or Student.id
    admin: int          # 1 = administrator, 0 = student (int, like the Flask API)
    password: str       # bcrypt hash (admins) / plaintext passcode (students)




def load_user(username):
    """
    Find one user by login name across both account tables — the
    equivalent of the Flask user_loader UNION query. Returns None
    unless exactly one match exists.
    """
    matches = []

    for admin in SystemUser.objects.filter(email=username):
        matches.append(SessionUser(id=admin.email, userid=admin.id, admin=1, password=admin.password))

    for student in Student.objects.filter(username=username):
        matches.append(SessionUser(id=student.username, userid=student.id, admin=0, password=student.passcode))

    if len(matches) != 1:
        return None
    return matches[0]




def login(request, user):
    """Start a session for the given SessionUser."""
    request.session["username"] = user.id




def get_current_user(request):
    """The SessionUser for this request, or None when not logged in."""
    username = request.session.get("username")
    if not username:
        return None
    return load_user(username)




def login_required(view):
    """
    Reject anonymous requests with 401 (like Flask-Login's
    @login_required without a login view) and attach the loaded
    user as request.current_user otherwise.
    """
    @wraps(view)
    def wrapper(request, *args, **kwargs):
        user = get_current_user(request)
        if user is None:
            return HttpResponse("Unauthorized", status=401)
        request.current_user = user
        return view(request, *args, **kwargs)

    return wrapper




def get_json(request):
    """Parse the request body as JSON; None when empty or invalid."""
    try:
        return json.loads(request.body)
    except (ValueError, TypeError):
        return None
