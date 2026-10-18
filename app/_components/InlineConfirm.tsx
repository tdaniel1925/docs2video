'use client'

import { useState } from 'react'

interface InlineConfirmProps {
  onConfirm: () => void | Promise<void>
  message: string
  confirmLabel?: string
  cancelLabel?: string
  children: React.ReactNode // the trigger button
  style?: React.CSSProperties
}

export default function InlineConfirm({ onConfirm, message, confirmLabel = 'Yes', cancelLabel = 'Cancel', children, style }: InlineConfirmProps) {
  const [confirming, setConfirming] = useState(false)
  const [running, setRunning] = useState(false)

  if (confirming) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
        padding: '6px 12px', borderRadius: 8,
        background: 'var(--error-bg)', border: '1px solid var(--error-border)',
        fontSize: 'var(--fs-small)', ...style,
      }}>
        <span style={{ fontWeight: 600, color: 'var(--error-text)' }}>{message}</span>
        <button
          onClick={async () => {
            setRunning(true)
            try { await onConfirm() } finally { setRunning(false); setConfirming(false) }
          }}
          disabled={running}
          style={{
            padding: '4px 12px', borderRadius: 6, border: 'none',
            background: 'var(--error-text)', color: 'var(--on-ink)', fontSize: 'var(--fs-caption)',
            fontWeight: 600, cursor: running ? 'wait' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {running ? '...' : confirmLabel}
        </button>
        <button
          onClick={() => setConfirming(false)}
          style={{
            padding: '4px 12px', borderRadius: 6,
            border: '1px solid var(--border-light)',
            background: 'var(--bg-card)', fontSize: 'var(--fs-caption)', fontWeight: 600,
            cursor: 'pointer', color: 'var(--ink-soft)',
            fontFamily: 'inherit',
          }}
        >
          {cancelLabel}
        </button>
      </div>
    )
  }

  return <span onClick={() => setConfirming(true)}>{children}</span>
}
