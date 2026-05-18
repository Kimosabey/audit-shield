# AuditShield — implementation plan

**Repo:** [Kimosabey/audit-shield](https://github.com/Kimosabey/audit-shield) · **API:** port `8101`

## Product goal

Corrective / audited RAG: retrieved chunks are **graded by a fast auditor model** before synthesis; **citations** and an **audit trail** are first-class (industrial safety narrative, not mathematical proof).

## Suite UI standards (all SelfAware web apps)

| Area | Choice |
|------|--------|
| SPA | **Vite + React + TypeScript** |
| Styling | **Tailwind CSS** — **light theme only** (off-white / slate text; no dark-mode default) |
| Motion / polish | **Framer Motion** + **Aceternity-style** patterns (spotlight, moving border, grid/beam backgrounds) |
| Icons | **Lucide React** |
| Data | **TanStack Query**; **SSE** when streaming answers |
| Forms | **React Hook Form** + **Zod** |
| Routing | **React Router** (small surface) |
| Components | **shadcn/ui**-compatible primitives + custom Aceternity-style wrappers |

Dev proxy: Vite `server.proxy` → `http://localhost:8101`. Prod: `VITE_API_BASE` (same origin or explicit URL).

## Milestones

| Phase | Backend | Web UI |
|-------|---------|--------|
| **M1** | `POST /v1/query` stub (mock auditor scores + answer + `request_id`) | Scaffold `web/` (Tailwind, motion, Lucide); **Query** + **chunk cards** (admit/reject) + link to `/docs` |
| **M2** | Wire **Ollama** (auditor + synthesizer); optional **SSE** token stream | Streaming answer UI; toasts / errors from API |
| **M3** | **Postgres** + pgvector: chunks, `retrieval_event`, `chunk_audit` | **Audit trail** table (filters, export stub) |
| **M4** | Hardening: rate limits, auth (post-POC) | Empty states, skeletons, a11y pass |

## Current status

- FastAPI scaffold + `/health` live.
- **`web/`** — Vite template present; **dependencies + Aceternity-style layout + `/v1/query` UI** still to land (see M1).
- Docker: API-only compose; add **static SPA** or **sidecar** when M1 UI ships.

## Docs

- UX copy: avoid “guarantee”; show **citations** and **request_id** prominently.
- Cross-link: parent suite overview in workspace `SUITE_PROJECTS.md` (local workspace, not this repo).
