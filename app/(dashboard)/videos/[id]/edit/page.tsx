'use client'

// =============================================================================
// The slide editor — maximum control, two ways to use it.
//
// Every slide is editable BY HAND (headline, bullets, narration, all plain
// text boxes), and the whole deck is editable BY INSTRUCTION ("make slide 3
// punchier", "add a slide about our guarantee") through the AI bar at the top.
// Both paths end at the same place: the revised scenes go back through the
// same generator that built the deck, so the compliance scrub and the theme
// apply to edits exactly as they did to the original.
//
// Pricing is shown BEFORE the button is pressed, never discovered after:
// changing what a slide shows is free; changing what the voice says bills per
// slide at the Fix-a-Scene rate. The quote comes from the server (the same
// code that will do the charging), not from a duplicate calculation here —
// two implementations of "what will this cost" always drift apart.
// =============================================================================

// Phase 4: this editor is where the result page's "Ask for a change" bar
// sends presentations and decks. It opens with the request already tried
// (?ask=… and, for "This slide", ?slide=N), lists every AI change with its
// own Undo, and Undo on the result page opens it with the slides from before
// a rebuild (?restore=<change id>) — the rebuild button then prices putting
// them back, as for any edit.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../../_lib/supabase/client'
import { addChange, findChange } from '../change/change-log'

type Scene = {
  title?: string
  narration: string
  _role?: 'cover' | 'closing'
  slideData?: { headline?: string; stats?: { label?: string; value?: string }[]; bullets?: string[]; cta?: string }
}

export default function EditPresentationPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [outputType, setOutputType] = useState('')
  const [scenes, setScenes] = useState<Scene[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [quote, setQuote] = useState<{ cost: number; narrationChanges: number } | null>(null)
  const [aiText, setAiText] = useState('')
  const [aiScope, setAiScope] = useState(-1) // -1 = whole deck
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState('')
  const [building, setBuilding] = useState(false)
  const [buildDetail, setBuildDetail] = useState('')
  // Every AI change, with the slides as they were just before it — so each
  // one can be taken back (an instruction that lands wrong should cost one
  // click, not a page reload and lost manual work). Undoing an earlier change
  // also takes back the ones after it, since they were made on top of it.
  const [history, setHistory] = useState<{ label: string; before: Scene[] }[]>([])
  // The slides as loaded — what a rebuild's Undo on the result page puts back.
  const loadedRef = useRef<Scene[] | null>(null)
  const [restored, setRestored] = useState(false)
  // A request handed over by the result page's bar, tried once on arrival.
  const askedRef = useRef<{ text: string; slide: number } | null>(null)

  useEffect(() => {
    const load = async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('videos')
        .select('id, title, output_type, status, script, draft_data')
        .eq('id', id)
        .single()
      if (error || !data) { setLoadError('Could not load this presentation.'); setLoading(false); return }
      if (data.output_type !== 'interactive' && data.output_type !== 'deck') {
        setLoadError('Only interactive presentations and slide decks can be edited here.')
        setLoading(false); return
      }
      const draft = (data.draft_data ?? {}) as { scenes?: Scene[] }
      const src = (Array.isArray(draft.scenes) && draft.scenes.length ? draft.scenes
        : Array.isArray(data.script) ? data.script : []) as Scene[]
      setTitle(data.title || 'Untitled')
      setOutputType(data.output_type)
      loadedRef.current = JSON.parse(JSON.stringify(src))
      // Read the address here, not with useSearchParams: nothing about the
      // first paint depends on it.
      const q = new URLSearchParams(window.location.search)
      const restoreId = q.get('restore')
      const back = restoreId ? findChange(id, restoreId) : null
      if (back && back.kind === 'presentation' && Array.isArray(back.before) && back.before.length) {
        setScenes(JSON.parse(JSON.stringify(back.before)))
        setRestored(true)
      } else {
        setScenes(JSON.parse(JSON.stringify(src)))
        const ask = (q.get('ask') ?? '').trim()
        const slide = Number(q.get('slide'))
        if (ask) {
          askedRef.current = { text: ask.slice(0, 500), slide: Number.isInteger(slide) && slide >= 0 && slide < src.length ? slide : -1 }
          setAiText(askedRef.current.text)
          setAiScope(askedRef.current.slide)
        }
      }
      setLoading(false)
    }
    load()
  }, [id])

  // Try the bar's request once the slides are in (free — nothing is rebuilt
  // until the Rebuild button, which shows its price).
  useEffect(() => {
    if (loading || !askedRef.current || !scenes.length) return
    const { text, slide } = askedRef.current
    askedRef.current = null
    runAi(text, slide)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, scenes.length])

  // Live price: ask the server what THIS state would cost. Debounced — it's a
  // network call per keystroke otherwise.
  useEffect(() => {
    if (!scenes.length) return
    const t = setTimeout(async () => {
      const r = await fetch('/api/reedit-presentation', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ videoId: id, scenes, quoteOnly: true }),
      }).then((x) => x.json()).catch(() => null)
      if (r && typeof r.cost === 'number') setQuote(r)
    }, 700)
    return () => clearTimeout(t)
  }, [scenes, id])

  const patch = (i: number, fn: (s: Scene) => void) => {
    setScenes((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as Scene[]
      fn(next[i])
      return next
    })
  }
  const move = (i: number, d: number) => {
    setScenes((prev) => {
      const j = i + d
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }
  const remove = (i: number) => setScenes((prev) => prev.filter((_, k) => k !== i))
  const addAfter = (i: number) =>
    setScenes((prev) => {
      const next = [...prev]
      next.splice(i + 1, 0, { narration: 'New slide — write what the voice should say here.', slideData: { headline: 'New slide', bullets: [] } })
      return next
    })

  const runAi = async (text = aiText, scope = aiScope) => {
    if (!text.trim() || aiBusy) return
    setAiBusy(true); setAiError('')
    const before = JSON.parse(JSON.stringify(scenes)) as Scene[]
    const r = await fetch('/api/ai-edit-scenes', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scenes, instruction: text.trim(), ...(scope >= 0 ? { targetIndex: scope } : {}) }),
    }).then((x) => x.json()).catch(() => ({ error: 'Network error' }))
    setAiBusy(false)
    if (r?.scenes) {
      setScenes(r.scenes)
      setAiText('')
      setHistory((h) => [...h, { label: `${scope >= 0 ? `Slide ${scope + 1}: ` : ''}${text.trim()}`, before }])
    } else {
      setAiError(r?.error || 'The AI edit failed — nothing was changed.')
    }
  }

  const undoAt = (k: number) => {
    const entry = history[k]
    if (!entry) return
    setScenes(entry.before)
    setHistory((h) => h.slice(0, k))
  }

  const rebuild = async () => {
    if (building) return
    setBuilding(true); setBuildDetail('Saving your edits…')
    const r = await fetch('/api/reedit-presentation', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ videoId: id, scenes }),
    }).then((x) => x.json()).catch(() => ({ error: 'Network error' }))
    if (r?.error) { setBuildDetail(''); setBuilding(false); setAiError(r.error); return }
    // The rebuild started: keep the slides as they were before it, so the
    // result page can offer Undo for it (kept in this browser only).
    if (loadedRef.current) {
      addChange(id, {
        kind: 'presentation',
        summary: restored
          ? 'Put back an earlier version'
          : history.length
            ? `Rebuilt after: ${history.map((h) => h.label).join('; ').slice(0, 140)}`
            : 'Rebuilt with your edits',
        before: loadedRef.current,
      })
    }
    // The rebuild runs server-side; watch the row until it lands.
    const sb = createClient()
    const started = Date.now()
    const tick = async () => {
      const { data } = await sb.from('videos').select('status, progress_detail').eq('id', id).single()
      if (data?.status === 'completed') { router.push(`/videos/${id}`); return }
      if (data?.status === 'failed') { setBuildDetail(''); setBuilding(false); setAiError('The rebuild failed — your credits for it were refunded.'); return }
      setBuildDetail(data?.progress_detail || 'Rebuilding…')
      if (Date.now() - started < 8 * 60 * 1000) setTimeout(tick, 2500)
      else { setBuilding(false); setAiError('Still building — check the presentation page in a minute.') }
    }
    setTimeout(tick, 2500)
  }

  const priceLabel = useMemo(() => {
    if (!quote) return 'Rebuild'
    if (quote.cost === 0) return 'Rebuild — free (no narration changed)'
    return `Rebuild — ${quote.cost} credits (${quote.narrationChanges} narration change${quote.narrationChanges === 1 ? '' : 's'})`
  }, [quote])

  if (loading) return <div className="wizard-container"><p>Loading…</p></div>
  if (loadError) return <div className="wizard-container"><div className="card"><p>{loadError}</p></div></div>

  return (
    <div className="wizard-container" style={{ maxWidth: 880 }}>
      <a className="back-link" href={`/videos/${id}`}>← Back to presentation</a>
      <h1 style={{ margin: '10px 0 2px' }}>Edit slides</h1>
      <p className="wizard-sub">{title} · {outputType === 'deck' ? 'Slide deck' : 'Interactive presentation'} · {scenes.length} slides</p>

      {/* ── AI bar ─────────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 18 }}>
        <label className="input-label">Tell the AI what to change</label>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <input
            className="input" style={{ flex: '1 1 320px' }}
            placeholder={'e.g. "Make slide 3 punchier" or "Add a slide about our guarantee"'}
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runAi() }}
            disabled={aiBusy}
          />
          <select className="input-select" style={{ width: 150 }} value={aiScope}
            onChange={(e) => setAiScope(Number(e.target.value))} disabled={aiBusy}>
            <option value={-1}>Whole deck</option>
            {scenes.map((s, i) => (
              <option key={i} value={i}>Slide {i + 1}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => runAi()} disabled={aiBusy || !aiText.trim()}>
            {aiBusy ? 'Thinking…' : 'Apply'}
          </button>
        </div>
        {aiError && <p className="auth-error" style={{ marginTop: 8 }}>{aiError}</p>}
        <p className="wizard-sub" style={{ marginTop: 8, marginBottom: 0 }}>
          AI edits are free to try. You only pay when you rebuild, and only for slides whose narration changed.
        </p>
        {restored && (
          <p className="wizard-sub" role="status" style={{ marginTop: 8, marginBottom: 0 }}>
            These are the slides from before your last rebuild. Press the rebuild button below to put them back.
          </p>
        )}
        {history.length > 0 && (
          <div style={{ marginTop: 12, borderTop: '1px solid var(--border-light)', paddingTop: 10 }} aria-label="Your changes">
            <div className="input-label" style={{ marginBottom: 4 }}>Your changes (not rebuilt yet)</div>
            {history.map((h, k) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', padding: '6px 0', fontSize: 'var(--fs-ui)', flexWrap: 'wrap' }}>
                <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{k + 1}. {h.label}</span>
                <button className="btn btn-sm btn-outlined" onClick={() => undoAt(k)} disabled={aiBusy}>
                  {k === history.length - 1 ? 'Undo' : 'Undo this and later'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Slides ─────────────────────────────────────────────────────── */}
      {scenes.map((s, i) => (
        <div key={i} className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 10 }}>
            <span className="badge badge-neutral">Slide {i + 1}{s._role ? ` · ${s._role}` : ''}</span>
            <span style={{ flex: 1 }} />
            <button className="btn btn-sm btn-outlined" onClick={() => move(i, -1)} disabled={i === 0} title="Move up">↑</button>
            <button className="btn btn-sm btn-outlined" onClick={() => move(i, 1)} disabled={i === scenes.length - 1} title="Move down">↓</button>
            <button className="btn btn-sm btn-outlined" onClick={() => addAfter(i)} title="Add a slide after this one">+ Add</button>
            <button className="btn btn-sm btn-danger" onClick={() => remove(i)} disabled={scenes.length <= 3 || !!s._role}
              title={s._role ? 'Cover and closing slides stay' : 'Delete this slide'}>Delete</button>
          </div>

          <div className="form-group">
            <label className="input-label">Headline (what the slide shows)</label>
            <input className="input" value={s.slideData?.headline ?? s.title ?? ''}
              onChange={(e) => patch(i, (x) => { x.slideData = { ...(x.slideData ?? {}), headline: e.target.value } })} />
          </div>

          <div className="form-group">
            <label className="input-label">Bullets — one per line</label>
            <textarea className="input" rows={3}
              value={(s.slideData?.bullets ?? []).join('\n')}
              onChange={(e) => patch(i, (x) => {
                x.slideData = { ...(x.slideData ?? {}), bullets: e.target.value.split('\n').map((b) => b.trim()).filter(Boolean) }
              })} />
          </div>

          <div className="form-group">
            <label className="input-label">Narration (what the voice says)</label>
            <textarea className="input" rows={3} value={s.narration}
              onChange={(e) => patch(i, (x) => { x.narration = e.target.value })} />
          </div>
        </div>
      ))}

      {/* ── Rebuild ────────────────────────────────────────────────────── */}
      <div className="wizard-actions" style={{ position: 'sticky', bottom: 0, background: 'var(--bg)', padding: '12px 0' }}>
        <button className="btn btn-primary btn-lg btn-full" onClick={rebuild} disabled={building}>
          {building ? (buildDetail || 'Rebuilding…') : priceLabel}
        </button>
      </div>
    </div>
  )
}
