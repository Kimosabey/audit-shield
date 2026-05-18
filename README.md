<p align="center">
  <img src="docs/img/banner.svg" alt="AuditShield — Compliance Ledger" width="100%" />
</p>

# AuditShield · Compliance Ledger

> **Corrective / audited RAG** — retrieved chunks pass an **Ollama auditor** gate (JSON scores) with **pgvector** retrieval and **persisted** `query_run / chunk_audit` rows. The API returns **steps**, **citations**, **request IDs**, and a **disclaimer** (output is **assistive only**, not a compliance guarantee).

| Spec | Value |
|---|---|
| **Theme** | Compliance Ledger — parchment, navy ink, oxblood wax seal, gold-leaf rule |
| **Port** | `:8101` |
| **Stack** | FastAPI · Postgres + pgvector · Ollama · Vite 6 · React 19 · Tailwind 4 |
| **Status** | Backend M3 complete; UI polished; LAN-IP CORS enabled |

### Quick links
[API.md](docs/API.md) · [ARCHITECTURE.md](docs/ARCHITECTURE.md) · [PLAN.md](docs/PLAN.md) · [TESTING.md](docs/TESTING.md) · [UI.md](docs/UI.md) · [CHANGELOG.md](docs/CHANGELOG.md) · [SCREENSHOTS.md](docs/SCREENSHOTS.md) · [Suite — Ports & URLs](../docs/PORTS_AND_URLS.md)

### Open these to test

| What | Localhost | LAN |
|---|---|---|
| Swagger | http://127.0.0.1:8101/docs | http://&lt;LAN_IP&gt;:8101/docs |
| Health | http://127.0.0.1:8101/health | http://&lt;LAN_IP&gt;:8101/health |
| Audit ledger export | http://127.0.0.1:8101/v1/audit-trail?limit=50 | http://&lt;LAN_IP&gt;:8101/v1/audit-trail?limit=50 |
| UI | http://localhost:5173 | http://&lt;LAN_IP&gt;:5173 |



| | |
|--|--|
| **GitHub** | [Kimosabey/audit-shield](https://github.com/Kimosabey/audit-shield) |
| **Clone** | `git clone git@github.com:Kimosabey/audit-shield.git` (uses your `~/.ssh/config`) |
| **Default API port** | `8101` |
| **Stack** | FastAPI · Python 3.12 · **web:** Vite 6 · React 19 · TypeScript · Tailwind 4 · TanStack Query · React Hook Form · Zod · React Router · Framer Motion · Sonner · Radix Slot · Lucide |
| **Roadmap** | [docs/PLAN.md](docs/PLAN.md) |
| **UI / UX rules** | [docs/UI.md](docs/UI.md) |
| **Testing (manual)** | [docs/TESTING.md](docs/TESTING.md) |
| **DB & DBeaver (suite)** | [../docs/DATABASE_AND_DBEAVER.md](../docs/DATABASE_AND_DBEAVER.md) |

---

## Database (Docker / DBeaver)

**Postgres + pgvector** (compose in this repo maps host **`127.0.0.1:5433`** → container 5432). Default credentials: database `auditshield`, user `audit`, password `audit`.

- **JDBC:** `jdbc:postgresql://127.0.0.1:5433/auditshield`
- **Full table:** [DATABASE_AND_DBEAVER.md](../docs/DATABASE_AND_DBEAVER.md) (includes “start postgres only” command).

Start stack: `docker compose up -d` from this repo (API + Postgres) or `docker compose up -d postgres` for DB only.

---

## Repository layout

```
audit-shield/
├── app/
│   ├── main.py          # FastAPI app, routes, optional Ollama
│   ├── run-uvicorn.ps1  # Windows: run API from app/ (sets PYTHONPATH)
│   └── run-uvicorn.bat
├── run-dev.ps1          # Windows helper: uvicorn from repo root
├── run-all-dev.ps1      # Windows: API in new window + Vite (use if proxy shows ECONNREFUSED 8101)
├── run-dev.bat
├── samples/             # Sample .txt for ingest/upload tests — see samples/README.md
├── web/                 # SPA (Vite + React)
│   ├── src/
│   │   ├── pages/       # QueryPage — form, results, chunk cards, audit trail table
│   │   ├── components/  # UI primitives + Aceternity-style chrome
│   │   └── lib/         # api client, utils
│   ├── README.md        # Web-only: scripts, env
│   └── package.json
├── docs/
│   ├── PLAN.md
│   ├── TESTING.md     # API + UI manual test cases
│   └── UI.md
├── Dockerfile           # Multi-stage: build web → copy dist to static/
├── docker-compose.yml
├── requirements.txt
├── .env.example
└── README.md            # This file
```

---

## Features (current)

### API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | JSON: `status`, `service`, `port` |
| `GET` | `/` | JSON index when **no** `static/` (dev API-only); with `static/`, SPA is served at `/` |
| `POST` | `/v1/ingest/document` | JSON body: `{ "text", "title"?, "source_uri"? }` → chunk, embed, index |
| `POST` | `/v1/ingest/upload` | `multipart/form-data` file (PDF or text) → same pipeline |
| `POST` | `/v1/query` | Body: `{ "query": string, "model"?: string, "temperature"?: number }` → full **QueryResponse** from live index (or “no corpus” message if empty) |
| `POST` | `/v1/query/stream` | **SSE** — events include `start`, `step`, `token`, `done` with full result |
| `GET` | `/v1/audit-trail` | **NEW** — export recent runs + per-chunk admit/reject decisions for governance |

Requires **`DATABASE_URL`** (Postgres + pgvector) and **`OLLAMA_BASE_URL`** for embeddings (`OLLAMA_EMBED_MODEL`), auditor (`OLLAMA_MODEL_AUDITOR`), and synthesis.

### Web UI (`web/`)

- **Query** — textarea, optional model + temperature, submit via TanStack Query `mutation` → `POST /v1/query`.
- **Result** — answer, citations, retrieval/auditor **steps**, **chunk cards** (admit/reject, score, source).
- **Ingest** — paste text or upload PDF / `.txt`; optional **Load sample policy** (matches example queries: WDG-4401, LOTO, PRV-03, retention).
- **Session audit trail** — table of `request_id`, UTC time, models (browser session only).
- Header link to **OpenAPI** `/docs` (proxied in dev).

---

## Environment variables

Copy [.env.example](.env.example) to **`.env`** in this repo root. Variables are loaded automatically on API startup (`app/database.py` uses `python-dotenv`). Shell exports still win if set.

| Variable | Used by | Description |
|----------|---------|-------------|
| `PORT` | API | Listen port (default `8101`) |
| `DATABASE_URL` | API | **Required** — `postgresql+asyncpg://…` to Postgres with **pgvector** extension |
| `OLLAMA_BASE_URL` | API | **Required** — base URL, no trailing slash |
| `OLLAMA_EMBED_MODEL` | API | Embeddings model (default `nomic-embed-text`) |
| `OLLAMA_MODEL_AUDITOR` | API | Auditor chat model (default `phi:latest`) |
| `AUDIT_DEFAULT_MODEL` | API | Synthesis model when the client omits `model` |
| `AUDIT_TOP_K` | API | Vector retrieve count (default `8`) |
| `AUDIT_ADMIT_THRESHOLD` | API | Min auditor score to admit (default `0.62`) |
| `CORS_ORIGINS` | API | Comma-separated browser origins |

Legacy note: **without** `DATABASE_URL`, query/ingest return **503** (no stub pipeline).

**Web (`web/.env`, optional):**

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE` | Full API origin if UI is **not** same host as API (production split). Leave empty for dev proxy or same-origin Docker |

---

## Run locally

### 1. API

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

Start **Postgres with pgvector** (`docker compose up -d postgres` in this repo, or your own instance). Copy `.env.example` to `.env` and set **`DATABASE_URL`** and **`OLLAMA_BASE_URL`** before running the API.

**Important:** the shell’s **current directory** must be **`audit-shield`** (the folder that **contains** `app/`, not `app` itself). If you `cd app` and run `uvicorn app.main:app` without fixing the path, you get `ModuleNotFoundError: No module named 'app'`.

**If you prefer to stay in `app/`:** run `.\run-uvicorn.ps1` or `run-uvicorn.bat` (they set `PYTHONPATH` to the repo root).

**Easiest on Windows:** from repo root, double-click or run:

```powershell
.\run-dev.ps1
```

(or `run-dev.bat`)

That script `cd`s to the repo root and runs `python -m uvicorn …`. Override port with `$env:PORT=8101` before `.\run-dev.ps1` if needed.

**Manual (any OS)** — stay in repo root:

```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8101
```

If you are accidentally inside `app/`, run `cd ..` first, then the command above — or stay in `app/` and run `.\run-uvicorn.ps1` / `run-uvicorn.bat`.

- Swagger: [http://127.0.0.1:8101/docs](http://127.0.0.1:8101/docs)

**Other devices (LAN / Tailscale):** Uvicorn uses `--host 0.0.0.0`, so after `ipconfig` you can use `http://<your-IPv4>:8101/docs` from another machine (allow the port in Windows Firewall if needed). Full notes: [LOCAL_AND_NETWORK_ACCESS.md](../docs/LOCAL_AND_NETWORK_ACCESS.md).

### 2. Web UI (second terminal)

```bash
cd web
npm install
npm run dev
```

Vite proxies `/v1`, `/health`, `/docs`, `/openapi.json`, `/redoc` to `http://127.0.0.1:8101`. Open the printed URL (usually port **5173**).

From **another device**, use the **Network** URL from `npm run dev` or `http://<your-PC-IPv4>:5173` (see [LOCAL_AND_NETWORK_ACCESS.md](../docs/LOCAL_AND_NETWORK_ACCESS.md)).

### 3. Production-style front-end build (optional, without Docker)

```bash
cd web
npm run build
# output: web/dist — point your server or copy into static/ for FastAPI StaticFiles
```

---

## Docker

```bash
docker compose up --build
```

- Builds the SPA in an image stage, copies `web/dist` → **`static/`** inside the Python image.
- Single service exposes **8101**: React app at `/`, API under `/v1`, `/health`, `/docs`.

---

## Scripts (in `web/`)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server + API proxy |
| `npm run build` | `tsc -b` + production bundle |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |

---

## Ollama

Set `OLLAMA_BASE_URL` to your on‑prem Ollama (e.g. `http://127.0.0.1:11434` or your Tailscale host). Use any model name your server exposes; defaults assume a small instruct model id unless you override `AUDIT_DEFAULT_MODEL` or pass `model` in the request body.

---

## License

Proprietary — Graylinx / SelfAware® unless otherwise stated in your agreement.