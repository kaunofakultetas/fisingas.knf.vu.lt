# Architecture

This document is for developers working on or extending the project.

## System Overview

```
┌───────────────────────────────────────────────────────────────┐
│                       Host (Port 80)                          │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                 Caddy Reverse Proxy                     │  │
│  │  /api/*  ───────────────► Django (:8000)                │  │
│  │  /dbgate/* ─────────────► DBGate (:3000)                │  │
│  │  /filebrowser/* ────────► Filebrowser (:80)             │  │
│  │  /swagger* ─────────────► Swagger UI (:8080)            │  │
│  │  /* ────────────────────► Frontend (Vite :80)           │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌──────────────┐ ┌──────────┐ ┌──────────┐                   │
│  │  PostgreSQL  │ │  Slides  │ │ Dropbox  │                   │
│  │ _DATA/       │ │ _DATA/   │ │ _DATA/   │                   │
│  │ postgres/    │ │ slides/  │ │ dropbox/ │                   │
│  └──────────────┘ └──────────┘ └──────────┘                   │
└───────────────────────────────────────────────────────────────┘
```

All services run as Docker containers on an isolated network. Only Caddy is exposed to the host (port 80). Caddy enforces admin-only access to DBGate, Filebrowser and Swagger using forward authentication against the API (`GET /api/checkauth/admin`).

---

## Backend (Django)

**Location:** `django/`

```
django/
├── Dockerfile                       # Image (deps pinned here, no requirements.txt)
├── manage.py
└── fisingas/
    ├── settings.py                  # All settings (env vars for secrets/DB)
    ├── urls.py                      # ALL /api/* routes in one place
    ├── common/auth.py               # Custom session auth (admins + students)
    ├── users/                       # SystemUser, Student, Setting
    ├── phishing_test/               # Question bank + denormalized answers
    │   └── grading.py               # All grade math
    └── leaderboard/                 # Public leaderboard + slide rotation
```

### Key Design Decisions

- **PostgreSQL** (`fisingas-postgres` container, data in `_DATA/postgres/`) with plain `django.db.backends.postgresql`.
- **Denormalized answers** — dealing a test to a student freezes a copy of each question's text, correct verdict, image link and options into the answer tables. Grades are computed from those frozen copies (`phishing_test/grading.py`), so editing or deleting questions can never change grades that were already given.
- **Upload-only images** — screenshots live in a separate `QuestionImage` table, referenced with `PROTECT` from both the live question and the frozen answer snapshots. Deleting a question keeps its image; `GET /api/phishingpictures/<id>` falls back to the snapshot link when the question no longer exists.
- **Links belong to the image** — the clickable tooltip areas (`QuestionLink`) hang off `QuestionImage`, not the question, since their coordinates only make sense on that exact image. Old graded tests keep their tooltips even after the question is deleted.
- **No Django admin panel and no `django.contrib.auth`** — data is managed through the React admin UI; auth is a custom session scheme (bcrypt for admins, plaintext passcodes for students). Sessions are stored in PostgreSQL, in a cookie named `session` (HttpOnly off — the login page logs out by deleting it from JavaScript). Disabled accounts are refused at login and lose any live session on their next request.
- **Admin passwords** are hashed with bcrypt (12 rounds). **Student passcodes** are random 8-digit numbers stored as plain text (by design — they are system-generated access codes, not user-chosen passwords).
- **Timing attack prevention** — failed login attempts still run a bcrypt comparison against a dummy hash to prevent timing-based user enumeration.
- **No CSRF middleware** — same-origin enforcement happens at the Caddy endpoint (Origin header check).

### Database Tables

| Table | Purpose |
|-------|---------|
| `users_systemuser` | Administrator accounts (email, bcrypt password hash) |
| `users_student` | Student accounts (username, passcode, completion status) |
| `users_setting` | Key-value settings (e.g. `PhishingTestSize`) |
| `phishing_test_questionimage` | Email screenshots (upload-only BLOBs) |
| `phishing_test_question` | The live question bank |
| `phishing_test_questionoption` | Answer options for each question |
| `phishing_test_questionlink` | Clickable areas on images (x, y, width, height) |
| `phishing_test_answer` | Frozen per-question snapshot + the student's verdict |
| `phishing_test_answerselectedoption` | Frozen per-option snapshot + the student's checkbox |
| `django_session` | Session storage |

### Scoring

Each question is worth 1 point maximum:

```
Points = 1 - (TotalOptions × 0.1) + (CorrectOptions × 0.1)
```

- Points are awarded **only if** the main answer (Real/Phishing) is correct. If the main answer is wrong, the question scores 0.
- Final grade: `(TotalPoints / QuestionCount) × 10`, rounded to 2 decimals.
- A score of 10.00 means every question was answered perfectly.

---

## Frontend (Vite + React)

**Location:** `vite/`

A single-page React 19 application built with Vite, MUI and Tailwind CSS v4 — see [vite/README.md](../vite/README.md) for the folder layout and route table.

### Authentication Flow

1. User submits credentials at `/login` — the backend sets a `session` cookie
2. On app start, `AuthProvider` calls `GET /api/checkauth` to verify the session
3. The response includes an `admin` flag; the route guards redirect by role
4. Unauthorized users are redirected to `/login`

### Key Dependencies

| Package | Purpose |
|---------|---------|
| `@mui/material`, `@mui/x-data-grid` | UI components and data tables |
| `axios` | HTTP client |
| `tailwindcss` | Utility-first styling (hardcoded in place) |
| `react-dropzone` | File upload for question images |
| `react-hot-toast` | Notification toasts |
| `react-rnd` | Draggable/resizable elements (image link editor) |
| `react-icons` | Icon library |

---

## Caddy (Reverse Proxy)

**Location:** `endpoint/Caddyfile`

Caddy is the single entry point for all traffic. It handles:

- **Routing** — directs requests to the correct container based on URL path
- **Security headers** — enforces a strict Content Security Policy
- **Same-origin enforcement** — requests with a foreign Origin header are rejected with 403 (this is the CSRF protection)
- **Forward authentication** — protects admin-only tools (DBGate, Filebrowser, Swagger) by checking `/api/checkauth/admin` before allowing access

---

## Filebrowser

**Location:** `filebrowser/`

Two instances share the same Docker image but serve different directories:

| Instance | URL Path | Data Directory | Purpose |
|----------|----------|---------------|---------|
| Dropbox | `/filebrowser/dropbox` | `_DATA/dropbox/` | General file uploads |
| Slides | `/filebrowser/slides` | `_DATA/slides/` | Slide images for presentation mode |

Both run with no internal authentication (Caddy handles auth via `forward_auth`). Custom branding with VU KnF theme is applied at build time through Docker build args.

---

## Development

See the [Deployment Guide](DEPLOYMENT.md#running-in-development) for instructions on running the project locally.
