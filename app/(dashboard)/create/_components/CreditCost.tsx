'use client'

import React from 'react'
import { usePriceQuote, formatCredits } from './make/usePriceQuote'
import type { MakeOutput } from '../../../_lib/price-quote'

/**
 * "This will use N credits" for a saved project. The number is the SERVER's
 * price (/api/price-quote — the same functions that charge). It used to be
 * worked out here in the browser, which could drift from what was charged.
 */
export default function CreditCost({ videoId, output }: { videoId: string; output?: MakeOutput }) {
  const { quote, error, loading } = usePriceQuote(videoId)

  if (loading && !quote) return <div style={styles.container}><span style={styles.muted}>Working out the price…</span></div>
  if (!quote) return <div style={styles.container}><span style={styles.error}>{error || 'Could not load the price.'}</span></div>

  const q = quote.options[output ?? (quote.current as MakeOutput)] ?? quote.options.video
  if (!q) return null
  if (q.free) return <div style={styles.container}><span>Your account isn’t charged for this.</span></div>

  const sufficient = quote.balance >= q.total
  return (
    <div style={styles.container}>
      {sufficient ? (
        <span>This will use <strong>{formatCredits(q.total)}</strong> ({formatCredits(quote.balance)} now)</span>
      ) : (
        <span style={styles.warning}>
          This needs <strong>{formatCredits(q.total)}</strong> and you have <strong>{formatCredits(quote.balance)}</strong>. Top up to continue.
        </span>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '12px 16px',
    borderRadius: 10,
    border: '1px solid var(--border-light)',
    background: 'var(--bg-card)',
    fontSize: 14,
    color: 'var(--ink)',
  },
  muted: { fontSize: 13, color: 'var(--ink-light)' },
  error: { fontSize: 13, color: 'var(--error-text)' },
  warning: { color: 'var(--ink)' },
}
