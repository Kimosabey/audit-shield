# Changelog — AuditShield

Format follows [Keep a Changelog](https://keepachangelog.com/). Dates in ISO-8601.

## [Unreleased]

### Added
- `GET /v1/audit-trail?limit=` — export recent query runs with admitted/rejected
  chunk decisions and per-chunk auditor + retrieval scores.
- Compliance Ledger UI theme — parchment background, navy ink, oxblood wax-seal
  motif, gold-leaf accent, Fraunces serif headlines, JetBrains Mono IDs.
- Skip-to-main link, `prefers-reduced-motion` honoured, focus rings tuned for
  WCAG 2.4.1 / 2.4.7.
- LAN-IP CORS via `CORS_ORIGIN_REGEX` so the UI works from `localhost` **and**
  the machine's IPv4 / Tailscale address.
- Suite `scripts/print-share-urls.ps1` is invoked from `run-dev.{ps1,bat}` to
  print localhost + LAN URLs at startup.
- Docs: `API.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `SCREENSHOTS.md`, banner SVG.

### Changed
- README updated with new endpoints, themed banner, and screenshot guide.

## [0.2.0] — prior to 2026-05-18

- Postgres + pgvector retrieval (no stub fallback).
- Ollama auditor JSON gating; persistent `query_run` / `chunk_audit` rows.
- PDF + plain-text ingestion endpoints.
- SSE `/v1/query/stream`.
- Initial Vite + React UI.

## [0.1.0]

- Scaffold: FastAPI + Docker + `/health`.
