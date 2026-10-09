'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog } from '../../../_components/kit'
import type { FixAction } from './change/change-route'

/**
 * Fix-a-Scene — edit ONE scene of a slide-deck video without redoing the whole
 * thing. Three fixes: re-record (glitch, FREE), edit the narration text (content
 * change, costs credits), fix a pronunciation (FREE). The user can find the
 * scene by CLICKING it or by DESCRIBING the problem (the AI matches it). New VO
 * can be PREVIEWED (free) before committing the re-render.
 *
 * Opened from the "Ask for a change" bar, which can hand it a starting point:
 * the scene (This scene), the kind of fix (the suggestion chip) and the words
 * typed in the bar — or, for "Whole video", the description to find the scene
 * by. Undo opens it on a scene with the old words filled in.
 *
 * Data: reads the persisted plan (slide_plan_url) for each scene's id + narration
 * + label; falls back to the video.script labels if the plan isn't available.
 */
type Scene = { id: number | string; index: number; label: string; narration: string; thumb?: string; startSec?: number }

export type FixStart = {
  sceneIndex?: number
  action?: FixAction
  /** For a wording change: the new words, or what to change. */
  text?: string
  /** "Whole video": find the scene from this description. */
  describe?: string
  /** This opening is an Undo — the button says so. */
  undo?: boolean
}

/** What was applied, so the change list can offer Undo for wording changes. */
export type FixApplied = { action: FixAction; sceneIndex: number; sceneLabel: string; oldText: string; newText?: string }

type Props = {
  videoId: string
  planUrl?: string | null
  slideUrls?: string[]
  script?: { title?: string; headline?: string }[]
  sceneFixCost: number
  start?: FixStart
  onClose: () => void
  onStarted: (applied: FixApplied) => void
}

export default function FixScene({ videoId, planUrl, slideUrls = [], script = [], sceneFixCost, start, onClose, onStarted }: Props) {
  const [scenes, setScenes] = useState<Scene[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Scene | null>(null)
  const [mode, setMode] = useState<'pick' | 'fix'>('pick')
  const [action, setAction] = useState<FixAction>('rerecord')
  const [editText, setEditText] = useState('')
  const [pronWord, setPronWord] = useState('')
  const [pronSay, setPronSay] = useState('')
  const [describe, setDescribe] = useState(start?.describe ?? '')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState<'' | 'preview' | 'commit'>('')
  const [error, setError] = useState('')
  const started = useRef(false)

  // load scenes from the persisted plan (has narration); else from script labels.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (planUrl) {
          const r = await fetch(planUrl, { signal: AbortSignal.timeout(15000) })
          if (r.ok) {
            const saved = await r.json()
            const meta = saved.sceneMeta || []
            const list: Scene[] = (saved.plan?.scenes || []).map((s: any, i: number) => ({
              id: s.id, index: i,
              label: meta[i]?.label || script[i]?.title || `Scene ${i + 1}`,
              narration: s.narration || '',
              thumb: slideUrls[i], startSec: meta[i]?.startSec,
            }))
            if (!cancelled && list.length) { setScenes(list); setLoading(false); return }
          }
        }
      } catch { /* fall through to script */ }
      if (!cancelled) {
        // fallback: labels only (no narration → edit-text disabled, rerecord still works)
        const list: Scene[] = script.map((s, i) => ({ id: i, index: i, label: s.title || `Scene ${i + 1}`, narration: '', thumb: slideUrls[i] }))
        setScenes(list); setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [planUrl])

  // The bar's starting point, applied once the scenes are in.
  useEffect(() => {
    if (loading || started.current || !start) return
    started.current = true
    if (start.sceneIndex != null && scenes[start.sceneIndex]) {
      const s = scenes[start.sceneIndex]
      pick(s, start.action, start.text)
    } else if (start.describe) {
      findByDescription(start.describe, start.action, start.text)
    }
  }, [loading, scenes, start])

  // "describe the problem" → find the best-matching scene by narration/label.
  function findByDescription(text = describe, withAction?: FixAction, withText?: string) {
    const q = text.toLowerCase().trim()
    if (!q) return
    const words = q.split(/\s+/).filter((w) => w.length > 2)
    let best: Scene | null = null, bestScore = 0
    for (const s of scenes) {
      const hay = (s.label + ' ' + s.narration).toLowerCase()
      let score = 0
      for (const w of words) if (hay.includes(w)) score++
      if (score > bestScore) { bestScore = score; best = s }
    }
    if (best) { pick(best, withAction, withText) } else { setError('Couldn’t find that scene — try clicking it from the list.') }
  }

  function pick(s: Scene, withAction?: FixAction, withText?: string) {
    const a: FixAction = withAction === 'edit-text' && !s.narration ? 'rerecord' : (withAction ?? 'rerecord')
    setSelected(s); setMode('fix'); setAction(a)
    setEditText(a === 'edit-text' && withText?.trim() ? withText : s.narration)
    setPreviewUrl(null); setError('')
  }

  async function callFix(previewOnly: boolean) {
    if (!selected) return
    setError(''); setBusy(previewOnly ? 'preview' : 'commit')
    try {
      const body: any = { videoId, sceneId: selected.id, action, previewOnly }
      if (action === 'edit-text') body.newText = editText
      if (action === 'fix-pronunciation' && pronWord && pronSay) body.pronounce = { word: pronWord, say: pronSay }
      const r = await fetch('/api/fix-scene', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Something went wrong.'); setBusy(''); return }
      if (previewOnly) {
        // poll the video row for scene_preview_url (the render service writes it when the clip is ready)
        setBusy('preview')
        for (let i = 0; i < 30; i++) {
          await new Promise((res) => setTimeout(res, 2000))
          const pr = await fetch(`/api/videos/${videoId}/preview-vo`).then((x) => x.ok ? x.json() : null).catch(() => null)
          if (pr?.url) { setPreviewUrl(pr.url + '?t=' + Date.now()); break }
        }
        setBusy('')
      } else {
        // the video row is now 'processing'; the page follows it from here
        onStarted({ action, sceneIndex: selected.index, sceneLabel: selected.label, oldText: selected.narration, newText: action === 'edit-text' ? editText : undefined })
      }
    } catch { setError('Network error — please try again.'); setBusy('') }
  }

  const willCharge = action === 'edit-text'
  const textChanged = action === 'edit-text' && selected && editText.trim() !== selected.narration.trim()

  return (
    <Dialog
      open
      onClose={onClose}
      title={start?.undo ? 'Undo a change' : 'Fix a scene'}
      sub={<>Fix one scene without redoing the whole video. Re-recording a glitch or fixing a pronunciation is <b>free</b> — you’re only charged ({sceneFixCost} credits) if you change the wording.</>}
    >
      {loading ? <div className="res-center">Loading scenes…</div> : mode === 'pick' ? (
        <>
          {/* Describe-the-problem finder */}
          <div className="fix-find">
            <label htmlFor="fix-describe" className="fix-label">Describe the problem and we’ll find the scene:</label>
            <div className="fix-row">
              <input id="fix-describe" className="input" value={describe} onChange={(e) => setDescribe(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && findByDescription()}
                placeholder="e.g. the voice glitched on the growth rate part" />
              <button type="button" className="kit-btn kit-btn--primary kit-btn--sm" onClick={() => findByDescription()}>Find</button>
            </div>
          </div>
          {error && <div className="fix-error">{error}</div>}
          {/* Or pick from the list */}
          <div className="fix-eyebrow">Or pick a scene</div>
          <div className="fix-list">
            {scenes.map((s) => (
              <button key={s.index} type="button" onClick={() => pick(s, start?.action, start?.text)} className="fix-scene">
                {s.thumb ? <img src={s.thumb} alt="" className="fix-thumb" loading="lazy" decoding="async" /> : <div className="fix-thumb fix-thumb--empty">{s.index + 1}</div>}
                <div style={{ minWidth: 0 }}>
                  <div className="fix-scene-title">{s.index + 1}. {s.label}</div>
                  {s.narration ? <div className="fix-scene-words">{s.narration}</div> : null}
                </div>
              </button>
            ))}
          </div>
        </>
      ) : selected ? (
        <>
          {/* Chosen scene */}
          <button type="button" onClick={() => { setMode('pick'); setSelected(null) }} className="rts-link rts-link--small">← Choose a different scene</button>
          <div className="fix-chosen">
            {selected.thumb ? <img src={selected.thumb} alt="" className="fix-thumb fix-thumb--big" /> : null}
            <div><div className="fix-scene-title">{selected.index + 1}. {selected.label}</div>
              <div className="fix-scene-words fix-scene-words--full">“{selected.narration}”</div></div>
          </div>

          {/* Fix type */}
          <div className="fix-kinds" role="radiogroup" aria-label="Kind of fix">
            {([['rerecord', 'Re-record (glitch)', 'Free'], ['edit-text', 'Edit the wording', `${sceneFixCost} cr`], ['fix-pronunciation', 'Fix a pronunciation', 'Free']] as const).map(([a, label, tag]) => (
              <button key={a} type="button" role="radio" aria-checked={action === a} onClick={() => setAction(a)} disabled={a === 'edit-text' && !selected.narration}
                className={`fix-kind${action === a ? ' on' : ''}`}>
                {label} <span className={tag === 'Free' ? 'fix-free' : 'fix-cost'}>· {tag}</span>
              </button>
            ))}
          </div>

          {action === 'edit-text' && (
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="fix-words" className="fix-label">What should this scene say?</label>
              <textarea id="fix-words" className="input" value={editText} onChange={(e) => setEditText(e.target.value)} rows={3}
                placeholder="Rewrite the wording, or tell us what to change — e.g. “add the word ICHRA to the headline” or paste the new script for this scene." />
              <div className="res-hint">
                This updates both the <b>on-screen text</b> and the <b>voiceover</b> for this scene, then re-renders it.
              </div>
            </div>
          )}
          {action === 'fix-pronunciation' && (
            <div className="fix-row" style={{ marginBottom: 16 }}>
              <input className="input" aria-label="Word" value={pronWord} onChange={(e) => setPronWord(e.target.value)} placeholder="Word (e.g. Reg FD)" />
              <input className="input" aria-label="Say it like" value={pronSay} onChange={(e) => setPronSay(e.target.value)} placeholder="Say it like (e.g. Regulation F D)" />
            </div>
          )}

          {previewUrl && (
            <div className="fix-preview">
              <div className="fix-label">Preview the new voiceover:</div>
              <audio controls src={previewUrl} style={{ width: '100%' }} />
            </div>
          )}
          {error && <div className="fix-error">{error}</div>}

          {/* Actions */}
          <div className="fix-actions">
            <button type="button" onClick={() => callFix(true)} disabled={!!busy} className="kit-btn kit-btn--secondary">
              {busy === 'preview' ? 'Generating preview…' : '▶ Preview new voiceover (free)'}
            </button>
            <button type="button" onClick={() => callFix(false)} disabled={!!busy || (willCharge && !textChanged)} className="kit-btn kit-btn--primary">
              {busy === 'commit' ? 'Starting…' : willCharge ? `${start?.undo ? 'Put the old words back' : 'Apply edit'} (${sceneFixCost} cr)` : 'Apply fix (free)'}
            </button>
          </div>
          <p className="res-hint">Once applied, the new scene replaces the old one in the video and on your client’s page.</p>
        </>
      ) : null}
    </Dialog>
  )
}
