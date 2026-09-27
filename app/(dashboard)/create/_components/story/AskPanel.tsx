'use client'

import { useEffect, useRef, useState } from 'react'

export type AskMsg = { role: 'user' | 'assistant'; text: string }

interface Props {
  messages: AskMsg[]
  busy: boolean
  /** why asking is switched off right now (e.g. the story is still being written) */
  disabledNote?: string | null
  onSend: (text: string) => void
  canUndo: boolean
  onUndo: () => void
  children?: React.ReactNode
}

const CHIPS = ['Make it shorter', 'Simpler words']

/** "Change it by asking" — one instruction rewrites the whole story. */
export default function AskPanel({ messages, busy, disabledNote, onSend, canUndo, onUndo, children }: Props) {
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const off = busy || !!disabledNote

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [messages, busy])

  const send = (t: string) => {
    const msg = t.trim()
    if (!msg || off) return
    setText('')
    onSend(msg)
  }

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Change it by asking</div>
        <div style={{ fontSize: 13, color: 'var(--ink-light)', marginTop: 2 }}>Rewrites the whole story</div>
      </div>

      {messages.length > 0 && (
        <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', fontSize: 14, lineHeight: 1.45,
              padding: '8px 12px', borderRadius: 10,
              background: m.role === 'user' ? 'var(--ink)' : 'var(--bg-soft)',
              color: m.role === 'user' ? 'var(--bg-card)' : 'var(--ink)',
            }}>{m.text}</div>
          ))}
          {busy && <div style={{ alignSelf: 'flex-start', fontSize: 13, color: 'var(--ink-light)' }}>Rewriting&hellip;</div>}
          <div ref={endRef} />
        </div>
      )}

      {canUndo && !busy && (
        <button type="button" onClick={onUndo} className="btn btn-soft btn-sm" style={{ alignSelf: 'flex-start' }}>
          Undo that change
        </button>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {CHIPS.map(c => (
          <button key={c} type="button" onClick={() => send(c)} disabled={off}
            style={{ fontSize: 13, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--ink)', cursor: off ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: off ? 0.5 : 1 }}>
            {c}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text) } }}
          disabled={off}
          aria-label="Tell it what to change"
          placeholder="Tell it what to change…"
          style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: 'var(--bg-card)' }}
        />
        <button type="button" className="btn btn-soft btn-sm" onClick={() => send(text)} disabled={off || !text.trim()}>
          {busy ? 'Working…' : 'Send'}
        </button>
      </div>
      {disabledNote && <div style={{ fontSize: 12, color: 'var(--ink-light)' }}>{disabledNote}</div>}

      {children}
    </div>
  )
}
