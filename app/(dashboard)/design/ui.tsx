'use client'

import { useRouter } from 'next/navigation'

// Shared tokens + chrome for the four wizard pages, so each page is just its
// own body and nobody re-invents a button. Same palette as /flyer.
export const INK = 'var(--ink,#23201c)'
export const SOFT = 'var(--ink-soft,#6b6459)'
export const LINE = 'var(--border,#ddd6cc)'
export const CREAM = 'var(--cream,#F4F1EC)'
export const MINT = 'var(--mint,#C7E8A8)'

export const card = {
  background: 'white', border: `1px solid ${LINE}`, borderRadius: 12, padding: 20,
} as const

export const plainBtn = {
  padding: '9px 16px', borderRadius: 9, border: `1px solid ${LINE}`, background: 'white',
  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: INK,
} as const

export const primaryBtn = {
  ...plainBtn, background: INK, color: 'white', border: '1px solid transparent',
} as const

/**
 * The Back / Next footer every step shares. Next is disabled with a hint until
 * the step is answered, so nobody advances past a decision the generator needs.
 */
export function StepNav({
  back, next, nextLabel = 'Next', nextReady = true, nextHint, onNext,
}: {
  back?: string
  next?: string
  nextLabel?: string
  nextReady?: boolean
  nextHint?: string
  onNext?: () => void
}) {
  const router = useRouter()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, marginTop: 22, flexWrap: 'wrap',
    }}>
      <div>
        {back && (
          <button style={plainBtn} onClick={() => router.push(back)}>&larr; Back</button>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {!nextReady && nextHint && (
          <span style={{ fontSize: 12.5, color: SOFT }}>{nextHint}</span>
        )}
        {(next || onNext) && (
          <button
            style={{ ...primaryBtn, opacity: nextReady ? 1 : 0.4, cursor: nextReady ? 'pointer' : 'default' }}
            disabled={!nextReady}
            // onNext is a SIDE EFFECT (e.g. save the words), not a replacement
            // for navigating. Run it, THEN go to the next page. Doing one or the
            // other left step 2 saving but never advancing.
            onClick={() => { if (!nextReady) return; onNext?.(); if (next) router.push(next) }}>
            {nextLabel} &rarr;
          </button>
        )}
      </div>
    </div>
  )
}

/** The centered column each page body sits in. */
export function StepShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 1100, width: '100%', margin: '0 auto', padding: '24px 32px 48px' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 26, color: INK }}>{title}</h1>
      {subtitle && <p style={{ margin: '0 0 20px', fontSize: 14, color: SOFT, lineHeight: 1.55 }}>{subtitle}</p>}
      {children}
    </div>
  )
}
