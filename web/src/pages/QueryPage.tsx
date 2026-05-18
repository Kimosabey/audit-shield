import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  BookOpen,
  ClipboardCheck,
  ExternalLink,
  Loader2,
  Shield,
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
import { postQuery, type QueryResponse } from '@/lib/api'

const schema = z.object({
  query: z.string().min(1, 'Enter an audit question or clause to verify.'),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
})

type FormValues = z.infer<typeof schema>

type AuditRow = {
  request_id: string
  time: string
  models: string
}

export function QueryPage() {
  const [result, setResult] = useState<QueryResponse | null>(null)
  const [history, setHistory] = useState<AuditRow[]>([])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { query: '', model: '', temperature: 0.2 },
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
      model: values.model?.trim() || null,
      temperature:
        values.temperature === undefined || Number.isNaN(values.temperature)
          ? null
          : values.temperature,
    })
  }

  return (
    <div className="relative min-h-screen">
      <GridBackground />
      <header className="border-b border-zinc-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Shield className="size-5" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                SelfAware®
              </p>
              <h1 className="text-lg font-semibold text-zinc-900">AuditShield</h1>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="/docs" target="_blank" rel="noreferrer">
              <BookOpen className="size-4" />
              OpenAPI
              <ExternalLink className="size-3 opacity-60" />
            </a>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-10">
        <SpotlightHero className="border border-zinc-200/80 bg-white/90 p-6 shadow-sm md:p-8">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">Light console</Badge>
              <Badge variant="warning">Assistive output</Badge>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl">
              Corrective RAG with auditor scoring
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-zinc-600">
              Responses include retrieval steps, chunk admission decisions, and
              citations. They are not a compliance guarantee — validate against
              your policy and source documents.
            </p>
          </div>
        </SpotlightHero>

        <MovingBorder>
          <Card className="border-0 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="size-5 text-blue-600" />
                New audit query
              </CardTitle>
              <CardDescription>
                Ask a question or paste a clause. Optional model overrides your
                server default.
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
                    <Label htmlFor="model">Model (optional)</Label>
                    <Input
                      id="model"
                      placeholder="e.g. llama3.2"
                      {...form.register('model')}
                    />
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
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Retrieval &amp; auditor steps</CardTitle>
                <CardDescription>
                  Ordered pipeline stages (stub or live Ollama when configured).
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
                {expanded.chunks.map((ch) => (
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
                ))}
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
