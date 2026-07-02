# Architecture

This document is for developers working on or extending the project.

## System Overview

```
┌───────────────────────────────────────────────────────────────┐
│                       Host (Port 80)                          │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                 Caddy Reverse Proxy                     │  │
│  │  /api/*  ──────┬────────► Django (:8000)  ◄─ ACTIVE     │  │
│  │   (switchable) └ - - - -► Flask (:8080)   ◄─ standby    │  │
│  │  /dbgate/* ─────────────► DBGate (:3000)                │  │
│  │  /filebrowser/* ────────► Filebrowser (:80)             │  │
│  │  /* ────────────────────► Frontend (Vite :80)           │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────┐ ┌──────────┐  │
│  │  PostgreSQL  │ │  SQLite DB   │ │  Slides  │ │ Dropbox  │  │
│  │ _DATA/       │ │ _DATA/       │ │ _DATA/   │ │ _DATA/   │  │
│  │ postgres/    │ │ database/    │ │ slides/  │ │ dropbox/ │  │
│  └──────────────┘ └──────────────┘ └──────────┘ └──────────┘  │
└───────────────────────────────────────────────────────────────┘
```

All services run as Docker containers on an isolated network. Only Caddy is exposed to the host (port 80). Caddy enforces admin-only access to DBGate and Filebrowser using forward authentication against the backend API.

**Two backends implement the same `/api/*` surface:** the Django + PostgreSQL service (active) and the legacy Flask + SQLite service (standby). Which one receives traffic is decided by the two snippets at the top of `endpoint/Caddyfile` — see [Switching backends](../django/README.md#switching-backends).

---

## Backend (Django — active)

**Location:** `django/`

```
django/
├── Dockerfile                       # Image (deps pinned here, no requirements.txt)
├── manage.py
├── compare_backends.py              # Parity check: Django vs Flask responses
└── fisingas/
    ├── settings.py                  # All settings (env vars for secrets/DB)
    ├── urls.py                      # ALL /api/* routes in one place
    ├── common/auth.py               # Session auth (replicates Flask-Login)
    ├── users/                       # SystemUser, StudentGroup, Student, Setting
    │   └── management/commands/
    │       └── import_flask_db.py   # One-time SQLite → PostgreSQL import
    ├── phishing_test/               # Question bank + denormalized answers
    │   └── grading.py               # All grade math (replaces the SQLite views)
    └── leaderboard/                 # Public leaderboard + slide rotation
```

### Key Design Decisions

- **PostgreSQL** (`fisingas-postgres` container, data in `_DATA/postgres/`) with plain `django.db.backends.postgresql` — no PostGIS.
- **Identical API** — every `/api/*` path and response shape matches the Flask backend, so the frontend needs no changes to switch backends.
- **Denormalized answers** — dealing a test to a student freezes a copy of each question's text, correct verdict, image link and options into the answer tables. Grades are computed from those frozen copies (`phishing_test/grading.py`), so editing or deleting questions can no longer change grades that were already given. (The SQLite views joined the live question bank on every request.)
- **Upload-only images** — screenshots live in a separate `QuestionImage` table, referenced with `PROTECT` from both the live question and the frozen answer snapshots. Deleting a question keeps its image; `GET /api/phishingpictures/<id>` falls back to the snapshot link when the question no longer exists.
- **Links belong to the image** — the clickable tooltip areas (`QuestionLink`) hang off `QuestionImage`, not the question, since their coordinates only make sense on that exact image. Old graded tests keep their tooltips even after the question is deleted.
- **No Django admin panel and no `django.contrib.auth`** — data is managed through the React admin UI; auth is a custom session scheme mirroring Flask-Login (bcrypt for admins, plaintext passcodes for students). Sessions are stored in PostgreSQL, in a cookie named `session` (HttpOnly off — the login page logs out by deleting it from JavaScript).
- **Scoring** is unchanged (see [Scoring](#scoring) below), with one deliberate fix: a question with zero options now earns the full 1.0 point when the verdict is right (the views used to count a phantom always-wrong option).
- **Data import** — `python3 manage.py import_flask_db` (inside the container) wipes the Django tables and re-imports everything from the Flask SQLite file, which is mounted read-only and copied to `/tmp` before reading.

---

## Backend (Flask — legacy standby)

**Location:** `backend/`

Kept running (no traffic) until the Django service is considered stable. Nothing about it changed.

```
backend/
├── main.py                    # Entry point (HTTP server or DB maintenance)
├── Dockerfile                 # Production image (Python 3.12 Alpine)
├── app/
│   ├── __init__.py            # App factory, Flask-Login setup, blueprint registration
│   ├── auth/
│   │   ├── routes.py          # Login, auth checks, student registration, admin management
│   │   └── user.py            # Flask-Login User model
│   ├── database/
│   │   ├── db.py              # Database connection helper
│   │   └── db_init.py         # Schema creation (tables, views, indexes, defaults)
│   ├── leaderboard/
│   │   └── routes.py          # Leaderboard data, slide rotation
│   └── phishing_test/
│       └── routes.py          # Questions, answers, images, admin CRUD, dashboard
```

### Key Design Decisions

- **SQLite** -- entire database is a single file, making backups trivial.
- **Flask-Login** -- session-based auth via cookies. The same system authenticates both admins and students.
- **Admin passwords** are hashed with bcrypt (12 rounds). **Student passcodes** are random 8-digit numbers stored as plain text (by design -- they are system-generated access codes, not user-chosen passwords).
- **Question images** are stored as BLOBs directly in the database, not as files on disk.
- **Timing attack prevention** -- failed login attempts still run a bcrypt comparison against a dummy hash to prevent timing-based user enumeration.
- **Dependencies** are installed directly in the Dockerfile (no `requirements.txt`): Flask 3.0.0, Flask-Login 0.6.3, Flask-RESTful 0.3.10, Flask-CORS 4.0.0, bcrypt 4.2.1.

### Database Schema

#### Tables

| Table | Purpose |
|-------|---------|
| `PhishingTest_Questions` | Test questions with text, images (BLOB), and metadata |
| `PhishingTest_QuestionsOptions` | Answer options for each question |
| `PhishingTest_QuestionsLinks` | Clickable areas on question images (x, y, width, height) |
| `PhishingTest_Answers` | Student's main answer per question (Real/Phishing) |
| `PhishingTest_AnswersSelectedOptions` | Student's selected options per question |
| `Users_Students` | Student accounts (username, passcode, group, completion status) |
| `Users_StudentGroups` | Student groups with settings (show answers, time limit) |
| `System_Users` | Administrator accounts (email, bcrypt password hash) |
| `System_Settings` | Key-value settings (e.g., `PhishingTestSize`) |

#### Views

| View | Purpose |
|------|---------|
| `_VIEW_GetUsersAnswers` | Student answers joined with correctness and calculated points |
| `_VIEW_GetUsersAnswersOptions` | Selected options with correctness flags |
| `_VIEW_GetUsersTestResults` | Aggregated test results per student (grade, counts) |

### Scoring

Each question is worth 1 point maximum:

```
Points = 1 - (TotalOptions × 0.1) + (CorrectOptions × 0.1)
```

- Points are awarded **only if** the main answer (Real/Phishing) is correct. If the main answer is wrong, the question scores 0.
- Final grade: `(TotalPoints / QuestionCount) × 10`, rounded to 2 decimals.
- A score of 10.00 means every question was answered perfectly.

---

## Frontend (Next.js)

**Location:** `nextjs/`

Built with Next.js 14 (App Router), React 18, and Material UI.

### Pages

| Route | Access | Purpose |
|-------|--------|---------|
| `/login` | Public | Login and student registration |
| `/` | Login | Redirects to `/admin` or `/student` based on role |
| `/admin` | Admin | Dashboard (student count, question stats, live progress) |
| `/admin/questions` | Admin | Manage test questions |
| `/admin/questions/[questionID]` | Admin | Edit a specific question |
| `/admin/students` | Admin | View all students |
| `/admin/students/[studentID]` | Admin | View student details and answers |
| `/admin/administrators` | Admin | Manage admin accounts |
| `/admin/studentgroups` | Admin | Manage student groups |
| `/admin/system` | Admin | System settings |
| `/student` | Student | Take the phishing test |
| `/student/finish` | Student | View test results |
| `/leaderboard` | Public | Student rankings |
| `/slides` | Public | Presentation mode (cycles leaderboard + slides) |

### Authentication Flow

1. User submits credentials at `/login` -- backend sets a `session` cookie
2. Every page calls `GET /api/checkauth` to verify the session
3. The response includes an `admin` flag to determine the user's role
4. Unauthorized users are redirected to `/login`

### API Communication

- **Server components** use the `BACKEND_API_URL` environment variable to call the backend directly over the Docker network
- **Client components** (`"use client"`) call `/api/*` which Caddy proxies to the backend

### Key Dependencies

| Package | Purpose |
|---------|---------|
| `@mui/material`, `@mui/x-data-grid` | UI components and data tables |
| `@mui/joy` | Additional MUI components |
| `axios` | HTTP client |
| `sass` | SCSS styling |
| `react-dropzone` | File upload for question images |
| `react-hot-toast` | Notification toasts |
| `react-rnd` | Draggable/resizable elements (image link editor) |
| `react-tsparticles` | Animated particle background on login page |
| `crypto-js` | Client-side crypto utilities |
| `react-icons` | Icon library |

---

## Caddy (Reverse Proxy)

**Location:** `endpoint/Caddyfile`

Caddy is the single entry point for all traffic. It handles:

- **Routing** -- directs requests to the correct container based on URL path
- **Security headers** -- enforces a strict Content Security Policy
- **Forward authentication** -- protects admin-only tools (DBGate, Filebrowser) by checking `/api/checkauth/admin` before allowing access
- **Backend switch** -- the `api_backend` and `admin_auth` snippets at the top of the Caddyfile decide whether `/api/*` (and the forward-auth checks) go to Django or Flask; edit both and run `caddy reload` inside the `fisingas-endpoint` container

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
