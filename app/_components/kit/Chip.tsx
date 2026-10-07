import type { ReactNode } from 'react'

/*
 * A CHIP — a short label: a status ("Watched"), a type ("Video"), a price.
 *   neutral — plain fact        info  — sent / on its way
 *   ok      — done, good news   warn  — in progress / needs a look
 *   stop    — failed            money — a price or credits (gold)
 *   strong  — the best news on the screen (navy)
 */
export type ChipTone = 'neutral' | 'info' | 'ok' | 'warn' | 'stop' | 'money' | 'strong'

export default function Chip({ tone = 'neutral', children, className = '' }: { tone?: ChipTone; children: ReactNode; className?: string }) {
  return <span className={`kit-chip kit-chip--${tone} ${className}`.trim()}>{children}</span>
}
