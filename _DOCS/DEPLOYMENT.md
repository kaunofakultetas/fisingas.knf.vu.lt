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

The system runs 6 Docker containers:

| Service | Role | Internal Port |
|---------|------|---------------|
| `fisingas-endpoint` | Caddy reverse proxy (entry point) | 80 |
| `fisingas-nextjs` | Next.js frontend | 3000 |
| `fisingas-backend` | Flask API | 8080 |
| `fisingas-dbgate` | Database management UI | 3000 |
| `fisingas-filebrowser-dropbox` | File manager for uploads | 80 |
| `fisingas-filebrowser-slides` | File manager for slides | 80 |

Only the Caddy container exposes port 80 to the host. All other services communicate internally through a Docker network.

### Request Routing (Caddy)

| Path | Routed To | Auth Required |
|------|-----------|---------------|
| `/api/*` | Backend API | Varies by endpoint |
| `/filebrowser/dropbox/*` | Filebrowser (dropbox) | Admin |
| `/filebrowser/slides/*` | Filebrowser (slides) | Admin |
| `/dbgate/*` | DBGate | Admin |
| `/*` (everything else) | Next.js frontend | Varies by page |

---

<br/>

## Configuration

Edit `docker-compose.yml` to change settings. The sample file includes both "pull from Docker Hub" (default) and "build locally" (commented out) variants.

### Environment Variables

#### Backend (`fisingas-backend`)

| Variable | Default in Sample | Description |
|----------|-------------------|-------------|
| `DB_PATH` | `/DATABASE/fisingas.db` | Path to the SQLite database inside the container |
| `SLIDES_DIRECTORY` | `/SLIDES` | Path to the slides directory inside the container |
| `TMPDIR` | `/tmp/backend` | Temp directory (required because the container runs read-only) |
| `APP_DEBUG` | *(not set)* | Set to `true` for development only |

#### Frontend (`fisingas-nextjs`)

| Variable | Default in Sample | Description |
|----------|-------------------|-------------|
| `BACKEND_API_URL` | `http://fisingas-backend:8080` | Internal URL for server-side API calls to the backend |

### Data Directories

All persistent data lives in `_DATA/` (excluded from git):

| Directory | Contents | Used By |
|-----------|----------|---------|
| `_DATA/database/` | SQLite database file (`fisingas.db`) | Backend, DBGate |
| `_DATA/slides/` | Slide images for presentation mode | Backend, Filebrowser (slides) |
| `_DATA/dropbox/` | Files uploaded through the file manager | Filebrowser (dropbox) |

> **Note:** The DBGate service mounts a separate `./DATABASE` directory at the repo root. Make sure it points to the same database file as the backend. Check the volume mappings in `docker-compose.yml`.

---

<br/>

## Database Maintenance

Remove orphaned records and reclaim disk space:

```bash
sudo docker exec fisingas-backend python3 main.py --optimize-db
```

This deletes answer records for students that no longer exist and runs SQLite `VACUUM`.

---

