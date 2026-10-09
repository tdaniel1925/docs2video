'use client'

import { RotateCcw, TriangleAlert } from 'lucide-react'
import type { Video } from '../../../../_lib/types'
import { Button } from '../../../../_components/kit'

/** The calm words on a project that didn't finish (a guard test reads them). */
export const FAILED_WORDS = {
  title: 'This one didn’t finish.',
  what: 'Any credits it used are given back automatically. Try again — most of the time the second run works. If it stops at the same place, start a new project or ask the help assistant.',
  retry: 'Try again',
  fresh: 'Start a new project',
} as const

// A project that failed: a calm sentence, what to do, the reason (folded away).
export default function FailedCard({ video, onRetry }: { video: Video; onRetry: () => void }) {
  return (
    <div className="kit-card" style={{ padding: '36px 28px', textAlign: 'center' }}>
      <span
        aria-hidden="true"
        style={{ display: 'inline-grid', placeItems: 'center', width: 44, height: 44, borderRadius: 10, background: 'var(--error-bg)', color: 'var(--error-text)', marginBottom: 12 }}
      >
        <TriangleAlert size={20} />
      </span>
      <h2 style={{ margin: '0 0 8px', fontSize: 'var(--fs-h3)', fontWeight: 800, color: 'var(--ink)' }}>{FAILED_WORDS.title}</h2>
      <p style={{ margin: '0 auto 6px', maxWidth: 560, fontSize: 'var(--fs-body)', lineHeight: 1.55, color: 'var(--ink-soft)' }}>{FAILED_WORDS.what}</p>
      {video.error_message && (
        <p style={{ margin: '0 auto 12px', maxWidth: 560, fontSize: 'var(--fs-small)', color: 'var(--ink-light)' }}>What we know: {video.error_message}</p>
      )}

      {/*
        WHAT ACTUALLY WENT WRONG.

        The real cause IS recorded, in progress_detail — e.g. "render exit 1"
        from an AWS call, which is the difference between "try again" and
        "something is misconfigured and trying again will not help". Folded
        away, because most people only want the first line.
      */}
      {video.progress_detail?.startsWith('[fail]') && (
        <details style={{ margin: '0 auto 12px', textAlign: 'left', maxWidth: 620 }}>
          <summary style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-soft)', cursor: 'pointer' }}>The technical details</summary>
          <pre style={{
            fontSize: 'var(--fs-caption)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            background: 'var(--bg-soft)', borderRadius: 8, padding: '10px 12px', marginTop: 8,
            color: 'var(--ink-soft)', maxHeight: 220, overflow: 'auto',
          }}>{video.progress_detail.replace(/^\[fail\]\s*/, '')}</pre>
        </details>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', justifyContent: 'center', marginTop: 16 }}>
        <Button onClick={onRetry}><RotateCcw size={16} />{FAILED_WORDS.retry}</Button>
        <Button href="/create" variant="secondary">{FAILED_WORDS.fresh}</Button>
      </div>
    </div>
  )
}
