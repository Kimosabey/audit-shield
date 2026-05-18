import * as React from 'react'
import { motion, useReducedMotion } from 'framer-motion'

import { cn } from '@/lib/utils'

/* === Compliance Ledger — signature visuals === */

/** Parchment background with vellum grain + watermark crest. */
export function GridBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)}
    >
      {/* Vellum fibres */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0 22px, rgba(15,27,61,0.04) 22px 23px)," +
            "repeating-linear-gradient(90deg, transparent 0 60px, rgba(180,83,9,0.045) 60px 61px)",
        }}
      />
      {/* Watermark crest */}
      <svg
        className="absolute -right-24 -top-24 size-[36rem] opacity-[0.06]"
        viewBox="0 0 200 200"
        fill="none"
      >
        <circle cx="100" cy="100" r="84" stroke="#0f1b3d" strokeWidth="1.5" />
        <circle cx="100" cy="100" r="68" stroke="#0f1b3d" strokeWidth="0.6" />
        <path d="M100 28 L116 72 L162 78 L126 108 L138 154 L100 130 L62 154 L74 108 L38 78 L84 72 Z"
              stroke="#7c1d1d" strokeWidth="1.2" fill="none" />
        <text x="100" y="184" fill="#0f1b3d" textAnchor="middle" fontSize="9"
              fontFamily="Fraunces, serif" letterSpacing="2">VERITAS · OFFICIO</text>
      </svg>
    </div>
  )
}

/** Wax-seal stamped "envelope" — the ledger card. */
export function MovingBorder({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('relative paper-card overflow-hidden', className)}>
      {/* Gold-leaf corner accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 size-20"
        style={{
          background: 'linear-gradient(225deg, rgba(180,83,9,0.55), transparent 65%)',
          clipPath: 'polygon(0 0, 100% 0, 100% 100%)',
        }}
      />
      <div className="relative">{children}</div>
    </div>
  )
}

/** Hero "frontispiece" — embossed banner with wax seal. */
export function SpotlightHero({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const reduce = useReducedMotion()
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl border border-[var(--color-rule)] paper-card',
        className,
      )}
    >
      {/* Embossed band */}
      <div
        aria-hidden
        className="absolute inset-x-6 top-0 h-1 rounded-b-full"
        style={{ background: 'linear-gradient(to right, transparent, var(--color-leaf), transparent)' }}
      />

      {/* Wax-seal stamp */}
      <motion.div
        aria-hidden
        initial={reduce ? false : { scale: 0.6, rotate: -12, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.34, 1.4, 0.64, 1] }}
        className="absolute right-6 top-6 grid size-20 place-items-center rounded-full text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-paper)] shadow-lg"
        style={{
          background:
            'radial-gradient(circle at 30% 30%, #a52a2a, #7c1d1d 60%, #4c0a0a)',
          boxShadow:
            '0 8px 18px -8px rgba(76, 10, 10, 0.55), inset 0 1px 0 rgba(255,255,255,0.25)',
        }}
      >
        <span>VERITAS</span>
      </motion.div>

      <div className="relative pr-28">{children}</div>

      {/* Ledger bottom rule */}
      <div className="ledger-rule mt-6" aria-hidden />
    </section>
  )
}

/** Vertical pipeline timeline (ledger-style entries). */
export function PipelineLedger({
  steps,
}: {
  steps: { name: string; detail: string }[]
}) {
  return (
    <ol className="relative space-y-3 border-l-2 border-[var(--color-rule)] pl-6">
      {steps.map((s, i) => (
        <motion.li
          key={`${s.name}-${i}`}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.04 * i, duration: 0.25 }}
          className="relative"
        >
          <span
            aria-hidden
            className="absolute -left-[31px] grid size-6 place-items-center rounded-full bg-[var(--color-ink)] text-[10px] font-bold text-[var(--color-paper)] mono"
          >
            {(i + 1).toString().padStart(2, '0')}
          </span>
          <p className="font-semibold text-[var(--color-ink)]">{s.name}</p>
          <p className="text-sm leading-relaxed text-[var(--color-ink-soft)]">{s.detail}</p>
        </motion.li>
      ))}
    </ol>
  )
}
