'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/*
 * THE STORYBOARD on step 5 (film engine on; app/_lib/storyboard.ts): under each content scene, the still frame the
 * film engine will draw, and the words on screen, editable. The words the voice says stay in the scene's own editor.
 * Owner rules: a still, never a clip; no motion or timing controls; no changing how a scene is shown.
 */
export type BoardField = { path: string; label: string; value: string }
export type BoardScene = { key: string; type: string; title: string; narration: string; fields: BoardField[]; edited: boolean; checks: { text: string; found: boolean }[]; frame: string | null }

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
    const next = board.find((s) => !frames[s.key] && !drawing.current.has(s.key))
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

  const contentNarr = storyScenes.filter((s) => s._role !== 'cover' && s._role !== 'closing').map((s) => norm(s.narration))
  const stale = state === 'ready' && (contentNarr.length !== board.length || contentNarr.some((n) => !board.some((b) => norm(b.narration) === n)))
  const forScene = (narration: unknown) => board.find((b) => norm(b.narration) === norm(narration)) ?? null
  return { state, note, stale, plan, forScene, frames, saveWords }
}

/** One scene's storyboard: its frame, what it is, and its words on screen (editable). */
export function StoryboardScene({ scene, frame, onSave }: { scene: BoardScene | null; frame: string | undefined; onSave: (edits: Record<string, string>) => Promise<string[] | null> }) {
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [issues, setIssues] = useState<string[] | null>(null)
  if (!scene) return <p className="cf-hint" style={{ margin: '4px 0 0' }}>This scene’s words changed. Press <b>Update the storyboard</b> to see it again.</p>
  const dirty = Object.keys(draft).some((k) => draft[k] !== (scene.fields.find((f) => f.path === k)?.value ?? ''))
  const save = async () => {
    setSaving(true); setIssues(null)
    const bad = await onSave(draft)
    setSaving(false)
    if (bad) setIssues(bad); else setDraft({})
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, padding: '12px 0 4px' }}>
      <div style={{ flex: '0 1 380px', minWidth: 240 }}>
        <div style={{ position: 'relative', aspectRatio: '16 / 9', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          {frame && frame !== 'none'
            // eslint-disable-next-line @next/next/no-img-element -- a picture the render service drew
            ? <img src={frame} alt={`How this scene will look: ${TYPE_NAME[scene.type] ?? scene.type}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--ink-light)', fontSize: 'var(--fs-caption)' }}>{frame === 'none' ? 'Picture not ready. Your words are saved.' : 'Drawing this scene…'}</div>}
        </div>
      </div>
      <div style={{ flex: '999 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span className="kit-chip" style={{ fontSize: 'var(--fs-caption)', fontWeight: 700 }}>{TYPE_NAME[scene.type] ?? scene.type}</span>
          {scene.checks.map((c, i) => (
            <span key={i} style={{ fontSize: 'var(--fs-caption)', fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: c.found ? 'var(--success-bg)' : 'var(--warning-bg)', color: c.found ? 'var(--success)' : 'var(--warning-text)' }}>
              {c.found ? `✓ ${c.text} is in your document` : `${c.text} isn’t in your document`}
            </span>
          ))}
        </div>
        <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>On screen</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {scene.fields.map((f) => (
            <label key={f.path} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--fs-caption)', color: 'var(--ink-light)' }}>
              {f.label}
              <input className="cf-input" value={draft[f.path] ?? f.value} maxLength={160}
                onChange={(e) => setDraft((d) => ({ ...d, [f.path]: e.target.value }))} />
            </label>
          ))}
        </div>
        {issues ? <div role="alert" className="kit-note kit-note--warn"><div className="kit-note-body"><p>{issues.join(' ')}</p></div></div> : null}
        {dirty ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="kit-btn kit-btn--primary kit-btn--sm" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save the words on screen'}</button>
            <button type="button" className="kit-btn kit-btn--secondary kit-btn--sm" onClick={() => { setDraft({}); setIssues(null) }} disabled={saving}>Undo</button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
