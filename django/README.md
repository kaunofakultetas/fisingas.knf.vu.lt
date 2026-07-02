# Django Backend

The Django + PostgreSQL replacement of the legacy Flask + SQLite backend.
It reimplements the **whole `/api/*` surface with identical paths and
response shapes**, so the frontend works unchanged no matter which backend
Caddy points at.

## Layout

```
django/
├── Dockerfile                       # Image (deps pinned here, no requirements.txt)
├── manage.py
├── compare_backends.py              # Parity check: Django vs Flask responses
└── fisingas/
    ├── base.py                      # Base settings (apps, DB, sessions)
    ├── settings.py                  # Env-specific overlay (secret key, debug)
    ├── urls.py                      # ALL /api/* routes in one place
    ├── wsgi.py
    ├── common/
    │   └── auth.py                  # Session auth (replicates Flask-Login)
    ├── users/
    │   ├── models.py                # SystemUser, StudentGroup, Student, Setting
    │   ├── api/
    │   │   ├── auth_views.py        # login, checkauth, checkauth/admin
    │   │   ├── administrators_views.py
    │   │   └── students_views.py    # students list/detail, register
    │   └── management/commands/
    │       └── import_flask_db.py   # One-time SQLite → PostgreSQL import
    ├── phishing_test/
    │   ├── models.py                # Question bank + denormalized answers
    │   ├── grading.py               # All grade math (replaces SQLite views)
    │   └── api/
    │       ├── student_views.py     # questions (deal/save), finish
    │       ├── admin_views.py       # home, answers, groups, question editing
    │       └── pictures_views.py    # image upload/serving, clickable links
    └── leaderboard/
        └── api/views.py             # public leaderboard, nextslide
```

## Key design decisions

- **Denormalized answers.** When a test is dealt to a student, the question
  text, the correct verdict, the image link and every option (text + expected
  value) are copied into `Answer` / `AnswerSelectedOption`. Grades depend only
  on these frozen copies — admins can edit or delete questions and options
  without breaking grades that were already given. (The Flask backend joined
  the live question bank on every request, so any edit silently rewrote
  history.)
- **Upload-only images.** Screenshots live in their own `QuestionImage` table,
  referenced with `PROTECT` from both the live question and the frozen answer
  snapshots. Deleting a question keeps its image, and
  `GET /api/phishingpictures/<id>` falls back to the snapshot link when the
  question is gone — old graded tests keep their pictures forever.
- **Links belong to the image.** The clickable tooltip areas (`QuestionLink`)
  hang off `QuestionImage`, not the question — their coordinates only make
  sense on that exact image, and since answer snapshots reference the image
  too, old graded tests keep their tooltips after the question is deleted.
  The API still addresses them by question ID (`/api/phishingpictures/<id>/links`)
  like Flask did.
- **No Django admin / no django.contrib.auth.** All data is managed through
  the React admin UI; authentication is a custom session scheme that mirrors
  Flask-Login (bcrypt for admins, plaintext passcodes for students).
- **Sessions live in PostgreSQL** (`django_session`) — no Redis. The cookie
  is named `session` with `HttpOnly` off, because the login page logs out by
  deleting that cookie from JavaScript.
- **No CSRF middleware** — same-origin enforcement happens at the Caddy
  endpoint, exactly like it did for Flask.
- **Grading** is pure Python in `phishing_test/grading.py`:
  `points = 1 − 0.1·options + 0.1·correct_options` when the verdict is right,
  else 0; `grade = points_sum / question_count × 10` (2 decimals).

## Everyday commands (inside the container)

```bash
# Apply migrations
sudo docker exec fisingas-django python3 manage.py migrate

# Re-import everything from the Flask SQLite file (wipes Django data first;
# the SQLite file is mounted read-only and copied to /tmp before reading)
sudo docker exec fisingas-django python3 manage.py import_flask_db

# Compare Django vs Flask responses (leaderboard + newest finished students)
sudo docker exec fisingas-django python3 /app/compare_backends.py
```

## Switching backends

Both backends run side by side; Caddy decides who gets the traffic. Edit the
two snippets at the top of `endpoint/Caddyfile` (`api_backend` and
`admin_auth`) to point at either:

- `fisingas-django:8000` — Django (PostgreSQL)
- `fisingas-backend:8080` — Flask (SQLite)

then reload:

```bash
sudo docker exec fisingas-endpoint caddy reload --config /etc/caddy/Caddyfile
```

Sessions are not shared between the backends, so users log in again after a
switch. Data written while Django was live is **not** synced back to SQLite —
re-running `import_flask_db` overwrites the Django side with the SQLite state.
