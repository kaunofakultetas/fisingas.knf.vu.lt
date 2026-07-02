############################################################
#  [*] Session authentication
#
#  Only the login name lives in the session; the user is
#  re-loaded from the database on every request, so a
#  deleted or renamed account is locked out immediately —
#  no stale identity can survive inside a cookie.
#
#    login(request, user)      → stores the login name
#    get_current_user(request) → re-loads the user, or None
#    @login_required           → 401 when not logged in,
#                                else sets request.current_user
#
#  A "user" is either an administrator (SystemUser, login
#  name is the email — always contains '@') or a student
#  (login name is the username — uppercase A-Z/0-9/_ only,
#  never '@'). The two can never collide, so one session
#  scheme serves both.
############################################################


import json
from dataclasses import dataclass
from functools import wraps

from django.http import HttpResponse

from fisingas.users.models import Student, SystemUser








############################################################
# SessionUser
############################################################
#
# The authenticated user attached to a request as
# request.current_user by @login_required. A plain snapshot,
# not a model instance — views branch on .admin and read
# .userid without caring which table the account came from.
#
# Used by:
#   - every view behind @login_required
#   - auth_views.login_view — via load_user, for the
#     password check
############################################################

@dataclass
class SessionUser:
    id: str             # login name — email (admins) or username (students)
    userid: int         # SystemUser.id or Student.id
    admin: int          # 1 = administrator, 0 = student (int — the API exposes it as 0/1)
    password: str       # bcrypt hash (admins) / plaintext passcode (students)








############################################################
# load_user
############################################################
#
# Find one user by login name across BOTH account tables.
# Returns None unless exactly one match exists — if a name
# somehow existed in both tables, logging in would be
# refused instead of guessing which account was meant.
#
# Used by:
#   - auth_views.login_view — resolves the submitted name
#   - get_current_user (below) — resolves the session name
############################################################

def load_user(username):
    matches = []

    for admin in SystemUser.objects.filter(email=username):
        matches.append(SessionUser(id=admin.email, userid=admin.id, admin=1, password=admin.password))

    for student in Student.objects.filter(username=username):
        matches.append(SessionUser(id=student.username, userid=student.id, admin=0, password=student.passcode))

    if len(matches) != 1:
        return None
    return matches[0]








############################################################
# login
############################################################
#
# Start a session for the given SessionUser. Writing to
# request.session makes Django create the session row and
# set the cookie on the response; only the login name is
# stored — everything else is re-loaded per request.
#
# Used by:
#   - auth_views.login_view — after the password check passes
############################################################

def login(request, user):
    request.session["username"] = user.id








############################################################
# get_current_user
############################################################
#
# The SessionUser for this request, or None when not logged
# in (no session, or the account no longer exists).
#
# Used by:
#   - login_required (below)
############################################################

def get_current_user(request):
    username = request.session.get("username")
    if not username:
        return None
    return load_user(username)








############################################################
# login_required (decorator)
############################################################
#
# Rejects anonymous requests with a plain 401 and attaches
# the loaded user as request.current_user otherwise. Only
# guarantees SOME logged-in user — admin checks are done
# inside each view, because several endpoints serve both
# roles with different behaviour.
#
# Used by:
#   - every non-public view in users/, phishing_test/
############################################################

def login_required(view):
    @wraps(view)
    def wrapper(request, *args, **kwargs):
        user = get_current_user(request)
        if user is None:
            return HttpResponse("Unauthorized", status=401)
        request.current_user = user
        return view(request, *args, **kwargs)

    return wrapper








############################################################
# get_json
############################################################
#
# Parse the request body as JSON; None when empty or
# invalid. Views index into the result directly and let a
# malformed body fail loudly rather than validating field
# by field.
#
# Used by:
#   - every POST view in users/, phishing_test/
############################################################

def get_json(request):
    try:
        return json.loads(request.body)
    except (ValueError, TypeError):
        return None
