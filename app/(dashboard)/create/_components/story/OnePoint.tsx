'use client'

import type { VideoBrief } from '../../../../_lib/types'

interface Props {
  brief: VideoBrief | null
  building: boolean
  /** show the AI's questions (only before the story is written) */
  showQuestions: boolean
  answers: Record<string, string>
  setAnswers: (fn: (a: Record<string, string>) => Record<string, string>) => void
  answering: boolean
  onAnswer: () => void
  onSkipQuestions: () => void
}

const eyebrow: React.CSSProperties = {
  fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)',
}

/**
 * THE ONE POINT — what the story is built around (the brief's angle), plus the
 * numbers it pulled from the source. If the AI was unsure about something that
 * would change the story, its questions show here before anything is written.
 */
export default function OnePoint({ brief, building, showQuestions, answers, setAnswers, answering, onAnswer, onSkipQuestions }: Props) {
  if (building) {
    return (
      <div style={{ ...box, display: 'flex', alignItems: 'center', gap: 12, color: 'var(--ink-soft)', fontSize: 14 }}>
        <div className="spinner" /> Reading what you gave us&hellip;
      </div>
    )
  }
  if (!brief) return null

  const point = brief.angle || brief.summary
  const questions = showQuestions ? (brief.clarifyingQuestions || []) : []
  const anyAnswer = Object.values(answers).some(v => v?.trim())

  return (
    <>
      <div style={box}>
        <div style={eyebrow}>The one point</div>
        {point ? <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.35, marginTop: 6 }}>{point}</div> : null}
        {brief.figures?.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12 }}>
            {brief.figures.map((f, i) => (
              <span key={i} style={{ fontSize: 13, background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 8, padding: '5px 10px', color: 'var(--ink)' }}>
                <strong>{f.value}</strong> <span style={{ color: 'var(--ink-light)' }}>{f.label}</span>
              </span>
            ))}
            <span style={{ fontSize: 12, color: 'var(--ink-light)' }}>numbers from your source</span>
          </div>
        ) : null}
        {brief.keyPoints?.length ? (
          <details style={{ marginTop: 12 }}>
            <summary style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)', cursor: 'pointer' }}>What it covers</summary>
            <ul style={{ margin: '8px 0 0', paddingLeft: 20, color: 'var(--ink)', fontSize: 14, lineHeight: 1.6 }}>
              {brief.keyPoints.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
            {brief.avoid?.length ? <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 6 }}><strong>Leaving out:</strong> {brief.avoid.join(', ')}</div> : null}
          </details>
        ) : null}
      </div>

      {questions.length ? (
        <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)', borderRadius: 10, padding: 18, marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', marginBottom: 2 }}>A couple of quick questions first</div>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 14 }}>Your answers make the story more accurate. You can skip them.</div>
          {questions.map((q) => (
            <div key={q.id} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{q.question}</div>
              {q.why ? <div style={{ fontSize: 12, color: 'var(--ink-light)', marginBottom: 8 }}>{q.why}</div> : <div style={{ height: 6 }} />}
              {q.options?.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  {q.options.map((opt) => {
                    const active = answers[q.id] === opt
                    return (
                      <button key={opt} type="button" onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                        style={{ fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                          border: active ? '1.5px solid var(--ink)' : '1.5px solid var(--border-light)',
                          background: active ? 'var(--ink)' : 'var(--bg-card)', color: active ? 'var(--bg-card)' : 'var(--ink)' }}>
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
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border-light)', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: 'var(--bg-card)' }}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={onAnswer} disabled={answering || !anyAnswer}>
              {answering ? 'Using your answers…' : 'Use my answers and write the story'}
            </button>
            <button type="button" onClick={onSkipQuestions} disabled={answering}
              style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--ink-soft)', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}>
              Skip — just write it
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}

const box: React.CSSProperties = {
  background: 'color-mix(in srgb, var(--mint) 12%, var(--bg-card))',
  border: '1px solid color-mix(in srgb, var(--mint) 45%, var(--border-light))',
  borderRadius: 10, padding: '18px 20px', marginBottom: 18,
}
