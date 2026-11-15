'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import dynamic from 'next/dynamic'
import { parseFigure, type KitPlan, type KitScene } from '../../../../../remotion/src/kit/spec'

/*
 * THE STORYBOARD on step 5 (film engine on; app/_lib/storyboard.ts): under each content scene, the still frame the
 * film engine will draw, as a compact grid; "Change" opens one scene's editor (what the voice says, words on screen).
 * Owner rules: a still, never a clip; no motion or timing controls; no changing how a scene is shown.
 */
export type BoardField = { path: string; label: string; value: string }
export type BoardScene = { key: string; type: string; title: string; narration: string; fields: BoardField[]; edited: boolean; checks: { text: string; found: boolean }[]; frame: string | null; plan: KitPlan | null }

const TYPE_NAME: Record<string, string> = { title: 'Cover', bignumber: 'Big number', comparison: 'Comparison', timeline: 'Timeline', chart: 'Chart', checklist: 'Checklist', quote: 'Quote', cta: 'Closing' }
const norm = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim()

/** The storyboard for a project: plans it the first time, and again on request after the story changed. */
export function useStoryboard(videoId: string | null, enabled: boolean, storyScenes: { narration?: string; _role?: string }[]) {
  const [board, setBoard] = useState<BoardScene[]>([])
  const [state, setState] = useState<'idle' | 'planning' | 'ready' | 'error'>('idle')
  const [note, setNote] = useState<string | null>(null)
  const [frames, setFrames] = useState<Record<string, string>>({})
  const drawing = useRef(new Set<string>())
  const asked = useRef(false)

  const take = (scenes: BoardScene[]) => {
    setBoard(scenes)
    setFrames((f) => ({ ...f, ...Object.fromEntries(scenes.filter((s) => s.frame).map((s) => [s.key, s.frame as string])) }))
  }
  const plan = useCallback(async () => {
    if (!videoId) return
    setState('planning'); setNote(null)
    try {
      const r = await fetch('/api/storyboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId }) })
      const j = await r.json().catch(() => null)
      if (!r.ok) throw new Error(j?.error || 'We couldn’t make the storyboard just now.')
      take(j.scenes); setState('ready')
    } catch (e) { setNote((e as Error).message); setState('error') }
  }, [videoId])

  useEffect(() => {
    if (!enabled || !videoId || asked.current) return
    asked.current = true
    fetch(`/api/storyboard?videoId=${videoId}`).then((r) => r.json()).then((j) => {
      if (j?.planned) { take(j.scenes); setState('ready') } else void plan()
    }).catch(() => setState('error'))
  }, [enabled, videoId, plan])

  // Frames: drawn one at a time, only for scenes that have none (or whose words on screen changed).
  useEffect(() => {
    if (!videoId || state !== 'ready') return
    const next = board.find((s) => !s.plan && !frames[s.key] && !drawing.current.has(s.key))
    if (!next || drawing.current.size) return
    drawing.current.add(next.key)
    fetch('/api/storyboard/frame', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId, key: next.key }) })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => setFrames((f) => ({ ...f, [next.key]: ok && j?.url ? j.url : 'none' })))
      .catch(() => setFrames((f) => ({ ...f, [next.key]: 'none' })))
      .finally(() => { drawing.current.delete(next.key) })
  }, [videoId, state, board, frames])

  const saveWords = useCallback(async (key: string, edits: Record<string, string>): Promise<string[] | null> => {
    if (!videoId) return null
    const r = await fetch('/api/storyboard', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId, key, edits }) })
    const j = await r.json().catch(() => null)
    if (!r.ok) return Array.isArray(j?.issues) && j.issues.length ? j.issues : [j?.error || 'We couldn’t save those words.']
    setFrames((f) => { const n = { ...f }; delete n[key]; return n }) // the words on screen changed: draw it again
    take(j.scenes)
    return null
  }, [videoId])

  const retryFrame = useCallback((key: string) => setFrames((f) => { const n = { ...f }; delete n[key]; return n }), [])
  const contentNarr = storyScenes.filter((s) => s._role !== 'cover' && s._role !== 'closing').map((s) => norm(s.narration))
  const stale = state === 'ready' && (contentNarr.length !== board.length || contentNarr.some((n) => !board.some((b) => norm(b.narration) === n)))
  const forScene = (narration: unknown) => board.find((b) => norm(b.narration) === norm(narration)) ?? null
  return { state, note, stale, plan, forScene, frames, saveWords, retryFrame }
}

const cap: CSSProperties = { fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }

const waitBox: CSSProperties = { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 8, color: 'var(--ink-light)', fontSize: 'var(--fs-caption)' }
/** The picture drawn in the browser (the real video code, one still frame). Loaded only on the storyboard. */
const Still = dynamic(() => import('./StoryboardStill'), { ssr: false, loading: () => <div style={waitBox}>Drawing this scene…</div> })

/** Every on-screen word change applied to a one-scene plan, so the big picture redraws as you type. */
function withEdits(plan: KitPlan, edits: Record<string, string>): KitPlan {
  if (!Object.keys(edits).length) return plan
  const idx = Math.max(0, plan.scenes.findIndex((s) => s.type !== 'title' && s.type !== 'cta'))
  const scene = JSON.parse(JSON.stringify(plan.scenes[idx])) as KitScene
  for (const [path, raw] of Object.entries(edits)) {
    const text = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 160)
    const keys = path.split('.')
    let o = scene as unknown as Record<string, unknown>
    for (const k of keys.slice(0, -1)) { if (!o[k] || typeof o[k] !== 'object') { o = {}; break } o = o[k] as Record<string, unknown> }
    const last = keys[keys.length - 1]
    if (last === 'figure') { const f = parseFigure(text); if (f) o[last] = f; continue }
    if (path.startsWith('points.') && last === 'value') { const f = parseFigure(text); if (f) o[last] = f.value; continue }
    o[last] = text
  }
  return { ...plan, scenes: plan.scenes.map((s, i) => (i === idx ? scene : s)) }
}

/** The frame itself (16:9): drawn in the browser from the plan; the render service's picture when there is no plan. */
function Frame({ frame, plan, label, onRetry, small }: { frame: string | undefined; plan?: KitPlan | null; label: string; onRetry?: () => void; small?: boolean }) {
  return (
    <div style={{ position: 'relative', aspectRatio: '16 / 9', borderRadius: small ? 8 : 10, overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
      {plan ? <Still plan={plan} label={label} fallback={<div style={waitBox}>We couldn’t draw this picture.</div>} />
        : frame && frame !== 'none'
        // eslint-disable-next-line @next/next/no-img-element -- a picture the render service drew
        ? <img src={frame} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 8, color: 'var(--ink-light)', fontSize: 'var(--fs-caption)' }}>
            {frame === 'none'
              ? <span>We couldn’t draw this picture.{onRetry ? <><br /><button type="button" className="kit-btn kit-btn--secondary kit-btn--sm" style={{ marginTop: 6 }} onClick={(e) => { e.stopPropagation(); onRetry() }}>Try again</button></> : null}</span>
              : 'Drawing this scene…'}
          </div>}
    </div>
  )
}

/** One small card in the storyboard grid. "Change" opens the scene's editor. */
export function StoryboardTile({ n, title, scene, frame, bookend, planning, onOpen, onRetry }: {
  n: number; title: string; scene: BoardScene | null; frame: string | undefined; bookend?: 'cover' | 'closing'; planning: boolean; onOpen: () => void; onRetry: () => void
}) {
  const kind = bookend === 'cover' ? 'Opening' : bookend === 'closing' ? 'Closing' : scene ? (TYPE_NAME[scene.type] ?? scene.type) : planning ? 'Laying out…' : 'Words changed'
  const allFound = !!scene && scene.checks.length > 0 && scene.checks.every((c) => c.found)
  const missing = !!scene && scene.checks.some((c) => !c.found)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      {bookend ? (
        <div style={{ aspectRatio: '16 / 9', borderRadius: 8, border: '1px dashed var(--border-light)', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 10, color: 'var(--ink-light)', fontSize: 'var(--fs-caption)' }}>
          {bookend === 'cover' ? 'Your title, photo and greeting' : 'Your contact details and booking button'}
        </div>
      ) : <Frame small frame={scene ? frame : undefined} plan={scene?.plan} label={'Scene ' + n + ': ' + kind} onRetry={onRetry} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-caption)', color: 'var(--ink-light)', fontWeight: 600 }}>
        <span>{n} · {kind}</span>
        {allFound ? <span title="The numbers on screen are in your document" style={{ color: 'var(--success)' }}>✓</span> : null}
        {missing ? <span title="A number on screen isn’t in your document" style={{ color: 'var(--warning-text)' }}>!</span> : null}
      </div>
      <div style={{ fontWeight: 700, lineHeight: 1.3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{title || 'Untitled scene'}</div>
      <div style={{ marginTop: 'auto' }}>
        {!bookend
          ? <button type="button" className="kit-btn kit-btn--secondary kit-btn--sm" onClick={onOpen} aria-label={'Change scene ' + n}>Change</button>
          : <span className="cf-hint" style={{ margin: 0 }}>Set on the Opener &amp; close step</span>}
      </div>
    </div>
  )
}

/** The editor for one scene (inside a pop-up): the big frame, what the voice says, and the words on screen. */
export function StoryboardEditor({ scene, frame, voice, onSaveWords, onSaveVoice, onRetry, onDone }: {
  scene: BoardScene | null; frame: string | undefined; voice: string
  onSaveWords: (edits: Record<string, string>) => Promise<string[] | null>; onSaveVoice: (text: string) => void; onRetry: () => void; onDone: () => void
}) {
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [said, setSaid] = useState(voice)
  const [saving, setSaving] = useState(false)
  const [issues, setIssues] = useState<string[] | null>(null)
  const wordsDirty = !!scene && Object.keys(draft).some((k) => draft[k] !== (scene.fields.find((f) => f.path === k)?.value ?? ''))
  const voiceDirty = norm(said) !== norm(voice)
  const livePlan = useMemo(() => (scene && scene.plan ? withEdits(scene.plan, draft) : null), [scene, draft])
  const save = async () => {
    setSaving(true); setIssues(null)
    const bad = wordsDirty ? await onSaveWords(draft) : null
    setSaving(false)
    if (bad) { setIssues(bad); return }
    if (voiceDirty) onSaveVoice(said.trim())
    onDone()
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {scene ? <Frame frame={frame} plan={livePlan} label={'How this scene will look: ' + (TYPE_NAME[scene.type] ?? scene.type)} onRetry={onRetry} /> : null}
      {scene && scene.checks.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {scene.checks.map((c, i) => (
            <span key={i} style={{ fontSize: 'var(--fs-caption)', fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: c.found ? 'var(--success-bg)' : 'var(--warning-bg)', color: c.found ? 'var(--success)' : 'var(--warning-text)' }}>
              {c.found ? '✓ ' + c.text + ' is in your document' : c.text + ' isn’t in your document'}
            </span>
          ))}
        </div>
      ) : null}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={cap}>The voice says</span>
        <textarea className="cf-input" rows={4} value={said} onChange={(e) => setSaid(e.target.value)} style={{ resize: 'vertical', lineHeight: 1.5 }} />
      </label>
      {scene && scene.fields.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={cap}>On screen</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {scene.fields.map((f) => (
              <label key={f.path} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--fs-caption)', color: 'var(--ink-light)' }}>
                {f.label}
                <input className="cf-input" value={draft[f.path] ?? f.value} maxLength={160} onChange={(e) => setDraft((d) => ({ ...d, [f.path]: e.target.value }))} />
              </label>
            ))}
          </div>
        </div>
      ) : null}
      {voiceDirty ? <p className="cf-hint" style={{ margin: 0 }}>When you save, this scene is laid out again to match the new words.</p> : null}
      {issues ? <div role="alert" className="kit-note kit-note--warn"><div className="kit-note-body"><p>{issues.join(' ')}</p></div></div> : null}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="kit-btn kit-btn--secondary kit-btn--sm" onClick={onDone} disabled={saving}>Cancel</button>
        <button type="button" className="kit-btn kit-btn--primary kit-btn--sm" onClick={() => void save()} disabled={saving || (!wordsDirty && !voiceDirty)}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  )
}
