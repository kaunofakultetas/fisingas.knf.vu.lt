# Fisingas - Phishing Recognition Test Platform

A web-based platform for testing and teaching phishing email recognition skills. Students view simulated email screenshots and determine whether they are real or phishing attempts, while administrators manage questions, monitor progress, and review results.

Built for **Vilnius University, Kaunas Faculty (VU KnF)**.

<br/>

## How It Works

1. **Admin** creates phishing test questions (email screenshots with answer options)
2. **Students** register, receive an access code, and take the test
3. The system randomly assigns a subset of questions to each student
4. Students identify each email as "Real" or "Phishing" and answer follow-up questions
5. Results are scored automatically and displayed on a leaderboard

<br/>

## Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/kaunofakultetas/fisingas.knf.vu.lt.git
cd fisingas.knf.vu.lt
```
### 2. Create the compose file from the sample
```bash
cp docker-compose.sample.yml docker-compose.yml
```
### 3. Deploy
```bash
./runUpdateThisStack.sh
```

The application will be available at `http://<server-ip>`.

**Default admin login:** `admin@admin.com` / `admin` (change this immediately).

<br/>

## Documentation

The full technical whitepaper covers the architecture, data model, authentication scheme, test lifecycle, grading arithmetic, web interface, deployment and known limitations:

| Document | Description |
|----------|-------------|
| [Whitepaper (English)](_DOCS/FisingasEN.pdf) | Technical whitepaper, English ([LaTeX source](_DOCS/whitepaperEN.tex)) |
| [Whitepaper (Lithuanian)](_DOCS/FisingasLT.pdf) | Techninė apžvalga, lietuvių kalba ([LaTeX šaltinis](_DOCS/whitepaperLT.tex)) |

Interactive API documentation (Swagger UI) is available on a running instance at `/swagger` (admin login required).
