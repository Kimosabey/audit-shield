# AuditShield — API reference

Base URL — `http://127.0.0.1:8101` (or `http://<LAN_IP>:8101`). All POSTs accept
`application/json` unless noted. OpenAPI: `/docs`. Raw schema: `/openapi.json`.

## Endpoint summary

| Method | Path | Purpose |
|--------|------|---------|
| `GET`  | `/health` | service liveness + DB configured flag |
| `POST` | `/v1/ingest/document` | JSON: ingest plain text |
| `POST` | `/v1/ingest/upload`   | multipart: ingest PDF / .txt |
| `POST` | `/v1/query`           | run the corrective-RAG pipeline |
| `POST` | `/v1/query/stream`    | same, streamed as SSE |
| `GET`  | `/v1/audit-trail`     | **NEW** — export ledger entries |

## GET /health

```json
{"status":"ok","service":"audit-shield","port":8101,"database_configured":true}
```

## POST /v1/ingest/document

Request body:

```json
{ "text": "Lockout/tagout requires …", "title": "sop-loto", "source_uri": "inline" }
```

Response: `{ "document_id": "...", "chunks_indexed": 7, "title": "sop-loto" }`.

## POST /v1/ingest/upload

`multipart/form-data` with `file`, optional `title`, `source_uri`. PDF text is
extracted server-side. Returns the same shape as `/ingest/document`.

## POST /v1/query

Request:

```json
{ "query": "Summarize warranty for WDG-4401.", "model": null, "temperature": 0.2 }
```

Response shape:

```json
{
  "request_id": "uuid",
  "answer": "…",
  "citations": [{"chunk_id":"…","source":"…"}],
  "steps": [{"name":"embed","detail":"…"},{"name":"retrieve","detail":"…"}],
  "chunks": [{"id":"…","admitted":true,"score":0.81,"text":"…","source":"…"}],
  "models": [{"role":"auditor","name":"…"},{"role":"synthesizer","name":"…"}],
  "disclaimer": "Output is assistive only …"
}
```

Failure modes:

- `503 DATABASE_URL is not configured`
- `502 Embedding failed for all chunks` (with hint about the embed model)

## POST /v1/query/stream — Server-Sent Events

Same body as `/v1/query`. Each event is `data: { … }\n\n` JSON. Event sequence:

```
data: {"event":"start","request_id":"…"}
data: {"event":"step","name":"embed","detail":"…"}
data: {"event":"step","name":"retrieve","detail":"…"}
data: {"event":"step","name":"auditor","detail":"…"}
data: {"event":"step","name":"synthesize","detail":"…"}
data: {"event":"done","result":{ /* full QueryResponse */ }}
```

## GET /v1/audit-trail  (new)

Export recent query runs and the per-chunk admission decisions.

Query string: `?limit=50` (1..500, default 50).

```json
{
  "count": 12,
  "limit": 50,
  "runs": [
    {
      "request_id": "…",
      "query_text": "…",
      "synthesize_model": "llama3.2",
      "auditor_model": "phi:latest",
      "embed_model": "nomic-embed-text",
      "created_at": "2026-05-18T09:22:01+00:00",
      "admitted": 5,
      "rejected": 3,
      "chunks": [
        {"chunk_id":"…","retrieval_score":0.78,"auditor_score":0.71,"admitted":true,"rank":1}
      ]
    }
  ]
}
```

Use this to feed governance / quarterly audit dashboards.

## Errors (uniform)

```json
{"detail":"Database not configured"}
```

HTTP code reflects the situation: 422 (validation), 503 (config missing), 502
(embedding failure), 400 (bad upload).
