import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  BookOpen,
  ClipboardCheck,
  Database,
  ExternalLink,
  Loader2,
  Shield,
  UploadCloud,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { GridBackground, MovingBorder, SpotlightHero } from '@/components/aceternity'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  getHealth,
  postIngestUpload,
  postQuery,
  type QueryResponse,
} from '@/lib/api'
import { cn } from '@/lib/utils'

/** Sentinel for “type your own” — must match an option value, not a real Ollama tag. */
const MODEL_CUSTOM = '__custom__' as const

const MODEL_PRESETS: { value: string; label: string }[] = [
  { value: '', label: 'Default (server)' },
  { value: 'llama3.2', label: 'llama3.2' },
  { value: 'llama3.3', label: 'llama3.3' },
  { value: 'phi3', label: 'phi3' },
  { value: 'qwen2.5:14b', label: 'qwen2.5:14b' },
  { value: MODEL_CUSTOM, label: 'Custom…' },
]

const schema = z
  .object({
    query: z.string().min(1, 'Enter an audit question or clause to verify.'),
    modelChoice: z.string(),
    modelCustom: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.modelChoice === MODEL_CUSTOM && !data.modelCustom?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a custom model name.',
        path: ['modelCustom'],
      })
    }
  })

type FormValues = z.infer<typeof schema>

function modelFieldsFromApiModel(exModel?: string): Pick<FormValues, 'modelChoice' | 'modelCustom'> {
  const t = exModel?.trim()
  if (!t) return { modelChoice: '', modelCustom: '' }
  const match = MODEL_PRESETS.find(
    (p) => p.value !== '' && p.value !== MODEL_CUSTOM && p.value === t,
  )
  if (match) return { modelChoice: match.value, modelCustom: '' }
  return { modelChoice: MODEL_CUSTOM, modelCustom: t }
}

function resolvedModel(values: FormValues): string | null {
  if (values.modelChoice === MODEL_CUSTOM) return values.modelCustom!.trim()
  if (!values.modelChoice) return null
  return values.modelChoice
}

type AuditRow = {
  request_id: string
  time: string
  models: string
}

const AUDIT_EXAMPLES: {
  label: string
  query: string
  model?: string
  temperature?: number
}[] = [
  {
    label: 'Chiller LOTO',
    query:
      'What are the lockout/tagout steps before servicing CH-0001b00000 or CH-0002b00000? Cite the controlling SOP section and chunk IDs.',
    temperature: 0.2,
  },
  {
    label: 'Condenser pump overhaul',
    query:
      'List the preventive maintenance intervals and bearing replacement schedule for CONDPU-0001b40000, CONDPU-0002b40000, and CONDPU-0003b40000.',
  },
  {
    label: 'Cooling tower water treatment',
    query:
      'What are the Legionella control and chemical dosing requirements for CT-0001b70000 and CT-0002b70000 under our water management plan?',
  },
  {
    label: 'Energy meter calibration',
    query:
      'What is the required calibration interval for energy meters EM-0001000000 through EM-000c000000, and who must sign off on the records?',
  },
  {
    label: 'Chiller pressure safety',
    query:
      'List maximum allowable working pressures and high-pressure cutout setpoints for CH-0001b00000 and CH-0002b00000; cite admitted chunks only.',
  },
  {
    label: 'Make-up water permit',
    query:
      'What permit and record retention requirements apply to MWP-0001150000 and MWP-0002150000 under our facility compliance programme?',
  },
]

const uploadSchema = z.object({
  title: z.string().optional(),
})
type UploadFormValues = z.infer<typeof uploadSchema>

export function QueryPage() {
  const [result, setResult] = useState<QueryResponse | null>(null)
  const [history, setHistory] = useState<AuditRow[]>([])
  const [uploadFile, setUploadFile] = useState<File | null>(null)

  const healthQuery = useQuery({
    queryKey: ['audit-shield-health'],
    queryFn: getHealth,
    refetchInterval: 30_000,
    retry: 2,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { query: '', modelChoice: '', modelCustom: '', temperature: 0.2 },
  })

  const modelChoice = form.watch('modelChoice')

  const uploadForm = useForm<UploadFormValues>({
    defaultValues: { title: '' },
  })

  const uploadIngestMutation = useMutation({
    mutationFn: (args: { file: File; title?: string }) =>
      postIngestUpload(args.file, { title: args.title }),
    onSuccess: (data) => {
      toast.success('File indexed', {
        description: `${data.chunks_indexed} chunks — ${data.title}`,
      })
      setUploadFile(null)
      uploadForm.reset()
      const el = document.getElementById('ingest-file') as HTMLInputElement | null
      if (el) el.value = ''
    },
    onError: (e: Error) => toast.error('Ingest failed', { description: e.message }),
  })

  const mutation = useMutation({
    mutationFn: postQuery,
    onSuccess: (data) => {
      setResult(data)
      setHistory((h) => [
        {
          request_id: data.request_id,
          time: new Date().toISOString(),
          models: data.models.map((m) => `${m.role}:${m.name}`).join(', '),
        },
        ...h,
      ])
      toast.success('Audit run complete', { description: data.request_id })
    },
    onError: (e: Error) => toast.error('Query failed', { description: e.message }),
  })

  const expanded = useMemo(() => result, [result])

  function onSubmit(values: FormValues) {
    mutation.mutate({
      query: values.query,
      model: resolvedModel(values) || null,
      temperature:
        values.temperature === undefined || Number.isNaN(values.temperature)
          ? null
          : values.temperature,
    })
  }

  function onUploadIngest() {
    if (!uploadFile) {
      toast.error('Choose a file', { description: 'Select a PDF or .txt file to index.' })
      return
    }
    const { title } = uploadForm.getValues()
    uploadIngestMutation.mutate({ file: uploadFile, title: title?.trim() || undefined })
  }

  return (
    <div className="relative min-h-screen">
      <GridBackground />
      <header
        className="border-b border-[var(--color-rule)] bg-[#fffdf6]/85 backdrop-blur-md"
        role="banner"
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--color-ink)] text-[var(--color-paper)] shadow-sm seal-press">
              <Shield className="size-5" aria-hidden />
            </div>
            <div>
              <p className="mono text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-leaf)]">
                SelfAware® · Ledger I
              </p>
              <h1 className="ledger-display text-xl font-semibold text-[var(--color-ink)]">
                AuditShield
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {healthQuery.isPending ? (
              <Badge variant="outline" className="gap-1">
                <Loader2 className="size-3 animate-spin" aria-hidden />
                Checking API…
              </Badge>
            ) : healthQuery.isError ? (
              <div className="flex flex-col items-end gap-1 text-right">
                <Badge variant="danger" title={(healthQuery.error as Error).message}>
                  API unreachable
                </Badge>
                <p className="max-w-[220px] text-[10px] leading-snug text-zinc-500">
                  Start the API from the <code className="rounded bg-zinc-100 px-0.5">audit-shield</code> folder:{' '}
                  <code className="whitespace-nowrap rounded bg-zinc-100 px-0.5">.\run-dev.ps1</code> or{' '}
                  <code className="whitespace-nowrap rounded bg-zinc-100 px-0.5">.\run-all-dev.ps1</code>
                </p>
              </div>
            ) : (
              <>
                <Badge
                  variant={healthQuery.data.database_configured ? 'success' : 'warning'}
                  className="gap-1"
                >
                  <Database className="size-3" aria-hidden />
                  {healthQuery.data.database_configured ? 'Database OK' : 'DB not configured'}
                </Badge>
                <Badge variant="outline">API OK</Badge>
              </>
            )}
            <Button variant="outline" size="sm" asChild>
              <a href="/docs" target="_blank" rel="noreferrer">
                <BookOpen className="size-4" />
                OpenAPI
                <ExternalLink className="size-3 opacity-60" />
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main
        id="main"
        className="mx-auto max-w-5xl space-y-10 px-4 py-10"
        role="main"
      >
        <SpotlightHero className="p-6 md:p-9">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">Compliance-grade audit trail</Badge>
              <Badge variant="warning">Assistive output</Badge>
            </div>
            <h2 className="ledger-display text-3xl font-semibold tracking-tight text-[var(--color-ink)] md:text-4xl">
              Corrective RAG with auditor scoring
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-[var(--color-ink-soft)]">
              Every response includes retrieval steps, chunk admission decisions,
              and citations — sealed into the ledger for later inspection. Not
              a compliance guarantee; validate against policy and source documents.
            </p>
          </div>
        </SpotlightHero>

        <MovingBorder>
          <Card className="border-0 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UploadCloud className="size-5 text-emerald-600" aria-hidden />
                Index a document
              </CardTitle>
              <CardDescription>
                Upload a <strong>PDF</strong> or <strong>.txt</strong> file — chunked, embedded via{' '}
                <code className="rounded bg-zinc-100 px-1 text-xs">nomic-embed-text</code>, and stored in Postgres.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ingest-title">Title <span className="text-zinc-400">(optional — defaults to filename)</span></Label>
                  <Input
                    id="ingest-title"
                    placeholder="e.g. unicharm_hvac_ref"
                    {...uploadForm.register('title')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ingest-file">File</Label>
                  <Input
                    id="ingest-file"
                    type="file"
                    accept=".pdf,application/pdf,.txt,text/plain"
                    disabled={uploadIngestMutation.isPending}
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                    aria-describedby="ingest-file-hint"
                  />
                  <p id="ingest-file-hint" className="text-xs text-zinc-500">
                    PDF or plain text · max server default · filename used as title if left blank above
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={onUploadIngest}
                  disabled={uploadIngestMutation.isPending || !uploadFile}
                  className="w-full sm:w-auto"
                >
                  {uploadIngestMutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Extracting &amp; embedding…
                    </>
                  ) : (
                    <>
                      <UploadCloud className="size-4" aria-hidden />
                      Upload &amp; index
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </MovingBorder>

        <MovingBorder>
          <Card className="border-0 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="size-5 text-blue-600" />
                New audit query
              </CardTitle>
              <CardDescription>
                Ask a question or paste a clause. Pick a preset model or choose
                Custom to type an Ollama tag; Default uses the server setting.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={form.handleSubmit(onSubmit)}
                noValidate
              >
                <div className="space-y-2">
                  <Label htmlFor="query">Question</Label>
                  <p className="text-xs text-zinc-500">Try an example</p>
                  <div className="flex flex-wrap gap-2">
                    {AUDIT_EXAMPLES.map((ex) => (
                      <Button
                        key={ex.label}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-auto max-w-full whitespace-normal py-1.5 text-left text-xs font-normal"
                        onClick={() => {
                          form.setValue('query', ex.query)
                          const m = modelFieldsFromApiModel(ex.model)
                          form.setValue('modelChoice', m.modelChoice)
                          form.setValue('modelCustom', m.modelCustom)
                          form.setValue('temperature', ex.temperature ?? 0.2)
                        }}
                      >
                        {ex.label}
                      </Button>
                    ))}
                  </div>
                  <Textarea
                    id="query"
                    placeholder="Example: Summarize warranty obligations for part WDG-4401 and cite the controlling section."
                    {...form.register('query')}
                  />
                  {form.formState.errors.query?.message ? (
                    <p className="text-sm text-red-600">
                      {form.formState.errors.query.message}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="modelChoice">Model (optional)</Label>
                    <select
                      id="modelChoice"
                      className={cn(
                        'flex h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50',
                      )}
                      {...form.register('modelChoice')}
                    >
                      {MODEL_PRESETS.map((p) => (
                        <option key={p.value || 'default'} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    {modelChoice === MODEL_CUSTOM ? (
                      <div className="space-y-1 pt-1">
                        <Label htmlFor="modelCustom" className="text-xs text-zinc-500">
                          Custom model tag
                        </Label>
                        <Input
                          id="modelCustom"
                          placeholder="e.g. mistral:7b-instruct"
                          autoComplete="off"
                          {...form.register('modelCustom')}
                        />
                        {form.formState.errors.modelCustom?.message ? (
                          <p className="text-sm text-red-600">
                            {form.formState.errors.modelCustom.message}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="temperature">Temperature</Label>
                    <Input
                      id="temperature"
                      type="number"
                      step="0.1"
                      min={0}
                      max={2}
                      {...form.register('temperature', { valueAsNumber: true })}
                    />
                  </div>
                </div>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Running pipeline…
                    </>
                  ) : (
                    'Run audited query'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </MovingBorder>

        {expanded ? (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card>
              <CardHeader>
                <CardTitle className="tabular-nums">
                  Result{' '}
                  <span className="text-sm font-normal text-zinc-500">
                    request {expanded.request_id}
                  </span>
                </CardTitle>
                <CardDescription>{expanded.disclaimer}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-zinc-800">
                    Synthesized answer
                  </h3>
                  <p className="whitespace-pre-wrap rounded-lg bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-800">
                    {expanded.answer}
                  </p>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-zinc-800">
                    Citations
                  </h3>
                  {expanded.citations.length === 0 ? (
                    <p className="text-sm text-zinc-500">No citations for this run (empty corpus or no admitted chunks).</p>
                  ) : (
                    <ul className="space-y-2">
                      {expanded.citations.map((c) => (
                        <li
                          key={`${c.chunk_id}-${c.source}`}
                          className="flex flex-wrap items-center gap-2 text-sm"
                        >
                          <Badge variant="info" className="tabular-nums">
                            {c.chunk_id}
                          </Badge>
                          <span className="text-zinc-600">{c.source}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Retrieval &amp; auditor steps</CardTitle>
                <CardDescription>
                  Ordered pipeline stages (embedding, retrieval, auditor, synthesis when corpus has data).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {expanded.steps.map((s, i) => (
                    <li
                      key={`${s.name}-${i}`}
                      className="flex gap-3 rounded-lg border border-zinc-100 bg-zinc-50/50 p-3"
                    >
                      <span className="tabular-nums text-xs font-semibold text-zinc-400">
                        {(i + 1).toString().padStart(2, '0')}
                      </span>
                      <div>
                        <p className="font-medium text-zinc-900">{s.name}</p>
                        <p className="text-sm text-zinc-600">{s.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Admitted chunks</CardTitle>
                <CardDescription>
                  Review admission decisions and scores before relying on text.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {expanded.chunks.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    No retrieved chunks (empty index or early exit). Use <strong>Index document text</strong> above first.
                  </p>
                ) : (
                  <>
                    {expanded.chunks.map((ch) => {
                      return (
                        <div
                          key={ch.id}
                          className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                        >
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge variant="default" className="tabular-nums">
                              {ch.id}
                            </Badge>
                            <Badge
                              variant={ch.admitted ? 'success' : 'danger'}
                              className="tabular-nums"
                            >
                              {ch.admitted ? 'Admitted' : 'Rejected'}
                            </Badge>
                            <Badge variant="outline" className="tabular-nums">
                              score {ch.score.toFixed(2)}
                            </Badge>
                            <span className="text-xs text-zinc-500">{ch.source}</span>
                          </div>
                          <p className="text-sm leading-relaxed text-zinc-700">
                            {ch.text}
                          </p>
                        </div>
                      )
                    })}
                  </>
                )}
              </CardContent>
            </Card>
          </motion.section>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Session audit trail</CardTitle>
            <CardDescription>
              Recent runs in this browser session (request id, time, models).
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="py-2 pr-4 font-medium">request_id</th>
                  <th className="py-2 pr-4 font-medium tabular-nums">time (UTC)</th>
                  <th className="py-2 font-medium">models</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-zinc-500">
                      No runs yet.
                    </td>
                  </tr>
                ) : (
                  history.map((row) => (
                    <tr
                      key={row.request_id}
                      className="border-b border-zinc-100 last:border-0"
                    >
                      <td className="py-3 pr-4 font-mono text-xs text-zinc-800">
                        {row.request_id}
                      </td>
                      <td className="py-3 pr-4 tabular-nums text-zinc-600">
                        {row.time}
                      </td>
                      <td className="py-3 text-zinc-700">{row.models}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
