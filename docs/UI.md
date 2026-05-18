# SelfAware® UI / UX (light console)

Shared rules for SelfAware product SPAs (`web/` in each repo). **Light theme only** in v1 — no default dark mode or `prefers-color-scheme` switching unless you add an explicit toggle later.

## Typography

- **Sans:** Inter (or equivalent) with **tabular numerals** (`font-feature-settings: 'tnum', 'lnum'`) for telemetry, request IDs, part numbers, scores.

## Density

- **Operations console:** comfortable tap targets, readable table row height, clear separation between primary actions and metadata.

## Feedback

- **Loading:** prefer skeletons or inline spinners on primary actions.
- **Toasts:** Sonner (or equivalent) for success/failure summaries.
- **API errors:** surface FastAPI `detail` inline where the user submitted the form.

## Safety & trust (AuditShield, Autonomous Cortex)

- Avoid language that implies **legal or compliance guarantees**.
- Show **citations**, **chunk IDs**, and **request / audit IDs** prominently where outputs inform decisions.

## Configuration

- **API base:** `import.meta.env.VITE_API_BASE` for production split-origin deployments; empty means same-origin or dev proxy.

## OpenAPI

- Each service keeps `/docs`; link from the app header where helpful.
