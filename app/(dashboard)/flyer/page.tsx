'use client'

// =============================================================================
// Flyer & ad maker.
//
// Pick a style, describe the job in plain English, tick the sizes you need.
// Every flyer is generated whole — artwork and lettering together — so the
// output looks like a designed template rather than text pasted over a photo.
//
// The template tiles are REAL generated samples stored as files, not live
// renders. The first version rendered tiles from an art-less template and the
// gallery was fifteen black squares, which tells a user nothing about what
// they are picking.
// =============================================================================

import { useEffect, useRef, useState } from 'react'
import {
  FLYER_TEMPLATES, FLYER_SIZES, PHOTO_ROLES, thumbUrl,
  type FlyerFields, type PhotoRole,
} from '../../_lib/flyer-engine'

type Msg = { role: 'user' | 'assistant'; text: string }
type Made = { sizeId: string; label: string; w: number; h: number; png: string }

// Three at a time: quick enough, and few enough not to trip the image API's
// rate limit and turn a queue into a wall of errors.
const CONCURRENCY = 3

const CATEGORIES = [
  { id: 'nightlife', label: 'Nightlife' },
  { id: 'business', label: 'Business' },
  { id: 'community', label: 'Community' },
  { id: 'realestate', label: 'Real estate' },
  { id: 'fitness', label: 'Fitness' },
] as const

const GROUPS = [
  { id: 'print', label: 'Print' },
  { id: 'social', label: 'Social posts' },
  { id: 'banner', label: 'Banners & headers' },
] as const

export default function FlyerMakerPage() {
  const [msgs, setMsgs] = useState<Msg[]>([{
    role: 'assistant',
    text: 'Pick a style above, then tell me the job — something like "Saturday club night at The Foundry, doors 9pm, $20 cover".',
  }])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const [fields, setFields] = useState<FlyerFields>({})
  const [templateId, setTemplateId] = useState('rnb')
  const [category, setCategory] = useState<string>('nightlife')
  const [note, setNote] = useState('')
  const [ticked, setTicked] = useState<string[]>(['letter', 'ig-post'])
  const [making, setMaking] = useState(false)
  const [made, setMade] = useState<Made[]>([])
  const [photos, setPhotos] = useState<{ dataUrl: string; role: PhotoRole; name: string }[]>([])
  const [progress, setProgress] = useState<Record<string, 'wait' | 'busy' | 'done' | 'fail'>>({})
  const [startedAt, setStartedAt] = useState(0)
  const [now, setNow] = useState(0)

  // Ticks only while something is being made, so an idle page isn't re-rendering
  // once a second for no reason.
  useEffect(() => {
    if (!making) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [making])

  // A MEASURED estimate. The first figure here was 75 seconds and it was wrong:
  // timed against production, one size takes about 115. An estimate that always
  // runs short is nearly as irritating as none, so it is better to quote the
  // real number and finish early. The countdown never goes negative — past the
  // estimate it says so rather than showing a lie.
  const SECS_PER_SIZE = 115
  const doneCount = Object.values(progress).filter((s) => s === 'done' || s === 'fail').length
  const elapsed = startedAt ? Math.round((now - startedAt) / 1000) : 0
  const waves = Math.ceil(ticked.length / CONCURRENCY)
  const estimateTotal = waves * SECS_PER_SIZE
  const remaining = Math.max(0, estimateTotal - elapsed)
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => { scrollRef.current?.scrollTo({ top: 9e9, behavior: 'smooth' }) }, [msgs, busy])

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    setInput(''); setErr('')
    setMsgs((m) => [...m, { role: 'user', text }])
    setBusy(true)
    const r = await fetch('/api/flyer-chat', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: text, fields, layoutId: templateId, sizeId: ticked[0] ?? 'letter', history: msgs.slice(-6) }),
    }).then((x) => x.json()).catch(() => ({ error: 'Network error' }))
    setBusy(false)
    if (r?.error) { setErr(r.error); return }
    setFields(r.fields ?? {})
    setMsgs((m) => [...m, { role: 'assistant', text: r.reply || 'Got it — tick your sizes and hit Make.' }])
  }

  // ONE REQUEST PER SIZE, not one request for all of them.
  //
  // Asking for everything at once means the page can show nothing until the
  // last one lands — two sizes measured at 154 seconds of blank waiting. Split
  // apart, each design appears the moment it is ready, the progress bar counts
  // real completions rather than a made-up percentage, and one failure costs
  // one size instead of the whole batch.
  //
  // Three at a time: enough to keep it quick, few enough not to trip the image
  // API's rate limit and turn a queue into a wall of errors.
  const make = async () => {
    if (making || !ticked.length) return
    setMaking(true); setErr(''); setMade([])
    setStartedAt(Date.now())
    setProgress(Object.fromEntries(ticked.map((id) => [id, 'wait'])))

    const queue = [...ticked]
    const failures: string[] = []

    const worker = async () => {
      for (;;) {
        const id = queue.shift()
        if (!id) return
        setProgress((p) => ({ ...p, [id]: 'busy' }))
        const r = await fetch('/api/flyer-art', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            templateId, sizeIds: [id], fields, note: note.trim() || undefined,
            photos: photos.map(({ dataUrl, role }) => ({ dataUrl, role })),
          }),
        }).then((x) => x.json()).catch(() => ({ error: 'Network error' }))

        if (r?.images?.length) {
          setMade((m) => [...m, ...r.images])
          setProgress((p) => ({ ...p, [id]: 'done' }))
        } else {
          failures.push(FLYER_SIZES.find((s) => s.id === id)?.label ?? id)
          setProgress((p) => ({ ...p, [id]: 'fail' }))
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ticked.length) }, worker))
    setMaking(false)
    if (failures.length) setErr(`Could not make: ${failures.join(', ')}`)
  }

  const filled = Object.values(fields).some((v) => (Array.isArray(v) ? v.length : v))

  const panel = { background: 'white', border: '1px solid var(--border-light,#e5e0d8)', borderRadius: 10, padding: 14 } as const
  const dark = { padding: '10px 16px', borderRadius: 8, border: 'none', background: 'var(--ink,#23201c)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' } as const
  const plain = { padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border,#ddd6cc)', background: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink,#23201c)' } as const
  const chip = (on: boolean) => ({ ...plain, background: on ? 'var(--ink,#23201c)' : 'white', color: on ? 'white' : 'var(--ink,#23201c)', border: on ? '1px solid transparent' : plain.border }) as const

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '22px 20px 70px' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 26 }}>Flyer &amp; ad maker</h1>
      <p style={{ color: 'var(--ink-soft,#6b6459)', margin: '0 0 20px', fontSize: 14 }}>
        Pick a style, say what it&apos;s for, tick your sizes. Each one is designed from scratch — artwork and words together.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px,1fr) minmax(300px,400px)', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* STYLES */}
          <div style={panel}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {CATEGORIES.map((c) => (
                <button key={c.id} style={chip(category === c.id)} onClick={() => {
                  setCategory(c.id)
                  const first = FLYER_TEMPLATES.find((t) => t.category === c.id)
                  if (first) setTemplateId(first.id)
                }}>{c.label}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(112px,1fr))', gap: 9 }}>
              {FLYER_TEMPLATES.filter((t) => t.category === category).map((t) => (
                <button key={t.id} onClick={() => setTemplateId(t.id)} title={t.name}
                  style={{
                    padding: 0, borderRadius: 9, overflow: 'hidden', cursor: 'pointer', background: '#111',
                    border: templateId === t.id ? '3px solid var(--ink,#23201c)' : '1px solid var(--border,#ddd6cc)',
                  }}>
                  <img src={thumbUrl(t.id)} alt={t.name}
                    style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', display: 'block' }} />
                  <div style={{ fontSize: 11, fontWeight: 700, padding: '5px 4px', background: 'white', color: 'var(--ink,#23201c)' }}>{t.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* CHAT */}
          <div style={panel}>
            <div ref={scrollRef} style={{ maxHeight: 190, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 11 }}>
              {msgs.map((m, i) => (
                <div key={i} style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '86%',
                  padding: '8px 12px', borderRadius: 12, fontSize: 14, lineHeight: 1.45,
                  background: m.role === 'user' ? 'var(--ink,#23201c)' : 'var(--cream,#F4F1EC)',
                  color: m.role === 'user' ? 'white' : 'inherit',
                }}>{m.text}</div>
              ))}
              {busy && <div style={{ fontSize: 13, color: 'var(--ink-soft,#6b6459)' }}>Working…</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') send() }} disabled={busy}
                placeholder='e.g. "doors at 9, $20 cover, DJ Sable headlining"'
                style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border,#ddd6cc)', font: 'inherit', fontSize: 14 }} />
              <button onClick={send} disabled={busy || !input.trim()} style={{ ...dark, opacity: busy || !input.trim() ? 0.6 : 1 }}>Send</button>
            </div>
            {err && <p style={{ color: '#B4432F', fontSize: 13, marginTop: 8 }}>{err}</p>}
          </div>

          {/* YOUR PHOTOS */}
          <div style={panel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
              <strong style={{ fontSize: 13 }}>Your own photos <span style={{ fontWeight: 400, color: 'var(--ink-soft,#6b6459)' }}>— optional</span></strong>
              <label style={{ ...plain, display: 'inline-block' }}>
                + Add photo
                <input type="file" accept="image/*" multiple hidden
                  onChange={async (e) => {
                    const files = [...(e.target.files ?? [])].slice(0, 3 - photos.length)
                    for (const f of files) {
                      // 12 MB is a generous phone photo. Bigger than that and the
                      // upload stalls long before the design ever starts.
                      if (f.size > 12 * 1024 * 1024) { setErr(`${f.name} is too big — 12 MB max.`); continue }
                      const dataUrl: string = await new Promise((res) => {
                        const r = new FileReader()
                        r.onload = () => res(String(r.result))
                        r.readAsDataURL(f)
                      })
                      setPhotos((p) => [...p, { dataUrl, name: f.name, role: 'person' as PhotoRole }].slice(0, 3))
                    }
                    e.target.value = ''
                  }} />
              </label>
            </div>
            {!photos.length ? (
              <p style={{ fontSize: 13, color: 'var(--ink-soft,#6b6459)', margin: 0, lineHeight: 1.5 }}>
                Add a headshot, the actual property, or your product and the design gets built around it — instead of an invented person or place. Up to 3.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {photos.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <img src={p.dataUrl} alt="" style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 7, border: '1px solid var(--border,#ddd6cc)' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      {/* What it IS decides how it is used — a face gets cut out
                          and placed, a house becomes the scene. */}
                      <select value={p.role}
                        onChange={(e) => setPhotos((prev) => prev.map((x, k) => k === i ? { ...x, role: e.target.value as PhotoRole } : x))}
                        style={{ marginTop: 3, padding: '5px 8px', borderRadius: 7, border: '1px solid var(--border,#ddd6cc)', font: 'inherit', fontSize: 12, width: '100%' }}>
                        {PHOTO_ROLES.map((r) => <option key={r.id} value={r.id}>{r.label} — {r.hint}</option>)}
                      </select>
                    </div>
                    <button onClick={() => setPhotos((prev) => prev.filter((_, k) => k !== i))}
                      style={{ ...plain, padding: '5px 9px' }} title="Remove">✕</button>
                  </div>
                ))}
                <p style={{ fontSize: 12, color: 'var(--ink-soft,#6b6459)', margin: 0, lineHeight: 1.5 }}>
                  Your photo is redrawn into the design rather than pasted in, so people stay recognisable but are not pixel-for-pixel the original. Check the face before sending it out.
                </p>
              </div>
            )}
          </div>

          {/* SIZES */}
          <div style={panel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <strong style={{ fontSize: 13 }}>Make these sizes</strong>
              <span style={{ fontSize: 12, color: 'var(--ink-soft,#6b6459)' }}>{ticked.length} ticked · up to 8</span>
            </div>
            {GROUPS.map((g) => (
              <div key={g.id} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-soft,#6b6459)', marginBottom: 5 }}>{g.label}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 3 }}>
                  {FLYER_SIZES.filter((s) => s.group === g.id).map((s) => (
                    <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer', padding: '2px 0' }}>
                      <input type="checkbox" checked={ticked.includes(s.id)}
                        onChange={(e) => setTicked((p) => e.target.checked ? [...p, s.id] : p.filter((x) => x !== s.id))} />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <input value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Anything else about the look? (optional) e.g. 'use purple instead of gold'"
              style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border,#ddd6cc)', font: 'inherit', fontSize: 13, marginBottom: 9 }} />
            <button onClick={make} disabled={making || !ticked.length || !filled}
              style={{ ...dark, width: '100%', opacity: making || !ticked.length || !filled ? 0.55 : 1 }}>
              {making ? `Designing ${ticked.length}…` : `Make ${ticked.length} design${ticked.length === 1 ? '' : 's'}`}
            </button>
            {!filled && <p style={{ fontSize: 12, color: 'var(--ink-soft,#6b6459)', margin: '8px 0 0' }}>Tell me about the event first.</p>}

            {/* PROGRESS. The bar measures designs actually finished, not time
                elapsed — a bar that fills on a timer is a lie that reaches 100%
                while the user is still waiting. */}
            {making && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  <span>{doneCount} of {ticked.length} designed</span>
                  <span style={{ color: 'var(--ink-soft,#6b6459)', fontWeight: 400 }}>
                    {remaining > 0 ? `about ${mmss(remaining)} left` : 'any moment now'} · {mmss(elapsed)} elapsed
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 99, background: 'var(--cream,#F4F1EC)', overflow: 'hidden', border: '1px solid var(--border,#ddd6cc)' }}>
                  <div style={{
                    height: '100%', borderRadius: 99, background: 'var(--ink,#23201c)',
                    width: `${Math.round((doneCount / Math.max(ticked.length, 1)) * 100)}%`,
                    transition: 'width .5s ease',
                  }} />
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 9 }}>
                  {ticked.map((id) => {
                    const st = progress[id] ?? 'wait'
                    const label = FLYER_SIZES.find((s) => s.id === id)?.label ?? id
                    const look = st === 'done' ? { bg: '#E7F3E4', fg: '#2C6B34', mark: '✓' }
                      : st === 'fail' ? { bg: '#FBE9E6', fg: '#B4432F', mark: '✕' }
                      : st === 'busy' ? { bg: 'var(--ink,#23201c)', fg: 'white', mark: '●' }
                      : { bg: 'var(--cream,#F4F1EC)', fg: 'var(--ink-soft,#6b6459)', mark: '·' }
                    return (
                      <span key={id} style={{
                        fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 99,
                        background: look.bg, color: look.fg, border: '1px solid var(--border,#ddd6cc)',
                      }}>
                        {look.mark} {label.replace(/ \d+ ?[×x].*$/, '')}
                      </span>
                    )
                  })}
                </div>
                <p style={{ fontSize: 12, color: 'var(--ink-soft,#6b6459)', margin: '9px 0 0', lineHeight: 1.5 }}>
                  Each size is designed from scratch, three at a time. Finished ones appear on the right as they land — you don&apos;t have to wait for all of them.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* RESULTS */}
        <div style={{ position: 'sticky', top: 16 }}>
          <div style={panel}>
            <strong style={{ fontSize: 13 }}>{made.length ? 'Your designs' : 'Preview'}</strong>
            {!made.length && !making && (
              <div style={{ marginTop: 10 }}>
                <img src={thumbUrl(templateId)} alt=""
                  style={{ width: '100%', borderRadius: 8, display: 'block', border: '1px solid var(--border,#ddd6cc)' }} />
                <p style={{ fontSize: 12, color: 'var(--ink-soft,#6b6459)', marginTop: 8, lineHeight: 1.5 }}>
                  A sample of the <strong>{FLYER_TEMPLATES.find((t) => t.id === templateId)?.name}</strong> style. Yours will use your own words.
                </p>
              </div>
            )}
            {making && <p style={{ fontSize: 13, color: 'var(--ink-soft,#6b6459)', marginTop: 10 }}>Designing…</p>}
            {made.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
                {made.map((o) => (
                  <a key={o.sizeId} href={o.png} download={`${o.sizeId}.png`}
                    style={{ textDecoration: 'none', color: 'inherit', border: '1px solid var(--border,#ddd6cc)', borderRadius: 8, overflow: 'hidden', display: 'block' }}>
                    <img src={o.png} alt={o.label} style={{ width: '100%', display: 'block', background: '#111' }} />
                    <div style={{ padding: '7px 9px', fontSize: 12, fontWeight: 700 }}>
                      ⬇ {o.label} <span style={{ color: 'var(--ink-soft,#6b6459)', fontWeight: 400 }}>· {o.w} × {o.h}</span>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-soft,#6b6459)', marginTop: 10, lineHeight: 1.55 }}>
            Read the small details before you print — dates, prices and phone numbers are drawn by the AI and are worth
            a second look. Large print sizes are upscaled, so they suit handouts better than billboards.
          </p>
        </div>
      </div>
    </div>
  )
}
