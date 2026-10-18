'use client'

import { X } from 'lucide-react'
import type { VideoBrief } from '../../../../_lib/types'
import { Note } from '../../../../_components/kit'

/**
 * How big a number tile's figure is drawn. Short figures ("$176,204") stay
 * big; longer ones ("$10,000 for 20 years", "Preferred Non-Tobacco") step
 * down a size AND wrap, so a fact is never cut off (audit 2026-10-09: the
 * tiles were one-line boxes that chopped "Preferred Non-Toba…").
 */
export function numTileSize(value: string): 'big' | 'mid' | 'small' {
  const n = (value ?? '').trim().length
  if (n <= 12) return 'big'
  if (n <= 22) return 'mid'
  return 'small'
}

/** Keep a tile one paragraph: Enter / pasted line breaks become spaces. */
const oneLine = (v: string) => v.replace(/\s*[\r\n]+\s*/g, ' ')

interface Props {
  brief: VideoBrief | null
  building: boolean
  /** Change the point, the numbers or the summary (marks the story out of date). */
  onEdit: (patch: Partial<VideoBrief>) => void
  /** Edits made since the story was written: offer a free rewrite. */
  changed: boolean
  writing: boolean
  hasStory: boolean
  onRewrite: () => void
  onUndo: () => void
  /** show the AI's questions (only before the story is written) */
  showQuestions: boolean
  answers: Record<string, string>
  setAnswers: (fn: (a: Record<string, string>) => Record<string, string>) => void
  answering: boolean
  onAnswer: () => void
  onSkipQuestions: () => void
}

/**
 * WHAT WE READ — the one point (a big card) and the numbers (big tiles),
 * exactly as they'll go into the story. Every one can be changed or removed
 * right here, so a wrong number is caught before it's narrated. (This was
 * "Here's what we read" on step 1; it sits next to the story now.)
 *
 * Changing them after the story is written leaves the scenes saying the old
 * ones — so a free "Rewrite the story with these" is offered, or "Undo".
 *
 * If the AI was unsure about something that would change the story, its
 * questions show here before anything is written.
 */
export default function OnePoint({
  brief, building, onEdit, changed, writing, hasStory, onRewrite, onUndo,
  showQuestions, answers, setAnswers, answering, onAnswer, onSkipQuestions,
}: Props) {
  if (building) {
    return (
      <div className="cf-card cf-reading" style={{ flexDirection: 'row', alignItems: 'center' }}>
        <div className="spinner" /> <span className="cf-hint">Finding the one point and the numbers&hellip;</span>
      </div>
    )
  }
  if (!brief) return null

  const point = brief.angle || brief.summary || ''
  const figures = brief.figures ?? []
  const questions = showQuestions ? (brief.clarifyingQuestions || []) : []
  const anyAnswer = Object.values(answers).some(v => v?.trim())
  const setFig = (i: number, part: Partial<{ label: string; value: string }>) =>
    onEdit({ figures: figures.map((f, j) => (j === i ? { ...f, ...part } : f)) })

  return (
    <>
      <textarea
        className="cf-card cf-point"
        aria-label="The one point"
        value={point}
        rows={Math.max(1, Math.ceil(point.length / 60))}
        onChange={(e) => onEdit({ angle: e.target.value })}
      />

      {figures.length ? (
        <ul className="cf-nums" aria-label="The numbers we’ll use">
          {figures.map((f, i) => (
            <li key={i} className="cf-card cf-num">
              {/* Text boxes that WRAP (not one-line inputs) so a long figure
                  or label shows in full on a phone and a wide screen. */}
              <textarea
                className="cf-num-value"
                data-size={numTileSize(f.value ?? '')}
                aria-label={`Number ${i + 1}`}
                rows={Math.max(1, Math.ceil((f.value ?? '').length / 14))}
                value={f.value ?? ''}
                onChange={(e) => setFig(i, { value: oneLine(e.target.value) })}
              />
              <textarea
                className="cf-num-label"
                aria-label={`What number ${i + 1} is`}
                rows={Math.max(1, Math.ceil((f.label ?? '').length / 30))}
                value={f.label ?? ''}
                onChange={(e) => setFig(i, { label: oneLine(e.target.value) })}
              />
              <button type="button" className="cf-num-x" aria-label={`Remove ${f.value || 'this number'}`} onClick={() => onEdit({ figures: figures.filter((_, j) => j !== i) })}>
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {changed && hasStory && !writing ? (
        <Note
          tone="warn"
          title="You changed what we read."
          action={
            <span className="cf-buttons">
              <button type="button" className="kit-btn kit-btn--secondary kit-btn--sm" onClick={onRewrite}>Rewrite the story with it</button>
              <button type="button" className="kit-btn kit-btn--quiet kit-btn--sm" onClick={onUndo}>Undo my changes</button>
            </span>
          }
        >
          The scenes still say the old version. Rewriting is free and takes about a minute.
        </Note>
      ) : null}

      {brief.keyPoints?.length || brief.summary ? (
        <details className="cf-card cf-more">
          <summary>What it covers</summary>
          <div className="cf-more-in">
            <label className="cf-hint" htmlFor="s2-summary">What it says, in short</label>
            <textarea id="s2-summary" className="cf-input" rows={3} value={brief.summary ?? ''} onChange={(e) => onEdit({ summary: e.target.value })} />
            {brief.keyPoints?.length ? (
              <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--ink)', fontSize: 'var(--fs-body)', lineHeight: 1.6 }}>
                {brief.keyPoints.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            ) : null}
            {brief.avoid?.length ? <p className="cf-hint"><strong>Leaving out:</strong> {brief.avoid.join(', ')}</p> : null}
          </div>
        </details>
      ) : null}

      {questions.length ? (
        <div className="cf-card cf-reading" style={{ borderColor: 'var(--warning)' }}>
          <p className="cf-label" style={{ margin: 0, flexDirection: 'column', alignItems: 'flex-start' }}>
            A couple of quick questions first
            <small>Your answers make the story more accurate. You can skip them.</small>
          </p>
          {questions.map((q) => (
            <div key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div style={{ fontSize: 'var(--fs-lead)', fontWeight: 700, color: 'var(--ink)' }}>{q.question}</div>
              {q.why ? <div className="cf-hint">{q.why}</div> : null}
              {q.options?.length ? (
                <div className="cf-chips">
                  {q.options.map((opt) => (
                    <button key={opt} type="button" className="cf-chip" aria-pressed={answers[q.id] === opt} onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}>
                      {opt}
                    </button>
                  ))}
                </div>
              ) : null}
              <input
                className="cf-input"
                value={answers[q.id] && !q.options?.includes(answers[q.id]) ? answers[q.id] : (q.options ? '' : (answers[q.id] || ''))}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                placeholder={q.options?.length ? 'Or type your own…' : 'Type your answer…'}
                aria-label={`Your answer: ${q.question}`}
              />
            </div>
          ))}
          <div className="cf-buttons" style={{ alignItems: 'center' }}>
            <button type="button" className="kit-btn kit-btn--secondary" onClick={onAnswer} disabled={answering || !anyAnswer}>
              {answering ? 'Using your answers…' : 'Use my answers and write the story'}
            </button>
            <button type="button" className="cf-link" onClick={onSkipQuestions} disabled={answering}>
              Skip — just write it
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
