# AuditShield web UI

Light-themed Vite + React + TypeScript + Tailwind stack for the AuditShield FastAPI service.

## Run (development)

1. Start the API on port **8101** (`uvicorn` from repo root — see `.\run-dev.ps1`).
2. **Or (Windows)** from repo root run `.\run-all-dev.ps1` to open the API in a second window and start Vite here.
3. From this folder:

```bash
npm install
npm run dev
```

If the browser shows proxy **`ECONNREFUSED 127.0.0.1:8101`**, the API is not running — use step 1 or 2 first.

Sample text for ingest is served at **`/samples/policy-warranty-sample.txt`**; the UI has **Load sample policy**, or pick **`samples/policy-warranty-sample.txt`** from the repo in the file dialog.

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
