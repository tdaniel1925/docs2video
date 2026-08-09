'use client'

// =============================================================================
// Flyer maker — PROOF OF CONCEPT.
//
// Chat on the left, live artboard on the right. Say what you want, watch it
// assemble. Pick artwork from a wall of options, ask for more, keep talking.
//
// The preview is the REAL renderer in an iframe, not a mock-up — what is on
// screen is exactly what prints, because it is the same HTML. "Print / Save
// PDF" opens that same document with a real @page at the artboard's true inch
// size, so the browser's own PDF export produces a print-ready file with live
// vector text. No screenshot, no resolution ceiling, no server render.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import { FLYER_LAYOUTS, FLYER_SIZES, renderFlyer, type FlyerFields } from '../../_lib/flyer'

type Msg = { role: 'user' | 'assistant'; text: string }

const CATEGORIES = [
  { id: 'nightlife', label: 'Nightlife & events' },
  { id: 'business', label: 'Business' },
  { id: 'community', label: 'Community' },
  { id: 'realestate', label: 'Real estate' },
  { id: 'fitness', label: 'Fitness' },
] as const

export default function FlyerMakerPage() {
  const [msgs, setMsgs] = useState<Msg[]>([{
    role: 'assistant',
    text: 'Tell me what you need. Something like: "design a flyer 8.5 by 11 for a club night on Saturday".',
  }])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const [fields, setFields] = useState<FlyerFields>({})
  const [layoutId, setLayoutId] = useState('bleed-bottom')
  const [sizeId, setSizeId] = useState('letter')
  const [accent, setAccent] = useState('#C0392B')
  const [subject, setSubject] = useState('')

  const [category, setCategory] = useState<string>('nightlife')
  const [art, setArt] = useState<string[]>([])
  const [chosenArt, setChosenArt] = useState<string | null>(null)
  const [artBusy, setArtBusy] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => { scrollRef.current?.scrollTo({ top: 9e9, behavior: 'smooth' }) }, [msgs, busy])

  const layout = useMemo(() => FLYER_LAYOUTS.find((l) => l.id === layoutId) ?? FLYER_LAYOUTS[0], [layoutId])
  const size = useMemo(() => FLYER_SIZES.find((s) => s.id === sizeId) ?? FLYER_SIZES[0], [sizeId])

  const html = useMemo(
    () => renderFlyer({ layout, size, fields, artUrl: chosenArt, accent }),
    [layout, size, fields, chosenArt, accent]
  )

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    setInput(''); setErr('')
    setMsgs((m) => [...m, { role: 'user', text }])
    setBusy(true)
    const r = await fetch('/api/flyer-chat', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: text, fields, layoutId, sizeId, history: msgs.slice(-6) }),
    }).then((x) => x.json()).catch(() => ({ error: 'Network error' }))
    setBusy(false)
    if (r?.error) { setErr(r.error); return }
    setFields(r.fields ?? {})
    setLayoutId(r.layoutId ?? layoutId)
    setSizeId(r.sizeId ?? sizeId)
    if (r.subject) setSubject(r.subject)
    setMsgs((m) => [...m, { role: 'assistant', text: r.reply || 'Updated.' }])
    // First real message — go get artwork so the wall isn't empty when they look.
    if (r.subject && !art.length) loadArt(r.subject, r.layoutId ?? layoutId)
  }

  const loadArt = async (subj?: string, lid?: string) => {
    if (artBusy) return
    setArtBusy(true); setErr('')
    const r = await fetch('/api/flyer-art', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject: subj ?? subject, layoutId: lid ?? layoutId, accent, count: 6 }),
    }).then((x) => x.json()).catch(() => ({ error: 'Network error' }))
    setArtBusy(false)
    if (r?.error) { setErr(r.error); return }
    setArt((prev) => [...(r.art ?? []), ...prev].slice(0, 24))
    if (!chosenArt && r.art?.[0]) setChosenArt(r.art[0])
  }

  const printIt = () => {
    const doc = renderFlyer({ layout, size, fields, artUrl: chosenArt, accent, print: true })
    const w = window.open('', '_blank')
    if (!w) { setErr('Allow pop-ups to print.'); return }
    w.document.write(doc)
    w.document.close()
    // Wait for fonts and the background image, or the PDF prints half-dressed.
    w.onload = () => setTimeout(() => w.print(), 700)
  }

  const S = {
    panel: { background: 'white', border: '1px solid var(--border-light, #e5e0d8)', borderRadius: 10, padding: 14 } as const,
    btn: { padding: '9px 15px', borderRadius: 8, border: '1px solid var(--border, #ddd6cc)', background: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink, #23201c)' } as const,
    btnDark: { padding: '9px 15px', borderRadius: 8, border: 'none', background: 'var(--ink, #23201c)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' } as const,
  }

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '22px 20px 60px' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 26 }}>Flyer maker</h1>
      <p style={{ color: 'var(--ink-soft, #6b6459)', margin: '0 0 20px', fontSize: 14 }}>
        Say what you want. The artwork is generated; the words are typeset — so they print sharp and spelled right.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(300px, 460px)', gap: 20, alignItems: 'start' }}>
        {/* ── LEFT: chat + art picker ─────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={S.panel}>
            <div ref={scrollRef} style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              {msgs.map((m, i) => (
                <div key={i} style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%', padding: '9px 13px', borderRadius: 12, fontSize: 14, lineHeight: 1.45,
                  background: m.role === 'user' ? 'var(--ink, #23201c)' : 'var(--cream, #F4F1EC)',
                  color: m.role === 'user' ? 'white' : 'inherit',
                }}>{m.text}</div>
              ))}
              {busy && <div style={{ fontSize: 13, color: 'var(--ink-soft, #6b6459)' }}>Working…</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') send() }}
                disabled={busy}
                placeholder='e.g. "doors at 9, $20 cover, DJ Sable headlining"'
                style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border, #ddd6cc)', font: 'inherit', fontSize: 14 }}
              />
              <button onClick={send} disabled={busy || !input.trim()} style={{ ...S.btnDark, opacity: busy || !input.trim() ? 0.6 : 1 }}>Send</button>
            </div>
            {err && <p style={{ color: '#B4432F', fontSize: 13, marginTop: 8 }}>{err}</p>}
          </div>

          <div style={S.panel}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {CATEGORIES.map((c) => (
                <button key={c.id} onClick={() => {
                  setCategory(c.id)
                  const first = FLYER_LAYOUTS.find((l) => l.category === c.id)
                  if (first) setLayoutId(first.id)
                }} style={{ ...S.btn, padding: '6px 11px', fontSize: 12, ...(category === c.id ? { background: 'var(--ink, #23201c)', color: 'white', borderColor: 'transparent' } : {}) }}>
                  {c.label}
                </button>
              ))}
            </div>

            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-soft, #6b6459)' }}>Layout</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '7px 0 14px' }}>
              {FLYER_LAYOUTS.filter((l) => l.category === category).map((l) => (
                <button key={l.id} onClick={() => setLayoutId(l.id)}
                  style={{ ...S.btn, padding: '6px 11px', fontSize: 12, ...(layoutId === l.id ? { borderColor: 'var(--ink, #23201c)', borderWidth: 2 } : {}) }}>
                  {l.name}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
              <select value={sizeId} onChange={(e) => setSizeId(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border, #ddd6cc)', font: 'inherit', fontSize: 13 }}>
                {FLYER_SIZES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13 }}>
                Accent
                <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)}
                  style={{ width: 34, height: 30, border: '1px solid var(--border, #ddd6cc)', borderRadius: 6, padding: 2, background: 'white' }} />
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-soft, #6b6459)' }}>Artwork</label>
              <button onClick={() => loadArt()} disabled={artBusy} style={{ ...S.btn, padding: '5px 10px', fontSize: 12 }}>
                {artBusy ? 'Generating…' : art.length ? 'Show 6 more' : 'Generate artwork'}
              </button>
            </div>
            {art.length === 0 && !artBusy && (
              <p style={{ fontSize: 13, color: 'var(--ink-soft, #6b6459)', margin: 0 }}>
                Describe the flyer first, then artwork appears here. In production these come from a pre-made library, so they load instantly.
              </p>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 7 }}>
              {art.map((a, i) => (
                <button key={i} onClick={() => setChosenArt(a)} title="Use this artwork"
                  style={{ padding: 0, border: chosenArt === a ? '3px solid var(--ink, #23201c)' : '1px solid var(--border, #ddd6cc)', borderRadius: 7, overflow: 'hidden', cursor: 'pointer', aspectRatio: '3/4', background: '#eee' }}>
                  <img src={a} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT: the real artboard ────────────────────────────────── */}
        <div style={{ position: 'sticky', top: 16 }}>
          <div style={{ ...S.panel, padding: 10 }}>
            {/* The iframe holds the actual renderer output, scaled to fit.
                What you see is what prints — same document either way. */}
            <div style={{ width: '100%', aspectRatio: `${size.w} / ${size.h}`, background: '#2a2a2e', borderRadius: 6, overflow: 'hidden' }}>
              <iframe
                title="Flyer preview" srcDoc={html}
                style={{
                  width: `${size.w * 96}px`, height: `${size.h * 96}px`, border: 0,
                  transform: `scale(${1 / (size.w * 96 / 420)})`, transformOrigin: 'top left',
                  // 420 is the column width the artboard is scaled into.
                }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={printIt} style={{ ...S.btnDark, flex: 1 }}>Print / Save PDF</button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-soft, #6b6459)', marginTop: 8, lineHeight: 1.5 }}>
            Prints at {size.w} × {size.h} in. The text stays vector in the PDF — sharp at any size, which is what a commercial printer wants.
          </p>
        </div>
      </div>
    </div>
  )
}
