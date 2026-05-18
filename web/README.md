# AuditShield web UI

Light-themed Vite + React + TypeScript + Tailwind stack for the AuditShield FastAPI service.

## Run (development)

1. Start the API on port **8101** (`uvicorn app.main:app --reload --port 8101` from the repo root).
2. From this folder:

```bash
npm install
npm run dev
```

Vite proxies `/v1`, `/health`, `/docs`, and `/openapi.json` to `http://127.0.0.1:8101`.

## Environment

| Variable         | Purpose                                      |
| ---------------- | --------------------------------------------- |
| `VITE_API_BASE`  | Optional absolute API origin in production.   |

When `VITE_API_BASE` is empty, the SPA calls same-origin paths (works when the API serves the built files or when using the dev proxy).

## Build

```bash
npm run build
```

Output is `dist/`. The API Docker image copies this tree into `./static` and serves it behind FastAPI.

## Product notes

- Audit copy emphasizes citations and request IDs; outputs are assistive only.
- Tabular numbers are enabled for telemetry-style fields.
