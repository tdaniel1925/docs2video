'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { VideoBrief } from '../../../_lib/types'

export default function BriefPage() {
  const router = useRouter()
  const params = useSearchParams()
  const videoId = params.get('id')

  const [brief, setBrief] = useState<VideoBrief | null>(null)
  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; text: string }[]>([])
  const [building, setBuilding] = useState(true)
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [answering, setAnswering] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Build (or load) the brief on mount.
  useEffect(() => {
    if (!videoId) { setBuilding(false); setError('No video ID.'); return }
    fetch('/api/brief', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId }) })
      .then(r => r.json())
      .then((d) => { if (d.brief) setBrief(d.brief); else setError(d.error || 'Could not build a brief.') })
      .catch(() => setError('Could not build a brief.'))
      .finally(() => setBuilding(false))
  }, [videoId])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chat])

  async function send() {
    const msg = input.trim()
    if (!msg || sending || !videoId) return
    setInput(''); setSending(true); setError(null)
    setChat((c) => [...c, { role: 'user', text: msg }])
    try {
      const res = await fetch('/api/brief/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId, message: msg }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Could not apply that change')
      if (d.brief) setBrief(d.brief)
      setChat((c) => [...c, { role: 'assistant', text: d.reply || 'Updated the brief.' }])
    } catch (e) {
      setChat((c) => [...c, { role: 'assistant', text: `Sorry — ${e instanceof Error ? e.message : 'that didn’t work'}.` }])
    } finally { setSending(false) }
  }

  // Submit answers to the AI's clarifying questions → re-grounds the brief.
  async function submitAnswers() {
    if (!videoId || answering) return
    const filled = Object.fromEntries(Object.entries(answers).filter(([, v]) => v && v.trim()))
    if (Object.keys(filled).length === 0) return
    setAnswering(true); setError(null)
    try {
      const res = await fetch('/api/brief', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, answers: filled }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Could not apply answers')
      if (d.brief) { setBrief(d.brief); setAnswers({}) }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not apply answers')
    } finally { setAnswering(false) }
  }

  async function approve(skip = false) {
    if (!videoId) return
    setSubmitting(true)
    try {
      // Mark approved (best-effort) then continue to the presenter step.
      if (brief && !skip) {
        await fetch('/api/videos/draft', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId, updates: { brief: { ...brief, approved: true } } }),
        }).catch(() => {})
      }
      router.push(`/create/brand?id=${videoId}`)
    } finally { setSubmitting(false) }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px', maxWidth: 880, margin: '0 auto', width: '100%' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', textAlign: 'center', marginBottom: 6, color: 'var(--ink)' }}>Here&rsquo;s what I&rsquo;ll cover</h1>
      <p style={{ fontSize: 16, color: 'var(--ink-soft)', textAlign: 'center', marginBottom: 24, lineHeight: 1.6 }}>
        Review what your video will include. Looks right? Continue. Want changes? Just tell me below.
      </p>

      {building ? (
        <div style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: '48px 0' }}>
          <div className="spinner" style={{ margin: '0 auto 14px' }} /> Reading your content…
        </div>
      ) : brief ? (
        <>
          {/* Brief card */}
          <div style={{ width: '100%', background: 'white', border: '1.5px solid var(--border-light)', borderRadius: 10, padding: 24, marginBottom: 18 }}>
            <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-soft)', background: 'var(--bg-soft)', padding: '3px 10px', borderRadius: 6, marginBottom: 14 }}>{brief.docType}</span>
            {brief.angle ? <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.35, marginBottom: 8 }}>{brief.angle}</div> : null}
            {brief.summary ? <div style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.55, marginBottom: 18 }}>{brief.summary}</div> : null}

            {brief.keyPoints?.length ? (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Key points</div>
                <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--ink)', fontSize: 15, lineHeight: 1.7 }}>
                  {brief.keyPoints.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            ) : null}

            {brief.figures?.length ? (
              <div style={{ marginBottom: brief.emphasis?.length || brief.avoid?.length ? 16 : 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Figures it will show</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {brief.figures.map((f, i) => (
                    <span key={i} style={{ fontSize: 14, background: 'var(--bg-soft)', borderRadius: 8, padding: '6px 12px', color: 'var(--ink)' }}>
                      <strong>{f.value}</strong> <span style={{ color: 'var(--ink-light)' }}>{f.label}</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {brief.emphasis?.length ? <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 8 }}><strong>Emphasis:</strong> {brief.emphasis.join(', ')}</div> : null}
            {brief.avoid?.length ? <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}><strong>Skipping:</strong> {brief.avoid.join(', ')}</div> : null}
          </div>

          {/* Clarifying questions — only shown when the AI is genuinely unsure */}
          {brief.clarifyingQuestions?.length ? (
            <div style={{ width: '100%', background: '#fffdf5', border: '1.5px solid #f5e6a8', borderRadius: 10, padding: 20, marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#92711a', marginBottom: 4 }}>A couple of quick questions to nail this</div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16 }}>Answering these makes the script much more accurate. Optional — you can skip and continue.</div>
              {brief.clarifyingQuestions.map((q) => (
                <div key={q.id} style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{q.question}</div>
                  {q.why ? <div style={{ fontSize: 12, color: 'var(--ink-light)', marginBottom: 8 }}>{q.why}</div> : <div style={{ height: 6 }} />}
                  {q.options?.length ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                      {q.options.map((opt) => {
                        const active = answers[q.id] === opt
                        return (
                          <button key={opt} type="button" onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                            style={{ fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                              border: active ? '1.5px solid var(--ink)' : '1.5px solid var(--border-light)',
                              background: active ? 'var(--ink)' : 'white', color: active ? 'white' : 'var(--ink)' }}>
                            {opt}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                  <input
                    value={answers[q.id] && !q.options?.includes(answers[q.id]) ? answers[q.id] : (q.options ? '' : (answers[q.id] || ''))}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                    placeholder={q.options?.length ? 'Or type your own…' : 'Type your answer…'}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border-light)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
                  />
                </div>
              ))}
              <button onClick={submitAnswers} disabled={answering || Object.values(answers).every((v) => !v?.trim())}
                style={{ padding: '11px 20px', borderRadius: 8, border: 'none', background: '#92711a', color: 'white', fontSize: 14, fontWeight: 700, cursor: answering ? 'default' : 'pointer', fontFamily: 'inherit', opacity: (answering || Object.values(answers).every((v) => !v?.trim())) ? 0.55 : 1 }}>
                {answering ? 'Updating the brief…' : 'Update brief with my answers'}
              </button>
            </div>
          ) : null}

          {/* Chat */}
          <div style={{ width: '100%', background: 'white', border: '1.5px solid var(--border-light)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Want changes? Tell me</div>
            {chat.length ? (
              <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {chat.map((m, i) => (
                  <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', fontSize: 14, lineHeight: 1.45, padding: '8px 12px', borderRadius: 10, background: m.role === 'user' ? 'var(--mint)' : 'var(--bg-soft)', color: 'var(--ink)' }}>{m.text}</div>
                ))}
                <div ref={chatEndRef} />
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="e.g. Focus on the death benefit, skip fees, keep it reassuring"
                disabled={sending}
                style={{ flex: 1, padding: '11px 14px', borderRadius: 8, border: '1.5px solid var(--border-light)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
              />
              <button onClick={() => send()} disabled={sending || !input.trim()} style={{ padding: '11px 18px', borderRadius: 8, border: 'none', background: 'var(--ink)', color: 'white', fontSize: 14, fontWeight: 700, cursor: sending ? 'default' : 'pointer', fontFamily: 'inherit', opacity: sending ? 0.6 : 1 }}>
                {sending ? '…' : 'Send'}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div style={{ color: '#b91c1c', fontSize: 14, marginBottom: 20 }}>{error || 'Could not build a brief.'}</div>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={() => approve(false)} disabled={submitting || building} style={{ padding: '14px 28px', borderRadius: 10, border: 'none', background: 'var(--ink)', color: 'white', fontSize: 16, fontWeight: 700, cursor: submitting ? 'default' : 'pointer', fontFamily: 'inherit', opacity: (submitting || building) ? 0.6 : 1 }}>
          {submitting ? 'Continuing…' : 'Looks good — continue →'}
        </button>
        <button onClick={() => approve(true)} disabled={submitting} style={{ background: 'none', border: 'none', fontSize: 14, color: 'var(--ink-light)', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}>
          Skip
        </button>
      </div>
    </div>
  )
}
