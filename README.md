# AuditShield

Corrective / audited RAG — retrieved chunks are gated by an auditor step before synthesis; outputs include citations and request IDs (assistive only, not a compliance guarantee).

**GitHub:** [Kimosabey/audit-shield](https://github.com/Kimosabey/audit-shield)

```bash
git clone git@github.com:Kimosabey/audit-shield.git
```

Uses your existing `~/.ssh/config` for GitHub.

| | |
|--|--|
| **API port** | `8101` (override with `PORT`) |
| **OpenAPI** | `/docs`, `/openapi.json` |
| **Roadmap** | [docs/PLAN.md](docs/PLAN.md) |
| **UI rules** | [docs/UI.md](docs/UI.md) |

## API (FastAPI)

- `GET /health` — liveness
- `POST /v1/query` — JSON body: `query`, optional `model`, `temperature`; stub pipeline + optional Ollama synthesis when `OLLAMA_BASE_URL` is set
- `POST /v1/query/stream` — SSE (`text/event-stream`): step events and final `done` payload

### Environment

| Variable | Purpose |
|----------|---------|
| `PORT` | Listen port (default `8101`) |
| `OLLAMA_BASE_URL` | e.g. `http://host:11434` — optional live LLM |
| `AUDIT_DEFAULT_MODEL` | Model id when request omits `model` |
| `CORS_ORIGINS` | Comma-separated origins (default includes `http://localhost:5173`) |

See [.env.example](.env.example) for hints.

### Local (API only)

```bash
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8101
```

## Web UI (`web/`)

Vite + React + TypeScript + Tailwind + TanStack Query; dev server proxies `/v1`, `/health`, `/docs` to the API.

```bash
cd web
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`). Details: [web/README.md](web/README.md).

`VITE_API_BASE` — optional full API origin when UI and API are not same host.

### Production build

```bash
cd web && npm run build
```

Output is `web/dist/`. The Docker image copies it to `static/` and FastAPI serves the SPA (same port as API).

## Docker

```bash
docker compose up --build
```

- API + built SPA: [http://localhost:8101](http://localhost:8101) (UI), [http://localhost:8101/health](http://localhost:8101/health), [http://localhost:8101/docs](http://localhost:8101/docs)
