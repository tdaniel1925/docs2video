'use client'

import { useState } from 'react'

export type AskMsg = { role: 'user' | 'assistant'; text: string }

interface Props {
  messages: AskMsg[]
  busy: boolean
  /** why asking is switched off right now (e.g. the story is still being written) */
  disabledNote?: string | null
  onSend: (text: string) => void
  canUndo: boolean
  onUndo: () => void
}

/**
 * "Ask for a change" — one line under the scenes. One instruction rewrites
 * the whole story (before it's written, it reshapes the point instead).
 * The last few replies show under it, with a one-step Undo.
 */
export default function AskPanel({ messages, busy, disabledNote, onSend, canUndo, onUndo }: Props) {
  const [text, setText] = useState('')
  const off = busy || !!disabledNote

  const send = (t: string) => {
    const msg = t.trim()
    if (!msg || off) return
    setText('')
    onSend(msg)
  }

  const recent = messages.slice(-4)

  return (
    <section aria-label="Change the whole story" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <form className="cf-ask" onSubmit={(e) => { e.preventDefault(); send(text) }}>
        <input
          className="cf-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={off}
          aria-label="Ask for a change"
          placeholder="Ask for a change, e.g. make it shorter"
        />
        <button type="submit" className="kit-btn kit-btn--secondary cf-helper-btn" disabled={off || !text.trim()}>
          {busy ? 'Working…' : 'Change'}
        </button>
      </form>
      {disabledNote ? <p className="cf-hint">{disabledNote}</p> : null}

      {recent.length > 0 || busy ? (
        <ul className="cf-ask-log" aria-live="polite">
          {recent.map((m, i) => (
            <li key={i} className={m.role === 'user' ? 'is-you' : ''}>{m.role === 'user' ? `You: ${m.text}` : m.text}</li>
          ))}
          {busy ? <li>Rewriting&hellip;</li> : null}
        </ul>
      ) : null}

      {canUndo && !busy ? (
        <button type="button" onClick={onUndo} className="kit-btn kit-btn--quiet kit-btn--sm" style={{ alignSelf: 'flex-start' }}>
          Undo that change
        </button>
      ) : null}
    </section>
  )
}
