# AuditShield — testing checklist

Manual cases for the **FastAPI** service (`app/main.py`) and the **Vite** UI (`web/`). Mark items as you run them.

**Prerequisites**

- API reachable at `http://127.0.0.1:8101` (from repo root: `python -m uvicorn app.main:app --reload --port 8101`, or `.\run-dev.ps1`, or from `app/`: `.\run-uvicorn.ps1`).
- Optional: set `OLLAMA_BASE_URL` (e.g. `http://127.0.0.1:11434`) to exercise live synthesis instead of stub-only answers.
- Web: `cd web && npm run dev` — UI usually `http://localhost:5173` with `/v1` proxied to `8101`.

Replace `$BASE` below if you use another host or port.

```text
BASE=http://127.0.0.1:8101
```

---

## 1. API — health

| ID | Case | Steps | Expected |
|----|------|--------|----------|
| API-H1 | Health | `GET $BASE/health` | `200`, JSON with `"status":"ok"`, `"service":"audit-shield"`, numeric `port` |

Example:

```bash
curl -sS "$BASE/health"
```

---

## 2. API — `POST /v1/query`

| ID | Case | Body | Expected |
|----|------|------|----------|
| API-Q1 | Happy path (stub) | `{"query":"What is the retention period for commissioning records?"}` | `200`; `request_id` (UUID); non-empty `answer`; `steps` length ≥ 1; `chunks` with mix of `admitted` true/false; `citations`; `models` includes `auditor` and `synthesis`; `disclaimer` present |
| API-Q2 | Default model | Same as Q1, omit `model` | `200`; `models` includes synthesis name matching `AUDIT_DEFAULT_MODEL` or server default (e.g. `llama3.2`) |
| API-Q3 | Explicit model | `{"query":"Short test","model":"llama3.2"}` | `200`; synthesis model in `models` reflects request |
| API-Q4 | Null model | `{"query":"Short test","model":null}` | Same effective default as Q2 |
| API-Q5 | Temperature | `{"query":"Short test","temperature":0.7}` | `200` |
| API-Q6 | Empty query | `{"query":""}` | `422` validation error |
| API-Q7 | Missing `query` key | `{}` | `422` |
| API-Q8 | Query too long | `query` string length &gt; 50_000 | `422` |
| API-Q9 | Temperature low bound | `temperature: -0.1` | `422` |
| API-Q10 | Temperature high bound | `temperature: 2.1` | `422` |

Example (happy path):

```bash
curl -sS -X POST "$BASE/v1/query" \
  -H "Content-Type: application/json" \
  -d '{"query":"Summarize warranty for part WDG-4401.","temperature":0.2}'
```

**Optional — Ollama:** With `OLLAMA_BASE_URL` set and a running Ollama model, re-run API-Q1; `answer` should often differ from the stub template and reflect LLM text (still structured response).

---

## 3. API — `POST /v1/query/stream` (SSE)

| ID | Case | Steps | Expected |
|----|------|--------|----------|
| API-S1 | Stream shape | `POST` same body as Q1 with `Accept: text/event-stream` or plain POST; read body as stream | `Content-Type` includes `text/event-stream`; lines like `data: {...}`; first payload `event` ~ `start` with `request_id`; one or more `event: step`; final `event: done` with full `result` object matching non-stream schema fields |
| API-S2 | Empty query | `{}` or empty `query` | `422` (before stream) |

Example (read first events; interrupt with Ctrl+C when enough):

```bash
curl -sSN -X POST "$BASE/v1/query/stream" \
  -H "Content-Type: application/json" \
  -d '{"query":"Stream smoke test"}'
```

---

## 4. API — docs & CORS (smoke)

| ID | Case | Expected |
|----|------|----------|
| API-D1 | `GET $BASE/docs` | Swagger UI loads (or redirect) |
| API-D2 | `GET $BASE/openapi.json` | `200`; OpenAPI JSON with `/v1/query` |
| API-C1 | Preflight from UI origin | Browser from `http://localhost:5173` calling `POST /v1/query` | No CORS block when `CORS_ORIGINS` includes that origin (default includes 5173) |

---

## 5. Web UI (`web/` — Query page)

| ID | Case | Steps | Expected |
|----|------|--------|----------|
| UI-1 | Load | Open dev server root, navigate to query page | Form: Question, Model dropdown, Temperature, Submit |
| UI-2 | Example chip | Click an example | Query text (and temperature) populate |
| UI-3 | Model default | Model = “Default (server)” | Submit succeeds; backend uses default model |
| UI-4 | Model preset | Choose e.g. `llama3.2`, submit | Request succeeds (502 if API down) |
| UI-5 | Custom model | Choose “Custom…”, leave custom field empty, submit | Validation error on custom field |
| UI-6 | Custom model | “Custom…”, enter `mistral:7b`, submit | Request sent with that model string |
| UI-7 | Empty question | Clear question, submit | Inline error “Enter an audit question…” |
| UI-8 | Success path | Valid question, API up | Toast success; result cards: answer, citations, steps, chunks; session trail gains a row |
| UI-9 | API down | Stop API, submit | Error toast / failed mutation; not a silent success |
| UI-10 | OpenAPI link | Header link to `/docs` | Opens proxied docs in new tab when dev proxy + API up |

---

## 6. Docker (optional)

| ID | Case | Expected |
|----|------|----------|
| DK-1 | `docker compose up --build` | Single service on configured port; `/health` OK; `/` serves SPA if built into image |

---

## 7. Regression notes

- **Import / cwd:** Starting uvicorn only from `app/` without `PYTHONPATH` or helpers still causes `ModuleNotFoundError: No module named 'app'`. Use repo root, `run-dev.ps1`, or `app/run-uvicorn.ps1` ([README](../README.md#run-locally)).
- **502 from UI:** Usually Vite proxy cannot reach `127.0.0.1:8101` — start the API first.

---

## Future automation

There is no `pytest` suite in-tree yet. Good next steps: `httpx.AsyncClient` tests against `app.main.app` with `TestClient`, plus Playwright or Cypress for UI-Q*.
