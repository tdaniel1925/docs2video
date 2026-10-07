'use client'

// THE FREE PREVIEW on step 3 ("Make it yours"). Before paying, the customer
// can see their FIRST CONTENT scene as a still picture in the look they
// picked, and hear ~10 seconds of the voice reading it. 3 a day per account;
// it never spends credits (app/api/preview-first-scene).
//
// Mount with just the project id — the preview then uses the choices saved on
// the draft. Pass the choices on screen too (output, look, voiceId) so the
// preview shows what is picked right now, and so "Preview again" appears when
// the look or voice changes after a preview.

import { useEffect, useRef, useState } from 'react'
import { Button, Note } from '../../../../_components/kit'
import { CAP_REACHED_MESSAGE, previewsLeftLabel } from '../../../../_lib/first-scene-preview'
import s from './FirstScenePreview.module.css'

type Choice = { output?: string; look?: string; voiceId?: string }
type Result = {
  imageUrl: string
  audioUrl: string | null
  voiceNote: string | null
  lookNote: string | null
  sceneTitle?: string
  choice: Choice
}

export default function FirstScenePreview({ videoId, output, look, voiceId }: { videoId: string } & Choice) {
  const [left, setLeft] = useState<number | null | undefined>(undefined) // undefined = still loading; null = no limit
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<{ message: string; cap?: boolean } | null>(null)
  const inFlight = useRef(false)

  // How many are left today, for the label under the button.
  useEffect(() => {
    let alive = true
    fetch('/api/preview-first-scene')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d && 'remainingToday' in d) setLeft(d.remainingToday) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const passedChoice = output !== undefined || look !== undefined || voiceId !== undefined
  // The look or voice on screen differs from what the picture shows.
  const changed = !!result && passedChoice && (
    (look !== undefined && look !== result.choice.look) ||
    (voiceId !== undefined && voiceId !== result.choice.voiceId) ||
    (output !== undefined && output !== result.choice.output)
  )

  async function makePreview() {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/preview-first-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, output, look, voiceId }),
      })
      const d = await res.json().catch(() => ({}))
      if ('remainingToday' in d) setLeft(d.remainingToday)
      if (!res.ok) {
        setError({ message: d.error || 'We couldn’t make the preview just now. Please try again.', cap: d.code === 'preview_cap' })
        return
      }
      setResult({ imageUrl: d.imageUrl, audioUrl: d.audioUrl, voiceNote: d.voiceNote, lookNote: d.lookNote, sceneTitle: d.sceneTitle, choice: d.choice ?? { output, look, voiceId } })
    } catch {
      setError({ message: 'Connection lost. Please check your internet and try again.' })
    } finally {
      setBusy(false)
      inFlight.current = false
    }
  }

  const noneLeft = left === 0
  // Without the choices passed in we can't tell what changed — offer it anyway
  // (an unchanged preview comes back from storage and isn't counted).
  const showButton = !result || changed || !passedChoice

  return (
    <section className={s.box} aria-label="Free preview">
      <div className={s.head}>
        <div>
          <h3 className={s.title}>See it before you pay</h3>
          <p className={s.lead}>A picture of your first scene in this look, and the voice reading it. Free.</p>
        </div>
        {showButton && (
          <div>
            <Button
              variant="secondary"
              onClick={makePreview}
              disabled={busy || noneLeft}
              disabledReason={noneLeft && !busy ? CAP_REACHED_MESSAGE : undefined}
            >
              {busy ? 'Making your preview…' : result ? 'Preview again' : 'See a free preview'}
            </Button>
            {left !== undefined && !noneLeft && <p className={s.left}>{previewsLeftLabel(left)}</p>}
          </div>
        )}
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
}
