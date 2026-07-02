# Deployment Guide

## Prerequisites

- Docker and Docker Compose
- A Linux server (tested on Ubuntu)
- Port 80 available

---

<br/>

## Quick Deploy

```bash
git clone https://github.com/kaunofakultetas/fisingas.knf.vu.lt.git
cd fisingas.knf.vu.lt
cp docker-compose.yml.sample docker-compose.yml
./runUpdateThisStack.sh
```

The script creates data directories, sets file ownership, and starts all containers. The application will be available at **http://localhost**.

### First Login

- **Email:** `admin@admin.com`
- **Password:** `admin`

**Change the default password immediately** via the Administrators page.

---

<br/>

## Services Overview

The system runs 8 Docker containers:

| Service | Role | Internal Port |
|---------|------|---------------|
| `fisingas-endpoint` | Caddy reverse proxy (entry point) | 80 |
| `fisingas-vite` | React (Vite) frontend | 80 |
| `fisingas-django` | Django API | 8000 |
| `fisingas-postgres` | PostgreSQL database | 5432 |
| `fisingas-dbgate` | Database management UI | 3000 |
| `fisingas-filebrowser-dropbox` | File manager for uploads | 80 |
| `fisingas-filebrowser-slides` | File manager for slides | 80 |
| `fisingas-swagger` | API documentation UI | 8080 |

Only the Caddy container exposes port 80 to the host. All other services communicate internally through a Docker network.

### Request Routing (Caddy)

| Path | Routed To | Auth Required |
|------|-----------|---------------|
| `/api/*` | Django API | Varies by endpoint |
| `/filebrowser/dropbox/*` | Filebrowser (dropbox) | Admin |
| `/filebrowser/slides/*` | Filebrowser (slides) | Admin |
| `/dbgate/*` | DBGate | Admin |
| `/swagger*` | Swagger UI | Admin |
| `/*` (everything else) | Vite frontend | Varies by page |

---

<br/>

## Configuration

Edit `docker-compose.yml` to change settings. The sample file includes both "pull from Docker Hub" (default) and "build locally" (commented out) variants.

### Environment Variables

#### Backend (`fisingas-django`)

| Variable | Default in Sample | Description |
|----------|-------------------|-------------|
| `DJANGO_SECRET_KEY` | *(placeholder — must be changed)* | Secret key used to sign sessions |
| `DATABASE_URL` | `postgres://fisingas:...@fisingas-postgres:5432/fisingas` | PostgreSQL connection string |
| `SLIDES_DIRECTORY` | `/slides` | Path to the slides directory inside the container |
| `DJANGO_DEBUG` | *(not set)* | Set to `True` for development only |

#### Database (`fisingas-postgres`)

| Variable | Default in Sample | Description |
|----------|-------------------|-------------|
| `POSTGRES_DB` / `POSTGRES_USER` | `fisingas` | Database name and user |
| `POSTGRES_PASSWORD` | *(placeholder — must be changed)* | Must match the password inside `DATABASE_URL` and the DBGate connection |

### Data Directories

All persistent data lives in `_DATA/` (excluded from git):

| Directory | Contents | Used By |
|-----------|----------|---------|
| `_DATA/postgres/` | PostgreSQL data directory | PostgreSQL |
| `_DATA/slides/` | Slide images for presentation mode | Django, Filebrowser (slides) |
| `_DATA/dropbox/` | Files uploaded through the file manager | Filebrowser (dropbox) |

---

<br/>

## Database Maintenance

Apply pending migrations after an update:

```bash
sudo docker exec fisingas-django python3 manage.py migrate
```

The database itself can be inspected through DBGate at `/dbgate` (admin login required).

---

