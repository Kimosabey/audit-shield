# AuditShield

**Corrective / audited RAG** — retrieval is followed by an **auditor-style gate** (stub scoring today): chunks get scores and **admit / reject** flags before synthesis. The API returns **steps**, **citations**, **request IDs**, and a **disclaimer** (output is **assistive only**, not a compliance guarantee).

| | |
|--|--|
| **GitHub** | [Kimosabey/audit-shield](https://github.com/Kimosabey/audit-shield) |
| **Clone** | `git clone git@github.com:Kimosabey/audit-shield.git` (uses your `~/.ssh/config`) |
| **Default API port** | `8101` |
| **Stack** | FastAPI · Python 3.12 · **web:** Vite 6 · React 19 · TypeScript · Tailwind 4 · TanStack Query · React Hook Form · Zod · React Router · Framer Motion · Sonner · Radix Slot · Lucide |
| **Roadmap** | [docs/PLAN.md](docs/PLAN.md) |
| **UI / UX rules** | [docs/UI.md](docs/UI.md) |
| **Testing (manual)** | [docs/TESTING.md](docs/TESTING.md) |

---

## Repository layout

```
audit-shield/
├── app/
│   ├── main.py          # FastAPI app, routes, optional Ollama
│   ├── run-uvicorn.ps1  # Windows: run API from app/ (sets PYTHONPATH)
│   └── run-uvicorn.bat
├── run-dev.ps1          # Windows helper: uvicorn from repo root
├── run-dev.bat
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
| `POST` | `/v1/query` | Body: `{ "query": string, "model"?: string, "temperature"?: number }` → full **QueryResponse**: `request_id`, `answer`, `citations[]`, `steps[]`, `chunks[]` (score, `admitted`, `source`), `models[]`, `disclaimer` |
| `POST` | `/v1/query/stream` | **SSE** (`text/event-stream`): `data:` JSON lines — `event` values include `start`, `step`, `token` (optional), `done` with full result |

When `OLLAMA_BASE_URL` is set, synthesis (and stream path) can call Ollama **`/api/generate`** with the configured default or request `model`.

### Web UI (`web/`)

- **Query** — textarea, optional model + temperature, submit via TanStack Query `mutation` → `POST /v1/query`.
- **Result** — answer, citations, retrieval/auditor **steps**, **chunk cards** (admit/reject, score, source).
- **Session audit trail** — table of `request_id`, UTC time, models (browser session only).
- Header link to **OpenAPI** `/docs` (proxied in dev).

---

## Environment variables

Copy [.env.example](.env.example) to `.env` for local API development (values are hints; adjust for your network).

| Variable | Used by | Description |
|----------|---------|-------------|
| `PORT` | API | Listen port (default `8101`) |
| `OLLAMA_BASE_URL` | API | Base URL, no trailing slash — e.g. `http://127.0.0.1:11434`. Empty = stub-only answers |
| `AUDIT_DEFAULT_MODEL` | API | Model id when the client omits `model` (default `llama3.2`) |
| `CORS_ORIGINS` | API | Comma-separated browser origins — default includes `http://localhost:5173` and `127.0.0.1:5173` |

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

### 2. Web UI (second terminal)

```bash
cd web
npm install
npm run dev
```

Vite proxies `/v1`, `/health`, `/docs`, `/openapi.json`, `/redoc` to `http://127.0.0.1:8101`. Open the printed URL (usually port **5173**).

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