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
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', borderRadius: 8,
        background: '#fef2f2', border: '1px solid #fca5a5',
        fontSize: 13, ...style,
      }}>
        <span style={{ fontWeight: 600, color: '#b91c1c' }}>{message}</span>
        <button
          onClick={async () => {
            setRunning(true)
            try { await onConfirm() } finally { setRunning(false); setConfirming(false) }
          }}
          disabled={running}
          style={{
            padding: '4px 12px', borderRadius: 6, border: 'none',
            background: '#b91c1c', color: 'white', fontSize: 12,
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
            border: '1px solid var(--border-light, #e2e8f0)',
            background: 'white', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', color: 'var(--ink-soft, #64748b)',
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
