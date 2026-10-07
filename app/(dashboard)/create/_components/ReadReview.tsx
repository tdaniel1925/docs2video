'use client'

import type { VideoBrief } from '../../../_lib/types'
import { Note } from '../../../_components/kit'

/**
 * "HERE'S WHAT WE READ" — shown on step 1 after the content is read, before
 * the story is written. The summary, the one point and the figures the story
 * will use EXACTLY as written, each one editable, so a wrong number is caught
 * here — not after it's been narrated in a finished video.
 *
 * Nothing new is paid for: this is the same summary step 2 used to make on
 * arrival (/api/brief), made one screen earlier. Step 2 reuses it.
 */
export type Figure = { label: string; value: string }

export default function ReadReview({
  brief,
  summary,
  setSummary,
  point,
  setPoint,
  figures,
  setFigures,
  hasQuestions,
}: {
  brief: VideoBrief | null
  summary: string
  setSummary: (v: string) => void
  point: string
  setPoint: (v: string) => void
  figures: Figure[]
  setFigures: (f: Figure[]) => void
  hasQuestions: boolean
}) {
  if (!brief) {
    return (
      <Note tone="warn" title="We couldn’t sum it up this time.">
        The story will still use everything you gave us — check it on the next step.
      </Note>
    )
  }
  const setFig = (i: number, part: Partial<Figure>) => setFigures(figures.map((f, j) => (j === i ? { ...f, ...part } : f)))
  return (
    <div className="s1-review">
      <label className="s1-field" htmlFor="s1-summary">
        <span className="s1-label">What it says</span>
        <span className="s1-hint">A short summary, in plain words.</span>
      </label>
      <textarea id="s1-summary" className="ws-input" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />

      <label className="s1-field" htmlFor="s1-point">
        <span className="s1-label">The one point</span>
        <span className="s1-hint">The one thing your client should take away. The whole story is built around it.</span>
      </label>
      <textarea id="s1-point" className="ws-input" rows={2} value={point} onChange={(e) => setPoint(e.target.value)} />

      <div className="s1-field">
        <span className="s1-label">The numbers we’ll use</span>
        <span className="s1-hint">These go into the story exactly as written. Fix any that are wrong, or remove one you don’t want.</span>
      </div>
      {figures.length === 0 ? (
        <p className="s1-hint">No numbers stood out in what you gave us.</p>
      ) : (
        <ul className="s1-figures">
          {figures.map((f, i) => (
            <li key={i} className="s1-figure">
              <input className="ws-input s1-figure-value" aria-label={`Number ${i + 1}`} value={f.value} onChange={(e) => setFig(i, { value: e.target.value })} />
              <input className="ws-input" aria-label={`What number ${i + 1} is`} value={f.label} onChange={(e) => setFig(i, { label: e.target.value })} />
              <button type="button" className="kit-btn kit-btn--quiet kit-btn--sm" aria-label={`Remove ${f.value || 'this number'}`} onClick={() => setFigures(figures.filter((_, j) => j !== i))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {hasQuestions ? (
        <Note tone="info">The next step has a couple of quick questions first — your answers make the story more accurate.</Note>
      ) : null}
    </div>
  )
}
