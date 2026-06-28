'use client'

import { useState, useRef, useEffect } from 'react'

interface Props {
  scene: any
  outputType?: string
  sourceData?: unknown
  /** Apply the AI-rewritten scene (auto-apply). */
  onApply: (updatedScene: any) => void
}

type Msg = { role: 'user' | 'assistant'; text: string }

/**
 * Per-scene AI edit chat. The user types an instruction ("make this shorter",
 * "drop the fee numbers") and the AI rewrites THIS scene's narration + slide
 * content in place (auto-apply). One-step Undo restores the pre-edit scene.
 */
export default function SceneEditChat({ scene, outputType, sourceData, onApply }: Props) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [prevScene, setPrevScene] = useState<any>(null) // snapshot for undo
  const [err, setErr] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { scrollRef.current?.scrollTo({ top: 9e9 }) }, [msgs, busy])

  async function send() {
    const instruction = input.trim()
    if (!instruction || busy) return
    setErr(null)
    setInput('')
    setMsgs(m => [...m, { role: 'user', text: instruction }])
    setBusy(true)
    const snapshot = JSON.parse(JSON.stringify(scene)) // capture BEFORE for undo
    try {
      const res = await fetch('/api/scene-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene, instruction, outputType, sourceData,
          history: msgs.map(m => ({ role: m.role, text: m.text })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Edit failed')
      setPrevScene(snapshot)
      onApply(data.scene)
      setMsgs(m => [...m, { role: 'assistant', text: data.reply || 'Applied.' }])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong')
      setMsgs(m => [...m, { role: 'assistant', text: '⚠️ ' + (e instanceof Error ? e.message : 'Edit failed') }])
    } finally {
      setBusy(false)
    }
  }

  function undo() {
    if (!prevScene) return
    onApply(prevScene)
    setPrevScene(null)
    setMsgs(m => [...m, { role: 'assistant', text: 'Reverted to the previous version.' }])
  }

  if (!open) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        style={{
          background: 'none', border: '1px solid var(--border)', borderRadius: 6,
          padding: '3px 10px', fontSize: 11, color: 'var(--ink-light)', cursor: 'pointer',
          fontFamily: 'inherit', fontWeight: 600,
        }}
        title="Edit this scene by chatting with AI"
      >
        ✨ Edit with AI
      </button>
    )
  }

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        marginTop: 8, border: '1px solid var(--mint)', borderRadius: 8,
        background: 'var(--bg-soft)', overflow: 'hidden', width: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'rgba(199,232,168,0.25)' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>✨ Edit this scene with AI</span>
        {prevScene && (
          <button onClick={undo} style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: 'var(--ink-soft)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
            ↺ Undo
          </button>
        )}
        <button onClick={() => setOpen(false)} style={{ marginLeft: prevScene ? 6 : 'auto', background: 'none', border: 'none', fontSize: 16, lineHeight: 1, color: 'var(--ink-light)', cursor: 'pointer', padding: 0 }} title="Close">×</button>
      </div>

      {msgs.length > 0 && (
        <div ref={scrollRef} style={{ maxHeight: 160, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%', padding: '6px 10px', borderRadius: 8, fontSize: 12, lineHeight: 1.45,
              background: m.role === 'user' ? 'var(--mint)' : 'white',
              border: m.role === 'user' ? 'none' : '1px solid var(--border-light)',
              color: 'var(--ink)',
            }}>{m.text}</div>
          ))}
          {busy && <div style={{ alignSelf: 'flex-start', fontSize: 12, color: 'var(--ink-light)', padding: '4px 6px' }}>Thinking…</div>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, padding: 8 }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send() } }}
          placeholder='e.g. "make it shorter and more upbeat"'
          disabled={busy}
          style={{ flex: 1, fontSize: 12, padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border-light)', outline: 'none', fontFamily: 'inherit', background: 'white' }}
        />
        <button
          onClick={send}
          disabled={busy || !input.trim()}
          className="btn btn-primary btn-sm"
          style={{ fontSize: 12, padding: '7px 14px', borderRadius: 6, opacity: busy || !input.trim() ? 0.5 : 1 }}
        >
          {busy ? '…' : 'Send'}
        </button>
      </div>
      {err && <div style={{ fontSize: 11, color: '#b91c1c', padding: '0 10px 8px' }}>{err}</div>}
    </div>
  )
}
