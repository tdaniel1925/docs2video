'use client'

import { useEffect, useState } from 'react'
import { sizedPicture } from '../../../../_lib/picture-size'
import { useRouter } from 'next/navigation'
import type { Video } from '../../../../_lib/types'
import { Dialog } from '../../../../_components/kit'
import { changeRouteFor, presentationEditorHref, type ChangeScope, type FixAction, type Suggestion } from './change-route'
import { readChanges, undoOf, type ChangeEntry } from './change-log'
import { thingWord } from '../result/output'

export interface SceneInfo {
  label: string
  thumb?: string
  /** Seconds from the start, when known (videos). */
  start?: number
}

/** What the page should open for a request. */
export type ChangeRequest =
  | { editor: 'fix-scene'; sceneIndex?: number; describe?: string; action?: FixAction; text?: string }
  | { editor: 'older-editor'; sceneIndex?: number }

function clock(t: number | undefined) {
  if (t == null || !Number.isFinite(t) || t < 0) return null
  return `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}`
}

/**
 * "ASK FOR A CHANGE" — one bar for every kind of project.
 *
 * Pick "This scene" or the whole thing, type what you want (or press a
 * suggestion), and the bar hands it to the editor that already exists for
 * this project (change-route.ts says which and why). The cost line comes from
 * credits.ts. Changes you make are listed underneath with Undo where there is
 * something to put back (change-log.ts).
 *
 * The scene list doubles as the old chapter buttons: picking a scene also
 * jumps the player above to it.
 */
export default function ChangeBar({ video, scenes, selectedScene, onPickScene, onRequest, changesVersion, onUndo }: {
  video: Video
  scenes: SceneInfo[]
  selectedScene: number
  onPickScene: (i: number) => void
  onRequest: (r: ChangeRequest) => void
  /** Bumped by the page when a change is recorded, so the list re-reads. */
  changesVersion: number
  onUndo: (c: ChangeEntry) => void
}) {
  const router = useRouter()
  const route = changeRouteFor(video)
  const thing = thingWord(video)
  const wholeWord = thing === 'presentation' ? 'Whole presentation' : 'Whole video'
  const [scope, setScope] = useState<ChangeScope>(route.scopes.includes('scene') && scenes.length > 0 ? 'scene' : 'whole')
  const [text, setText] = useState('')
  const [chip, setChip] = useState<Suggestion | null>(null)
  const [error, setError] = useState('')
  const [enlarge, setEnlarge] = useState<number | null>(null)
  const [changes, setChanges] = useState<ChangeEntry[]>([])
  useEffect(() => { setChanges(readChanges(video.id)) }, [video.id, changesVersion])

  const fixChip = route.editor === 'fix-scene' ? (chip?.fix ?? null) : null
  const credits = chip?.credits
  const sceneLabel = scenes[selectedScene]?.label ?? `Scene ${selectedScene + 1}`

  function choose(s: Suggestion) {
    setError('')
    if (route.editor === 'fix-scene') { setChip(chip?.label === s.label ? null : s); return }
    // The scene editor does all of these on one screen — open it.
    if (route.editor === 'older-editor') { onRequest({ editor: 'older-editor', sceneIndex: scope === 'scene' ? selectedScene : undefined }); return }
    setChip(s)
    if (s.text) setText((prev) => (prev.trim() ? `${prev.trim()} ${s.text}` : s.text!))
  }

  function go() {
    setError('')
    const sceneIndex = scope === 'scene' ? selectedScene : undefined
    if (route.editor === 'presentation-editor') {
      if (!text.trim()) { setError('Say what you’d like changed first.'); return }
      router.push(presentationEditorHref(video.id, text, scope, selectedScene))
      return
    }
    if (route.editor === 'fix-scene') {
      if (scope === 'whole' && !text.trim()) { setError('Describe what’s wrong so we can find the scene — or pick “This scene”.'); return }
      const action: FixAction = fixChip ?? (text.trim() ? 'edit-text' : 'rerecord')
      onRequest({
        editor: 'fix-scene',
        sceneIndex,
        describe: scope === 'whole' ? text.trim() : undefined,
        action,
        text: action === 'edit-text' ? text.trim() : undefined,
      })
      return
    }
    if (route.editor === 'older-editor') {
      onRequest({ editor: 'older-editor', sceneIndex })
      return
    }
    router.push(`/create?duplicate=${video.id}`)
  }

  const placeholder = route.editor === 'presentation-editor'
    ? (scope === 'scene' ? `e.g. “Make this slide’s headline shorter”` : `e.g. “Add a slide about our guarantee”`)
    : route.editor === 'fix-scene'
      ? (scope === 'scene' ? 'e.g. “Say 3% instead of 3.5%” — or leave it empty and pick a fix above' : 'e.g. “the voice glitched on the growth rate part”')
      : ''

  return (
    <section className="res-card" aria-label="Ask for a change" data-editor={route.editor}>
      <h2 className="res-h2">Ask for a change</h2>
      <p className="res-hint">{route.costLine}</p>

      {route.scopes.length > 1 && (
        <div className="res-scope" role="radiogroup" aria-label="What to change">
          {route.scopes.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={scope === s}
              className={`res-scope-btn${scope === s ? ' on' : ''}`}
              disabled={s === 'scene' && scenes.length === 0}
              onClick={() => { setScope(s); setError('') }}
            >
              {s === 'scene' ? (thing === 'presentation' ? 'This slide' : 'This scene') : wholeWord}
            </button>
          ))}
        </div>
      )}

      {scope === 'scene' && scenes.length > 0 && (
        <div className="res-scenes" role="listbox" aria-label={thing === 'presentation' ? 'Slides' : 'Scenes'}>
          {scenes.map((s, i) => (
            <div key={i} className={`res-scene${i === selectedScene ? ' on' : ''}`}>
              <button type="button" role="option" aria-selected={i === selectedScene} className="res-scene-pick" onClick={() => onPickScene(i)}>
                {s.thumb && <img src={sizedPicture(s.thumb, 320) ?? s.thumb} alt="" className="res-scene-thumb" width={160} height={90} loading="lazy" decoding="async" fetchPriority="low" onError={(e) => { if (e.currentTarget.src !== s.thumb) e.currentTarget.src = s.thumb! }} />}
                <span className="res-scene-text">
                  {clock(s.start) && <span className="res-scene-time">{clock(s.start)}</span>}
                  <span className="res-scene-label">{i + 1}. {s.label}</span>
                </span>
              </button>
              {s.thumb && (
                <button type="button" className="res-scene-zoom" aria-label={`Enlarge ${s.label}`} onClick={() => setEnlarge(i)}>⤢</button>
              )}
            </div>
          ))}
        </div>
      )}

      {route.suggestions.length > 0 && (
        <div className="res-suggest" aria-label="Suggestions">
          {route.suggestions.map((s) => (
            <button
              key={s.label}
              type="button"
              className={`res-suggest-chip${chip?.label === s.label && route.editor === 'fix-scene' ? ' on' : ''}`}
              aria-pressed={route.editor === 'fix-scene' ? chip?.label === s.label : undefined}
              onClick={() => choose(s)}
            >
              {s.label}
              {s.credits != null && <span className={s.credits === 0 ? 'res-free' : 'res-cost'}>{s.credits === 0 ? 'Free' : `${s.credits.toLocaleString('en-US')} credits`}</span>}
            </button>
          ))}
        </div>
      )}

      {route.takesText && (
        <>
          <label htmlFor="res-change-text" className="kit-sr">What would you like changed?</label>
          <textarea
            id="res-change-text"
            className="input res-change-text"
            rows={2}
            maxLength={500}
            placeholder={placeholder}
            value={text}
            onChange={(e) => { setText(e.target.value); setError('') }}
          />
        </>
      )}

      {error && <div role="alert" className="rts-error">{error}</div>}

      <div className="res-change-go">
        <button type="button" className="kit-btn kit-btn--primary" onClick={go} disabled={video.status !== 'completed'}>
          <span className="kit-btn-label">
            {route.editor === 'fix-scene' && scope === 'scene' ? `Fix scene ${selectedScene + 1}` : route.button}
          </span>
          {credits != null && <span className="kit-btn-price">— {credits === 0 ? 'free' : `${credits.toLocaleString('en-US')} credits`}</span>}
        </button>
        {scope === 'scene' && scenes.length > 0 && route.editor !== 'remake' && (
          <span className="res-hint">For: {selectedScene + 1}. {sceneLabel}</span>
        )}
      </div>

      {changes.length > 0 && (
        <div className="res-changes">
          <div className="rts-eyebrow">Your changes</div>
          <ul>
            {changes.map((c) => {
              const u = undoOf(c)
              return (
                <li key={c.id} className="res-change-row">
                  <span className="res-change-what">
                    {c.summary}
                    <span className="res-hint"> · {new Date(c.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                  </span>
                  {u.can
                    ? <button type="button" className="kit-btn kit-btn--secondary kit-btn--sm" onClick={() => onUndo(c)}>{u.label}</button>
                    : <span className="res-hint">{u.why}</span>}
                </li>
              )
            })}
          </ul>
          <p className="res-hint">Listed on this computer only.</p>
        </div>
      )}

      <Dialog
        open={enlarge !== null && !!scenes[enlarge ?? -1]?.thumb}
        onClose={() => setEnlarge(null)}
        title={enlarge !== null ? `${enlarge + 1}. ${scenes[enlarge]?.label ?? ''}` : ''}
        footer={enlarge !== null ? (
          <>
            <button type="button" className="kit-btn kit-btn--secondary kit-btn--sm" disabled={enlarge === 0} onClick={() => setEnlarge(Math.max(0, enlarge - 1))}>← Previous</button>
            <button type="button" className="kit-btn kit-btn--secondary kit-btn--sm" disabled={enlarge >= scenes.length - 1 || !scenes[enlarge + 1]?.thumb} onClick={() => setEnlarge(Math.min(scenes.length - 1, enlarge + 1))}>Next →</button>
          </>
        ) : null}
      >
        {enlarge !== null && scenes[enlarge]?.thumb && <img src={scenes[enlarge].thumb} alt={scenes[enlarge].label} className="res-zoom-img" />}
      </Dialog>
    </section>
  )
}
