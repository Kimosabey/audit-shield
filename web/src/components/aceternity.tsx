import * as React from 'react'
import { motion } from 'framer-motion'

import { cn } from '@/lib/utils'

/** Aceternity-style subtle grid + fade (light theme). */
export function GridBackground({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 -z-10 overflow-hidden',
        className,
      )}
    >
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `linear-gradient(to right, rgb(228 228 231 / 0.7) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(228 228 231 / 0.7) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-50 via-zinc-50/90 to-zinc-100/80" />
    </div>
  )
}

/** Soft moving gradient border (inspired by Aceternity moving-border). */
export function MovingBorder({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl p-px', className)}>
      <motion.div
        className="absolute -inset-[120%] z-0 opacity-70"
        style={{
          background:
            'conic-gradient(from 0deg, transparent, rgb(37 99 235 / 0.55), rgb(99 102 241 / 0.5), transparent 120deg)',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
      />
      <div className="relative z-10 rounded-[11px] bg-white">{children}</div>
    </div>
  )
}

/** Mouse-follow spotlight (simplified Aceternity spotlight). */
export function SpotlightHero({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [pos, setPos] = React.useState({ x: 50, y: 0 })

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    setPos({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    })
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className={cn('relative overflow-hidden rounded-2xl', className)}
    >
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(600px circle at ${pos.x}% ${pos.y}%, rgb(219 234 254 / 0.55), transparent 45%)`,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  )
}
