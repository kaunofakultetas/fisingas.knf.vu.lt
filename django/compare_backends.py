############################################################
#  [*] Parity check: Django vs Flask responses
#
#  Run inside the fisingas-django container:
#      python3 compare_backends.py
#
#  Compares the public leaderboard (grades of all students)
#  and, logged in as a finished student, their checkauth /
#  detail / graded-answers endpoints on both backends.
############################################################


import json
import urllib.request


DJANGO = "http://localhost:8000"
FLASK = "http://fisingas-backend:8080"




def fetch(base, path, cookie=None, post=None):
    request = urllib.request.Request(base + path)
    if cookie:
        request.add_header("Cookie", cookie)
    if post is not None:
        request.add_header("Content-Type", "application/json")
        request.data = json.dumps(post).encode()
    response = urllib.request.urlopen(request)
    return response




def login(base, username, password):
    response = fetch(base, "/api/login", post={"username": username, "password": password})
    assert response.read() == b"OK", "login failed"
    cookie = response.headers.get("Set-Cookie").split(";")[0]
    return cookie




def diff(name, django_data, flask_data):
    if django_data == flask_data:
        print(f"OK    {name}")
        return

    print(f"DIFF  {name}")
    if isinstance(django_data, list) and isinstance(flask_data, list):
        flask_by_id = {row.get("id"): row for row in flask_data}
        shown = 0
        for django_row in django_data:
            flask_row = flask_by_id.get(django_row.get("id"))
            if django_row != flask_row and shown < 5:
                print("  django:", json.dumps(django_row, ensure_ascii=False)[:300])
                print("  flask: ", json.dumps(flask_row, ensure_ascii=False)[:300])
                shown += 1
    else:
        print("  django:", json.dumps(django_data, ensure_ascii=False)[:500])
        print("  flask: ", json.dumps(flask_data, ensure_ascii=False)[:500])




# ------------------------------------------------------------
# Public: leaderboard (grades of all 600+ students)
# ------------------------------------------------------------
django_board = json.load(fetch(DJANGO, "/api/leaderboard"))
flask_board = json.load(fetch(FLASK, "/api/leaderboard"))
diff("/api/leaderboard", django_board, flask_board)




# ------------------------------------------------------------
# As a finished student: checkauth, detail, graded answers
# ------------------------------------------------------------
finished = [row for row in flask_board if row["isfinished"] == 1 and row["questioncount"] != ""]
print(f"\nFinished students: {len(finished)}")

import psycopg2  # credentials needed for login — read passcode from Postgres
connection = psycopg2.connect("dbname=fisingas user=fisingas password=fisingas host=fisingas-postgres")


def normalize_answers(rows):
    """Option order inside a question differs (Flask: SQLite scan order,
    Django: by option ID) and does not matter to the UI — sort it away."""
    return sorted(
        [{**row, "answeredoptions": sorted(row["answeredoptions"], key=lambda o: o["optiontext"])} for row in rows],
        key=lambda row: row["id"],
    )


mismatches = 0
for index, row in enumerate(finished[:30]):  # newest first — recent students matter most
    cursor = connection.cursor()
    cursor.execute("SELECT username, passcode FROM users_student WHERE id = %s", [row["id"]])
    username, passcode = cursor.fetchone()

    django_cookie = login(DJANGO, username, passcode)
    flask_cookie = login(FLASK, username, passcode)

    detail_path = f"/api/admin/students/{row['id']}"
    django_detail = json.load(fetch(DJANGO, detail_path, cookie=django_cookie))
    flask_detail = json.load(fetch(FLASK, detail_path, cookie=flask_cookie))

    answers_path = f"{detail_path}/answers"
    django_answers = normalize_answers(json.load(fetch(DJANGO, answers_path, cookie=django_cookie)))
    flask_answers = normalize_answers(json.load(fetch(FLASK, answers_path, cookie=flask_cookie)))

    if django_detail != flask_detail or django_answers != flask_answers:
        mismatches += 1
        diff(detail_path, django_detail, flask_detail)
        diff(answers_path, django_answers, flask_answers)

print(f"Checked {min(len(finished), 30)} newest finished students (detail + answers), mismatches: {mismatches}")
