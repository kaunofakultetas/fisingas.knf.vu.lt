# Django Backend

The API service of the phishing test: Django + PostgreSQL, serving the
**whole `/api/*` surface** the React frontend talks to.

## Layout

```
django/
├── Dockerfile                       # Image (deps pinned here, no requirements.txt)
├── manage.py
└── fisingas/
    ├── settings.py                  # All settings (env vars for secrets/DB)
    ├── urls.py                      # ALL /api/* routes in one place
    ├── wsgi.py
    ├── common/
    │   └── auth.py                  # Custom session auth (admins + students)
    ├── users/
    │   ├── models.py                # SystemUser, Student, Setting
    │   └── api/
    │       ├── auth_views.py        # login, checkauth, checkauth/admin
    │       ├── administrators_views.py
    │       └── students_views.py    # students list/detail, register
    ├── phishing_test/
    │   ├── models.py                # Question bank + denormalized answers
    │   ├── grading.py               # All grade math
    │   └── api/
    │       ├── student_views.py     # questions (deal/save), finish
    │       ├── admin_views.py       # home, answers, question editing
    │       └── pictures_views.py    # image upload/serving, clickable links
    └── leaderboard/
        └── api/views.py             # public leaderboard, nextslide
```

## Key design decisions

- **Denormalized answers.** When a test is dealt to a student, the question
  text, the correct verdict, the image link and every option (text + expected
  value) are copied into `Answer` / `AnswerSelectedOption`. Grades depend only
  on these frozen copies — admins can edit or delete questions and options
  without breaking grades that were already given.
- **Upload-only images.** Screenshots live in their own `QuestionImage` table,
  referenced with `PROTECT` from both the live question and the frozen answer
  snapshots. Deleting a question keeps its image, and
  `GET /api/phishingpictures/<id>` falls back to the snapshot link when the
  question is gone — old graded tests keep their pictures forever.
- **Links belong to the image.** The clickable tooltip areas (`QuestionLink`)
  hang off `QuestionImage`, not the question — their coordinates only make
  sense on that exact image, and since answer snapshots reference the image
  too, old graded tests keep their tooltips after the question is deleted.
  The API still addresses them by question ID
  (`/api/phishingpictures/<id>/links`) — that is what the frontend has on hand.
- **No Django admin / no django.contrib.auth.** All data is managed through
  the React admin UI; authentication is a custom session scheme (bcrypt
  passwords for admins, generated plaintext passcodes for students). Disabled
  accounts are refused at login and lose any live session on their next
  request.
- **Sessions live in PostgreSQL** (`django_session`) — no Redis. The cookie
  is named `session` with `HttpOnly` off, because the login page logs out by
  deleting that cookie from JavaScript.
- **No CSRF middleware** — same-origin enforcement happens at the Caddy
  endpoint (Origin header check).
- **Grading** is pure Python in `phishing_test/grading.py`:
  `points = 1 − 0.1·options + 0.1·correct_options` when the verdict is right,
  else 0; `grade = points_sum / question_count × 10` (2 decimals).

## Everyday commands (inside the container)

```bash
# Apply migrations
sudo docker exec fisingas-django python3 manage.py migrate

# Sanity-check the configuration
sudo docker exec fisingas-django python3 manage.py check
```
