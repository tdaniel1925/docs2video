'use client'

// THE FREE PREVIEW on step 3 ("The look"). Before paying, the customer can
// see their FIRST CONTENT scene as a still picture in the look they picked,
// and hear ~10 seconds of the voice reading it. 3 a day per account; it never
// spends credits (app/api/preview-first-scene).
//
// Two parts, because the button lives in the bottom bar (next to Make it)
// and the picture lives on the page:
//   useFirstScenePreview(...)  — the state and the one call that makes it
//   <FirstScenePreview preview={…} />  — the picture, the voice and any note
// Pass the choices on screen (output, look, voiceId) so the preview shows
// what is picked right now, and so "Preview again" appears when the look or
// voice changes after a preview.

import { forwardRef, useEffect, useRef, useState } from 'react'
import { Note } from '../../../../_components/kit'
import { CAP_REACHED_MESSAGE, previewsLeftLabel } from '../../../../_lib/first-scene-preview'
import s from './FirstScenePreview.module.css'

type Choice = { output?: string; look?: string; voiceId?: string; /** Drawn slides only: 3d / illustrated / classic. */ drawStyle?: string }
type Result = {
  imageUrl: string
  audioUrl: string | null
  voiceNote: string | null
  lookNote: string | null
  sceneTitle?: string
  choice: Choice
}

export type FirstScenePreviewState = ReturnType<typeof useFirstScenePreview>

export function useFirstScenePreview({ videoId, output, look, voiceId, drawStyle }: { videoId: string } & Choice) {
  const [left, setLeft] = useState<number | null | undefined>(undefined) // undefined = still loading; null = no limit
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<{ message: string; cap?: boolean } | null>(null)
  const inFlight = useRef(false)

  // How many are left today, for the line under the button.
  useEffect(() => {
    let alive = true
    fetch('/api/preview-first-scene')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d && 'remainingToday' in d) setLeft(d.remainingToday) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  // The look or voice on screen differs from what the picture shows.
  const changed = !!result && (
    (look !== undefined && look !== result.choice.look) ||
    (voiceId !== undefined && voiceId !== result.choice.voiceId) ||
    (output !== undefined && output !== result.choice.output) ||
    (drawStyle ?? null) !== (result.choice.drawStyle ?? null)
  )

  async function make() {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/preview-first-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, output, look, voiceId, drawStyle }),
      })
      const d = await res.json().catch(() => ({}))
      if ('remainingToday' in d) setLeft(d.remainingToday)
      if (!res.ok) {
        setError({ message: d.error || 'We couldn’t make the preview just now. Please try again.', cap: d.code === 'preview_cap' })
        return
      }
      setResult({ imageUrl: d.imageUrl, audioUrl: d.audioUrl, voiceNote: d.voiceNote, lookNote: d.lookNote, sceneTitle: d.sceneTitle, choice: d.choice ?? { output, look, voiceId, drawStyle } })
    } catch {
      setError({ message: 'Connection lost. Please check your internet and try again.' })
    } finally {
      setBusy(false)
      inFlight.current = false
    }
  }

  const noneLeft = left === 0
  return {
    left, busy, result, error, changed, noneLeft, make,
    /** The words for the bar button. */
    label: busy ? 'Making your preview…' : result && changed ? 'Preview again' : 'Free preview',
    /** Why the bar button can't be pressed (none left today). */
    disabledReason: noneLeft && !busy ? CAP_REACHED_MESSAGE : undefined,
    /** "3 free previews left today" (null when unknown or unlimited). */
    leftLabel: left !== undefined && !noneLeft ? previewsLeftLabel(left) : null,
    /** Nothing to make again: the picture already shows these choices. */
    upToDate: !!result && !changed,
  }
}

/** The picture of the first scene and the voice reading it. Shows nothing
 *  until a preview is asked for. */
const FirstScenePreview = forwardRef<HTMLElement, { preview: FirstScenePreviewState }>(function FirstScenePreview({ preview }, ref) {
  const { busy, result, error, changed } = preview
  if (!busy && !result && !error) return null
  return (
    <section ref={ref} className={`cf-card ${s.box}`} aria-label="Free preview">
      <div className={s.head}>
        <div>
          <h3 className={s.title}>Your free preview</h3>
          <p className={s.lead}>Your first scene in this look, and the voice reading it. Nothing is charged.</p>
        </div>
        {preview.leftLabel ? <p className={s.left}>{preview.leftLabel}</p> : null}
      </div>

      {busy && (
        <p className={s.waiting} role="status"><span className="spinner" aria-hidden="true" /> Drawing your first scene and recording the voice — about 15 seconds.</p>
      )}

      {error && (
        <Note tone={error.cap ? 'info' : 'warn'}>{error.message}</Note>
      )}

      {result && !busy && (
        <>
          {changed && <p className={s.changed}>You changed the look or voice — press Preview again to see it.</p>}
          {/* eslint-disable-next-line @next/next/no-img-element -- a stored PNG, shown as is */}
          <img className={s.still} src={result.imageUrl} alt={result.sceneTitle ? `Preview of your first scene: ${result.sceneTitle}` : 'Preview of your first scene'} />
          {result.lookNote && <p className={s.caption}>{result.lookNote}</p>}
          {result.audioUrl
            ? <audio className={s.audio} controls preload="none" src={result.audioUrl} aria-label="The voice reading your first scene" />
            : <p className={s.caption}>Slide decks have no voice.</p>}
          {result.voiceNote && <p className={s.caption}>{result.voiceNote}</p>}
        </>
      )}
    </section>
  )
})

export default FirstScenePreview
