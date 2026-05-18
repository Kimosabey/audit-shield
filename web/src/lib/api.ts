const base =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ??
  ''

function formatFastApiDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) {
          const msg = String((item as { msg: unknown }).msg)
          const loc = (item as { loc?: unknown }).loc
          if (Array.isArray(loc) && loc.length)
            return `${loc.map(String).join('.')}: ${msg}`
          return msg
        }
        return JSON.stringify(item)
      })
      .join('; ')
  }
  return JSON.stringify(detail)
}

export type HealthResponse = {
  status: string
  service: string
  database_configured: boolean
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${base}/health`)
  if (!res.ok) {
    throw new Error(res.statusText || `HTTP ${res.status}`)
  }
  return res.json() as Promise<HealthResponse>
}

export type IngestDocumentBody = {
  text: string
  title?: string
  source_uri?: string
}

export type IngestDocumentResponse = {
  document_id: string
  chunks_indexed: number
  title: string
}

export async function postIngestDocument(
  body: IngestDocumentBody,
): Promise<IngestDocumentResponse> {
  const res = await fetch(`${base}/v1/ingest/document`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: body.text.trim(),
      title: (body.title ?? '').trim(),
      source_uri: (body.source_uri ?? '').trim(),
    }),
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const err = (await res.json()) as { detail?: unknown }
      detail = formatFastApiDetail(err.detail ?? res.statusText)
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  return res.json() as Promise<IngestDocumentResponse>
}

export async function postIngestUpload(
  file: File,
  opts?: { title?: string; source_uri?: string },
): Promise<IngestDocumentResponse> {
  const fd = new FormData()
  fd.append('file', file, file.name)
  const t = opts?.title?.trim()
  const s = opts?.source_uri?.trim()
  if (t) fd.append('title', t)
  if (s) fd.append('source_uri', s)
  const res = await fetch(`${base}/v1/ingest/upload`, {
    method: 'POST',
    body: fd,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const err = (await res.json()) as { detail?: unknown }
      detail = formatFastApiDetail(err.detail ?? res.statusText)
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  return res.json() as Promise<IngestDocumentResponse>
}

export type QueryRequest = {
  query: string
  model?: string | null
  temperature?: number | null
}

export type Citation = {
  source: string
  chunk_id: string
}

export type RetrievalChunk = {
  id: string
  text: string
  score: number
  admitted: boolean
  source: string
}

export type RetrievalStep = {
  name: string
  detail: string
}

export type ModelRef = {
  role: string
  name: string
}

export type QueryResponse = {
  request_id: string
  answer: string
  citations: Citation[]
  steps: RetrievalStep[]
  chunks: RetrievalChunk[]
  models: ModelRef[]
  disclaimer: string
}

export async function postQuery(body: QueryRequest): Promise<QueryResponse> {
  const res = await fetch(`${base}/v1/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const err = (await res.json()) as { detail?: unknown }
      detail = formatFastApiDetail(err.detail ?? res.statusText)
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  return res.json() as Promise<QueryResponse>
}
