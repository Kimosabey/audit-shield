const base =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ??
  ''

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
      if (typeof err.detail === 'string') detail = err.detail
      else if (Array.isArray(err.detail))
        detail = err.detail.map((d) => JSON.stringify(d)).join('; ')
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  return res.json() as Promise<QueryResponse>
}
