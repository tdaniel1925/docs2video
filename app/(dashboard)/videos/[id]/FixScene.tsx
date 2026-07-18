'use client'

import { useEffect, useState } from 'react'

/**
 * Fix-a-Scene — edit ONE scene of a slide-deck video without redoing the whole
 * thing. Three fixes: re-record (glitch, FREE), edit the narration text (content
 * change, costs credits), fix a pronunciation (FREE). The user can find the
 * scene by CLICKING it or by DESCRIBING the problem (the AI matches it). New VO
 * can be PREVIEWED (free) before committing the re-render.
 *
 * Data: reads the persisted plan (slide_plan_url) for each scene's id + narration
 * + label; falls back to the video.script labels if the plan isn't available.
 */
type Scene = { id: number | string; index: number; label: string; narration: string; thumb?: string; startSec?: number }
type Props = { videoId: string; planUrl?: string | null; slideUrls?: string[]; script?: { title?: string; headline?: string }[]; sceneFixCost: number; onClose: () => void; onStarted: () => void }

export default function FixScene({ videoId, planUrl, slideUrls = [], script = [], sceneFixCost, onClose, onStarted }: Props) {
  const [scenes, setScenes] = useState<Scene[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Scene | null>(null)
  const [mode, setMode] = useState<'pick' | 'fix'>('pick')
  const [action, setAction] = useState<'rerecord' | 'edit-text' | 'fix-pronunciation'>('rerecord')
  const [editText, setEditText] = useState('')
  const [pronWord, setPronWord] = useState('')
  const [pronSay, setPronSay] = useState('')
  const [describe, setDescribe] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState<'' | 'preview' | 'commit'>('')
  const [error, setError] = useState('')

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

  // "describe the problem" → find the best-matching scene by narration/label.
  function findByDescription() {
    const q = describe.toLowerCase().trim()
    if (!q) return
    const words = q.split(/\s+/).filter((w) => w.length > 2)
    let best: Scene | null = null, bestScore = 0
    for (const s of scenes) {
      const hay = (s.label + ' ' + s.narration).toLowerCase()
      let score = 0
      for (const w of words) if (hay.includes(w)) score++
      if (score > bestScore) { bestScore = score; best = s }
    }
    if (best) { pick(best) } else { setError('Couldn’t find that scene — try clicking it from the list.') }
  }

  function pick(s: Scene) {
    setSelected(s); setMode('fix'); setAction('rerecord'); setEditText(s.narration); setPreviewUrl(null); setError('')
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
        // poll the video row for scene_preview_url (VPS writes it when the clip is ready)
        setBusy('preview')
        for (let i = 0; i < 30; i++) {
          await new Promise((res) => setTimeout(res, 2000))
          const pr = await fetch(`/api/videos/${videoId}/preview-vo`).then((x) => x.ok ? x.json() : null).catch(() => null)
          if (pr?.url) { setPreviewUrl(pr.url + '?t=' + Date.now()); break }
        }
        setBusy('')
      } else {
        onStarted() // the video row is now 'processing'; parent shows progress
      }
    } catch { setError('Network error — please try again.'); setBusy('') }
  }

  const willCharge = action === 'edit-text'
  const textChanged = action === 'edit-text' && selected && editText.trim() !== selected.narration.trim()

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 720, maxHeight: '88vh', overflow: 'auto', background: 'white', borderRadius: 12, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', margin: 0 }}>Fix a scene</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--ink-light)' }}>×</button>
        </div>
        <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginTop: 4, marginBottom: 18, lineHeight: 1.5 }}>
          Fix one scene without redoing the whole video. Re-recording a glitch or fixing a pronunciation is <b>free</b> — you’re only charged ({sceneFixCost} credits) if you change the wording.
        </p>

        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-light)' }}>Loading scenes…</div> : mode === 'pick' ? (
          <>
            {/* Describe-the-problem finder */}
            <div style={{ marginBottom: 16, padding: 14, borderRadius: 10, background: 'rgba(199,232,168,0.12)', border: '1px solid var(--mint)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Describe the problem and we’ll find the scene:</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={describe} onChange={(e) => setDescribe(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && findByDescription()}
                  placeholder="e.g. the voice glitched on the growth rate part"
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit' }} />
                <button onClick={findByDescription} style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: 'var(--ink)', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Find</button>
              </div>
            </div>
            {/* Or pick from the list */}
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Or pick a scene</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {scenes.map((s) => (
                <button key={s.index} onClick={() => pick(s)} style={{ display: 'flex', gap: 12, alignItems: 'center', textAlign: 'left', padding: 10, borderRadius: 10, border: '1px solid var(--border-light)', background: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {s.thumb ? <img src={s.thumb} alt="" style={{ width: 96, height: 54, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} /> : <div style={{ width: 96, height: 54, borderRadius: 6, background: 'var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--ink-light)' }}>{s.index + 1}</div>}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{s.index + 1}. {s.label}</div>
                    {s.narration ? <div style={{ fontSize: 13, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.narration}</div> : null}
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : selected ? (
          <>
            {/* Chosen scene */}
            <button onClick={() => { setMode('pick'); setSelected(null) }} style={{ background: 'none', border: 'none', color: 'var(--ink-light)', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 12 }}>← Choose a different scene</button>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              {selected.thumb ? <img src={selected.thumb} alt="" style={{ width: 120, height: 68, objectFit: 'cover', borderRadius: 8 }} /> : null}
              <div><div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>{selected.index + 1}. {selected.label}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4, lineHeight: 1.4 }}>“{selected.narration}”</div></div>
            </div>

            {/* Fix type */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {([['rerecord', 'Re-record (glitch)', 'Free'], ['edit-text', 'Edit the wording', `${sceneFixCost} cr`], ['fix-pronunciation', 'Fix a pronunciation', 'Free']] as const).map(([a, label, tag]) => (
                <button key={a} onClick={() => setAction(a)} disabled={a === 'edit-text' && !selected.narration} style={{
                  padding: '10px 14px', borderRadius: 8, cursor: a === 'edit-text' && !selected.narration ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                  border: action === a ? '2px solid var(--mint)' : '1.5px solid var(--border-light)', background: action === a ? 'rgba(199,232,168,0.12)' : 'white', opacity: a === 'edit-text' && !selected.narration ? 0.5 : 1,
                }}>{label} <span style={{ color: tag === 'Free' ? '#16a34a' : 'var(--ink-light)', fontWeight: 600 }}>· {tag}</span></button>
              ))}
            </div>

            {action === 'edit-text' && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>What should this scene say?</div>
                <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3}
                  placeholder="Rewrite the wording, or tell us what to change — e.g. “add the word ICHRA to the headline” or paste the new script for this scene."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 6, lineHeight: 1.4 }}>
                  This updates both the <b>on-screen text</b> and the <b>voiceover</b> for this scene, then re-renders it.
                </div>
              </div>
            )}
            {action === 'fix-pronunciation' && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input value={pronWord} onChange={(e) => setPronWord(e.target.value)} placeholder="Word (e.g. Reg FD)" style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit' }} />
                <input value={pronSay} onChange={(e) => setPronSay(e.target.value)} placeholder="Say it like (e.g. Regulation F D)" style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit' }} />
              </div>
            )}

            {previewUrl && (
              <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, background: 'rgba(199,232,168,0.12)', border: '1px solid var(--mint)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Preview the new voiceover:</div>
                <audio controls src={previewUrl} style={{ width: '100%' }} />
              </div>
            )}
            {error && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 12 }}>{error}</div>}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => callFix(true)} disabled={!!busy} style={{ padding: '12px 20px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'white', fontWeight: 700, fontSize: 14, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1 }}>
                {busy === 'preview' ? 'Generating preview…' : '▶ Preview new voiceover (free)'}
              </button>
              <button onClick={() => callFix(false)} disabled={!!busy || (willCharge && !textChanged)} style={{ padding: '12px 24px', borderRadius: 8, border: 'none', background: 'var(--ink)', color: 'white', fontWeight: 800, fontSize: 14, cursor: busy || (willCharge && !textChanged) ? 'default' : 'pointer', fontFamily: 'inherit', opacity: busy || (willCharge && !textChanged) ? 0.6 : 1 }}>
                {busy === 'commit' ? 'Starting…' : willCharge ? `Apply edit (${sceneFixCost} cr)` : 'Apply fix (free)'}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
