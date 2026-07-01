# Fisingas Frontend (Vite + React)

The frontend of the phishing recognition test platform. A single-page React 19
application built with Vite, MUI and Tailwind CSS v4, served as static files by
Caddy in production. It replaced the old Next.js frontend (the `nextjs/`
folder), which is no longer deployed.

<br/>

## Folder Layout

```
vite/
├── Dockerfile           # Prod image: npm run build → static files served by Caddy
├── Dockerfile.dev       # Dev image: runs the Vite dev server (hot reload)
├── Caddyfile            # Caddy config for the prod image (SPA fallback to index.html)
└── app/
    ├── index.html       # HTML entry point
    ├── vite.config.js   # Plugins, '@' → src alias, dev server on 0.0.0.0:80
    ├── public/          # Static assets (favicon, fonts, images)
    └── src/
        ├── main.jsx     # React entry point
        ├── App.jsx      # Router + route guards (see below)
        ├── globals.css  # Tailwind, the Inter font, global styles
        ├── theme.js     # MUI theme (VU KnF burgundy)
        ├── providers.jsx        # MUI ThemeProvider wrapper
        ├── auth/AuthProvider.jsx # Session state from GET /api/checkauth
        ├── hooks/useFetchData.js # Standard GET hook (loading/polling/401 → /login)
        ├── components/          # Shared components
        │   ├── Navbar/          #   Top bar for signed-in users
        │   ├── Admin/           #   Admin sidebar + dashboard widgets
        │   ├── Student/         #   Student test sidebar
        │   ├── DatagridCustomComponents/  # MUI DataGrid toolbar buttons
        │   └── Other/           #   Generic reusable components
        └── systemPages/
            ├── PublicPages/     # Login, Leaderboard, Slides
            ├── StudentPages/    # TestHome (the test), TestFinish (results)
            └── AdminPages/      # Dashboard, students, questions, admins, ...
```

<br/>

## Routes

All routing is client-side (`react-router-dom`), declared in `src/App.jsx`.
On load, `AuthProvider` calls `GET /api/checkauth` once; the route guards
then redirect based on the session:

| Route | Access | Page |
|-------|--------|------|
| `/` | everyone | Redirects by role (admin → `/admin`, student → `/student`, anonymous → `/login`) |
| `/login` | everyone | Login + student registration (also clears the session cookie — this is the logout) |
| `/leaderboard` | everyone | Public leaderboard (projector view) |
| `/slides` | everyone | Fullscreen slide show alternating with the leaderboard |
| `/student` | student | The phishing test (redirects to results once finished) |
| `/student/finish` | student | Marks the test finished + shows the results |
| `/admin` | admin | Dashboard (live student progress) |
| `/admin/students` | admin | Students grid |
| `/admin/students/:id` | admin | One student's results |
| `/admin/questions` | admin | Question bank with inline editors |
| `/admin/questions/:id` | admin | Standalone link-area editor for one question |
| `/admin/administrators` | admin | Administrators grid + add/edit dialog |
| `/admin/studentgroups` | admin | Student groups grid (read-only) |
| `/admin/system` | admin | ⚠ Unfinished stub (no backend endpoint) |

All `/api/*` calls go through the Caddy endpoint to the Flask backend —
the frontend never talks to the backend directly.

<br/>

## Development

Switch the `fisingas-vite` service in `docker-compose.yml` to the lines
marked `# Dev` (Dockerfile.dev, the `./vite/app:/app` volume and the
`external` network), then:

```bash
docker compose up -d --build fisingas-vite
```

This runs `npm install && npm run dev` inside the container — the Vite dev
server listens on port 80 with hot reload, and the Caddy endpoint proxies
to it the same way as in production.

<br/>

## Production

The default `docker-compose.yml` configuration (lines marked `# Prod`):

```bash
docker compose up -d --build fisingas-vite
```

`Dockerfile` builds the app (`npm run build`) in a node stage, then copies
`dist/` into a Caddy image which serves the static files with an SPA
fallback to `index.html` (see `vite/Caddyfile`).
