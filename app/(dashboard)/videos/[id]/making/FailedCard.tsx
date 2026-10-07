'use client'

import type { Video } from '../../../../_lib/types'

// A project that failed: the reason, what went wrong (folded away), Retry.
// Moved out of the result page unchanged.
export default function FailedCard({ video, onRetry }: { video: Video; onRetry: () => void }) {
  return (

  <div style={{
    background: 'white',
    border: '1px solid var(--rose)',
    borderRadius: 10,
    padding: '48px',
    textAlign: 'center',
  }}>
    <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--error)', marginBottom: '8px' }}>
      Video Generation Failed
    </p>
    {video.error_message && (
      <p style={{ fontSize: '14px', color: 'var(--ink-soft)', marginBottom: '16px' }}>{video.error_message}</p>
    )}

    {/*
      WHAT ACTUALLY WENT WRONG.

      The friendly line above says "generation failed", which tells you
      nothing you can act on — retry, or is it going to fail the same way
      every time? The real cause IS recorded, in progress_detail, and was
      simply never shown: one failure read "render exit 1" from an AWS
      call, which is the difference between "try again" and "something is
      misconfigured and trying again will not help".

      Folded away, because most people only want the first line — but
      there, so nobody has to ask us to look in the database for them.
    */}
    {video.progress_detail?.startsWith('[fail]') && (
      <details style={{ marginBottom: 16, textAlign: 'left', maxWidth: 620, marginLeft: 'auto', marginRight: 'auto' }}>
        <summary style={{ fontSize: 13, color: 'var(--ink-soft)', cursor: 'pointer' }}>What went wrong</summary>
        <pre style={{
          fontSize: 11.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          background: 'var(--bg-soft)', borderRadius: 8, padding: '10px 12px', marginTop: 8,
          color: 'var(--ink-soft)', maxHeight: 220, overflow: 'auto',
        }}>{video.progress_detail.replace(/^\[fail\]\s*/, '')}</pre>
      </details>
    )}
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
      <button onClick={onRetry} className="btn btn-primary">
        Retry Generation
      </button>
      <a href="/create" className="btn btn-soft">Create New</a>
    </div>
  </div>
  )
}
