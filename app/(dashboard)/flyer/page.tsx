'use client'

// =============================================================================
// Flyer maker.
//
// Pick a template, describe the job in plain English, tick every size you
// need. One design comes out as a print flyer, a square social post, a wide
// banner — each laid out for its own shape rather than one image stretched
// three ways.
//
// The preview is the REAL renderer in an iframe, not a mock-up, so what is on
// screen is exactly what exports. Print sizes also offer Print / Save PDF,
// which keeps the text VECTOR at the artboard's true inch size — sharper than
// any image export and what a commercial printer actually wants.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FLYER_TEMPLATES, FLYER_SIZES, renderFlyer,
  type FlyerFields, type FlyerTemplate,
} from '../../_lib/flyer'

type Msg = { role: 'user' | 'assistant'; text: string }

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
    text: 'Pick a template, then tell me the job — something like "Saturday club night, doors at 9, $20 cover".',
  }])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const [fields, setFields] = useState<FlyerFields>({})
  const [templateId, setTemplateId] = useState('rnb')
  const [sizeId, setSizeId] = useState('letter')
  const [accent, setAccent] = useState('')
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<string>('nightlife')

  const [art, setArt] = useState<string[]>([])
  const [artWide, setArtWide] = useState<string[]>([])
  const [chosenArt, setChosenArt] = useState<string | null>(null)
  const [chosenWide, setChosenWide] = useState<string | null>(null)
  const [artBusy, setArtBusy] = useState(false)

  const [ticked, setTicked] = useState<string[]>(['letter', 'ig-post', 'fb-ad'])
  const [rendering, setRendering] = useState(false)
  const [outputs, setOutputs] = useState<{ sizeId: string; label: string; w: number; h: number; png: string }[]>([])

  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => { scrollRef.current?.scrollTo({ top: 9e9, behavior: 'smooth' }) }, [msgs, busy])

  const template = useMemo<FlyerTemplate>(
    () => FLYER_TEMPLATES.find((t) => t.id === templateId) ?? FLYER_TEMPLATES[0], [templateId])
  const size = useMemo(() => FLYER_SIZES.find((s) => s.id === sizeId) ?? FLYER_SIZES[0], [sizeId])
  const wide = size.w / size.h > 1.35

  const html = useMemo(() => renderFlyer({
    template, size, fields,
    artUrl: wide ? (chosenWide ?? chosenArt) : chosenArt,
    accent: accent || undefined,
  }), [template, size, fields, chosenArt, chosenWide, wide, accent])

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    setInput(''); setErr('')
    setMsgs((m) => [...m, { role: 'user', text }])
    setBusy(true)
    const r = await fetch('/api/flyer-chat', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: text, fields, layoutId: templateId, sizeId, history: msgs.slice(-6) }),
    }).then((x) => x.json()).catch(() => ({ error: 'Network error' }))
    setBusy(false)
    if (r?.error) { setErr(r.error); return }
    setFields(r.fields ?? {})
    if (r.sizeId) setSizeId(r.sizeId)
    if (r.subject) setSubject(r.subject)
    setMsgs((m) => [...m, { role: 'assistant', text: r.reply || 'Updated.' }])
    if (r.subject && !art.length) loadArt(r.subject, true)
  }

  const loadArt = async (subj?: string, portrait = true) => {
    if (artBusy) return
    setArtBusy(true); setErr('')
    const r = await fetch('/api/flyer-art', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject: subj ?? subject, templateId, count: 4, portrait }),
    }).then((x) => x.json()).catch(() => ({ error: 'Network error' }))
    setArtBusy(false)
    if (r?.error) { setErr(r.error); return }
    if (portrait) {
      setArt((p) => [...(r.art ?? []), ...p].slice(0, 16))
      if (!chosenArt && r.art?.[0]) setChosenArt(r.art[0])
    } else {
      setArtWide((p) => [...(r.art ?? []), ...p].slice(0, 16))
      if (!chosenWide && r.art?.[0]) setChosenWide(r.art[0])
    }
  }

  const renderAll = async () => {
    if (rendering || !ticked.length) return
    setRendering(true); setErr(''); setOutputs([])
    const r = await fetch('/api/flyer-render', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        templateId, sizeIds: ticked, fields,
        artUrl: chosenArt, artWide: chosenWide, accent: accent || undefined,
      }),
    }).then((x) => x.json()).catch(() => ({ error: 'Network error' }))
    setRendering(false)
    if (r?.error) { setErr(r.error + (r.detail ? ` (${r.detail})` : '')); return }
    setOutputs(r.images ?? [])
    if (r.failed?.length) setErr(`Could not render: ${r.failed.join(', ')}`)
  }

  const printIt = () => {
    const doc = renderFlyer({
      template, size, fields,
      artUrl: wide ? (chosenWide ?? chosenArt) : chosenArt,
      accent: accent || undefined, print: true,
    })
    const w = window.open('', '_blank')
    if (!w) { setErr('Allow pop-ups to print.'); return }
    w.document.write(doc); w.document.close()
    // Wait for fonts and the background, or the PDF prints half-dressed.
    w.onload = () => setTimeout(() => w.print(), 800)
  }

  const chip = (on: boolean) => ({
    padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit', border: on ? '2px solid var(--ink,#23201c)' : '1px solid var(--border,#ddd6cc)',
    background: on ? 'var(--ink,#23201c)' : 'white', color: on ? 'white' : 'var(--ink,#23201c)',
  }) as const
  const panel = { background: 'white', border: '1px solid var(--border-light,#e5e0d8)', borderRadius: 10, padding: 14 } as const
  const dark = { padding: '10px 16px', borderRadius: 8, border: 'none', background: 'var(--ink,#23201c)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' } as const
  const plain = { padding: '8px 13px', borderRadius: 8, border: '1px solid var(--border,#ddd6cc)', background: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink,#23201c)' } as const

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '22px 20px 70px' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 26 }}>Flyer &amp; ad maker</h1>
      <p style={{ color: 'var(--ink-soft,#6b6459)', margin: '0 0 20px', fontSize: 14 }}>
        One design, every size. The artwork is generated; the words are typeset — so they print sharp and spelled right.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px,1fr) minmax(300px,420px)', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* TEMPLATES */}
          <div style={panel}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {CATEGORIES.map((c) => (
                <button key={c.id} style={chip(category === c.id)} onClick={() => {
                  setCategory(c.id)
                  const first = FLYER_TEMPLATES.find((t) => t.category === c.id)
                  if (first) { setTemplateId(first.id); setAccent('') }
                }}>{c.label}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(104px,1fr))', gap: 8 }}>
              {FLYER_TEMPLATES.filter((t) => t.category === category).map((t) => (
                <button key={t.id} onClick={() => { setTemplateId(t.id); setAccent('') }}
                  style={{
                    padding: 0, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', background: 'transparent',
                    border: templateId === t.id ? '3px solid var(--ink,#23201c)' : '1px solid var(--border,#ddd6cc)',
                  }}>
                  {/* Live thumbnail of the actual template — no stock preview to
                      go stale when a treatment changes. */}
                  <div style={{ aspectRatio: '3/4', overflow: 'hidden', position: 'relative', background: '#111' }}>
                    <iframe title={t.name} tabIndex={-1} scrolling="no"
                      srcDoc={renderFlyer({
                        template: t, size: FLYER_SIZES[0],
                        fields: { eyebrow: 'Saturday', headline: t.name, subhead: '', cta: 'Tickets' },
                        artUrl: chosenArt,
                      })}
                      style={{ width: 816, height: 1056, border: 0, transform: 'scale(.128)', transformOrigin: 'top left', pointerEvents: 'none' }} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, padding: '5px 4px', background: 'white', color: 'var(--ink,#23201c)' }}>{t.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* CHAT */}
          <div style={panel}>
            <div ref={scrollRef} style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 11 }}>
              {msgs.map((m, i) => (
                <div key={i} style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%',
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

          {/* ARTWORK */}
          <div style={panel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9, flexWrap: 'wrap', gap: 8 }}>
              <strong style={{ fontSize: 13 }}>Artwork</strong>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={plain} disabled={artBusy} onClick={() => loadArt(undefined, true)}>
                  {artBusy ? 'Generating…' : art.length ? 'More upright' : 'Generate artwork'}
                </button>
                <button style={plain} disabled={artBusy} onClick={() => loadArt(undefined, false)}>
                  {artWide.length ? 'More wide' : 'Wide (for banners)'}
                </button>
              </div>
            </div>
            {!art.length && !artBusy && (
              <p style={{ fontSize: 13, color: 'var(--ink-soft,#6b6459)', margin: 0 }}>
                Describe the job first, then artwork appears here. Banners need their own wide artwork — a portrait image cropped sideways loses its composition.
              </p>
            )}
            {[{ list: art, chosen: chosenArt, set: setChosenArt, label: 'Upright' },
              { list: artWide, chosen: chosenWide, set: setChosenWide, label: 'Wide' }]
              .filter((g) => g.list.length).map((g) => (
              <div key={g.label} style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-soft,#6b6459)', marginBottom: 5 }}>{g.label}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(78px,1fr))', gap: 6 }}>
                  {g.list.map((a, i) => (
                    <button key={i} onClick={() => g.set(a)}
                      style={{ padding: 0, border: g.chosen === a ? '3px solid var(--ink,#23201c)' : '1px solid var(--border,#ddd6cc)', borderRadius: 7, overflow: 'hidden', cursor: 'pointer', aspectRatio: g.label === 'Wide' ? '3/2' : '3/4', background: '#eee' }}>
                      <img src={a} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* SIZES */}
          <div style={panel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <strong style={{ fontSize: 13 }}>Make these sizes</strong>
              <button style={plain} onClick={() => setTicked(ticked.length === FLYER_SIZES.length ? [] : FLYER_SIZES.map((s) => s.id))}>
                {ticked.length === FLYER_SIZES.length ? 'Clear all' : 'Select all'}
              </button>
            </div>
            {GROUPS.map((g) => (
              <div key={g.id} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-soft,#6b6459)', marginBottom: 5 }}>{g.label}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 4 }}>
                  {FLYER_SIZES.filter((s) => s.group === g.id).map((s) => (
                    <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer', padding: '3px 0' }}>
                      <input type="checkbox" checked={ticked.includes(s.id)}
                        onChange={(e) => setTicked((p) => e.target.checked ? [...p, s.id] : p.filter((x) => x !== s.id))} />
                      <span onClick={(e) => { e.preventDefault(); setSizeId(s.id) }}
                        style={{ textDecoration: sizeId === s.id ? 'underline' : 'none' }}>{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={renderAll} disabled={rendering || !ticked.length} style={{ ...dark, width: '100%', marginTop: 6, opacity: rendering || !ticked.length ? 0.6 : 1 }}>
              {rendering ? 'Rendering…' : `Make ${ticked.length} size${ticked.length === 1 ? '' : 's'}`}
            </button>
          </div>

          {/* OUTPUTS */}
          {outputs.length > 0 && (
            <div style={panel}>
              <strong style={{ fontSize: 13 }}>Ready to download</strong>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10, marginTop: 10 }}>
                {outputs.map((o) => (
                  <a key={o.sizeId} href={o.png} download={`${o.sizeId}.png`}
                    style={{ textDecoration: 'none', color: 'inherit', border: '1px solid var(--border,#ddd6cc)', borderRadius: 8, overflow: 'hidden', display: 'block' }}>
                    <img src={o.png} alt={o.label} style={{ width: '100%', display: 'block', background: '#111' }} />
                    <div style={{ padding: '6px 7px', fontSize: 11, fontWeight: 700 }}>
                      {o.label}<br /><span style={{ color: 'var(--ink-soft,#6b6459)', fontWeight: 400 }}>{o.w} × {o.h} px</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* PREVIEW */}
        <div style={{ position: 'sticky', top: 16 }}>
          <div style={{ ...panel, padding: 10 }}>
            <div style={{ width: '100%', aspectRatio: `${size.w} / ${size.h}`, background: '#232327', borderRadius: 6, overflow: 'hidden' }}>
              <iframe title="Preview" srcDoc={html} scrolling="no"
                style={{
                  width: `${size.unit === 'in' ? size.w * 96 : size.w}px`,
                  height: `${size.unit === 'in' ? size.h * 96 : size.h}px`,
                  border: 0, transformOrigin: 'top left',
                  transform: `scale(${380 / (size.unit === 'in' ? size.w * 96 : size.w)})`,
                }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={printIt} style={{ ...dark, flex: 1 }}>Print / Save PDF</button>
            <label style={{ ...plain, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              Colour
              <input type="color" value={accent || template.accent} onChange={(e) => setAccent(e.target.value)}
                style={{ width: 26, height: 22, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }} />
            </label>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-soft,#6b6459)', marginTop: 8, lineHeight: 1.5 }}>
            Previewing <strong>{size.label}</strong>. Print sizes export at 300 dpi; Save-as-PDF keeps the text vector, which is sharper still.
          </p>
        </div>
      </div>
    </div>
  )
}
