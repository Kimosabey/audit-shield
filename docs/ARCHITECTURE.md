# AuditShield — architecture

Single-service FastAPI app with a Vite SPA built into `static/`. State lives in
Postgres + pgvector. LLM calls are local to Ollama. Nothing leaves the edge.

## Component diagram

```mermaid
flowchart LR
  Browser["Browser (React 19 / Tailwind 4)"]
  subgraph Edge ["Edge box — :8101"]
    API["FastAPI<br/>app.main"]
    Pipe["pipeline.py<br/>embed → retrieve → auditor → synth"]
    PG[("Postgres + pgvector<br/>document / chunk<br/>query_run / chunk_audit")]
    Static["static/ (built SPA)"]
  end
  Ollama["Ollama<br/>embed + auditor + synth"]

  Browser -- "/v1/* + /docs + /health" --> API
  API --> Pipe
  Pipe --> PG
  Pipe -- HTTP --> Ollama
  API --> Static
```

## Request flow — `POST /v1/query`

```mermaid
sequenceDiagram
  participant U as UI / curl
  participant API as FastAPI /v1/query
  participant E as Ollama (embed)
  participant DB as Postgres+pgvector
  participant A as Ollama (auditor)
  participant S as Ollama (synth)

  U->>API: { query, model?, temperature? }
  API->>E: POST /api/embeddings
  E-->>API: vector(768)
  API->>DB: SELECT … ORDER BY embedding <=> $1 LIMIT k
  DB-->>API: top-k chunks
  loop per chunk
    API->>A: POST /api/generate (JSON score gate)
    A-->>API: { score, admitted, reason }
  end
  API->>S: POST /api/generate (synthesize)
  S-->>API: answer text
  API->>DB: INSERT query_run + chunk_audit rows
  API-->>U: { answer, citations, chunks, steps, request_id, ... }
```

## Streaming (`/v1/query/stream`)

Same pipeline, but emits `start → step(embed) → step(retrieve) → step(auditor) → step(synth) → done(result)` as SSE so the UI can render progress incrementally.

## Audit ledger model

```mermaid
erDiagram
  document ||--o{ chunk : "1..n"
  query_run ||--o{ chunk_audit : "1..n"
  chunk_audit }o--|| chunk : "references"

  document {
    uuid id
    string title
    string source_uri
    datetime created_at
  }
  chunk {
    uuid id
    uuid document_id
    text text
    string source_label
    vector(768) embedding
    jsonb meta
  }
  query_run {
    uuid id
    string request_id
    text query_text
    string synthesize_model
    string auditor_model
    string embed_model
    datetime created_at
  }
  chunk_audit {
    uuid id
    uuid run_id
    uuid chunk_id
    float retrieval_score
    float auditor_score
    bool admitted
    text auditor_raw
    int rank
  }
```

`GET /v1/audit-trail` joins `query_run` + `chunk_audit` to produce an exportable
governance view.

## Frontend

- React 19 + TanStack Query + react-hook-form + Zod
- Tailwind 4 with the **Compliance Ledger** theme (parchment, navy, oxblood seal,
  gold-leaf rule). Fonts: Fraunces (display), Inter (UI), JetBrains Mono (IDs).
- Framer Motion respects `prefers-reduced-motion`; skip-link + visible focus
  rings satisfy WCAG 2.4.1 / 2.4.7.

## Deployment

Single image (`Dockerfile`) builds the SPA, copies `web/dist` to `static/`, runs
`uvicorn app.main:app --host 0.0.0.0 --port 8101`. `docker-compose.yml` ships
the Postgres+pgvector dependency.

## Failure modes (deliberate)

| Condition | Behaviour |
|---|---|
| `DATABASE_URL` unset | `/v1/query` and ingest endpoints return **503** (no stub) |
| Ollama unreachable | `502` with hint about embed model |
| Empty corpus | `200` with "no admitted chunks" answer + empty arrays |
