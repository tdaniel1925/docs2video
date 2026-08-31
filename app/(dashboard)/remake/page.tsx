'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FLYER_SIZES } from '../../_lib/flyer-engine'
import { useWizard } from '../design/useWizard'
import { downscaleDataUrl } from '../design/downscale'

/**
 * RESTYLEZ ENTRY — the remake starts here.
 *
 * One screen, three moves: upload the template you bought (or your own design),
 * confirm it's yours (the own-it gate — non-negotiable), press Remake. We seed
 * the proven wizard with the reference + the recreate flag and drop the user on
 * the Content step to add their words. The wizard, generator, results, and
 * editing are all shared — Restylez is a front door, not a second machine.
 *
 * ?deck=1 highlights the deck path (which lives on the wizard's Content step —
 * upload a .pptx/.pdf there and every slide is redrawn).
 */
const INK = '#23201C'
const SOFT = '#6b645a'
const LINE = '#e3ddd2'
const MINT = '#C7E8A8'

export default function RemakeEntry() {
  const { reset, patch, ready } = useWizard()
  const router = useRouter()
  const [img, setImg] = useState<{ dataUrl: string; name: string; w: number; h: number } | null>(null)
  const [owned, setOwned] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [deckFirst, setDeckFirst] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // ?deck=1 → the visitor came for the deck pitch; put that card on top.
    try { setDeckFirst(new URLSearchParams(window.location.search).get('deck') === '1') } catch { /* default order */ }
  }, [])

  const onFile = async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) { setErr('Upload a picture of the design — a JPG, PNG or screenshot.'); return }
    setErr(''); setBusy(true)
    try {
      const raw = await new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(String(r.result)); r.onerror = rej
        r.readAsDataURL(file)
      })
      const dataUrl = await downscaleDataUrl(raw, 1280)
      // Measure the shape so the remake comes out the SAME shape as the original.
      const dims = await new Promise<{ w: number; h: number }>((res, rej) => {
        const i = new Image()
        i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = rej
        i.src = dataUrl
      })
      setImg({ dataUrl, name: file.name, ...dims })
    } catch {
      setErr('Could not read that image — try a JPG or PNG.')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // The size whose shape best matches the uploaded design — a remake should
  // come back the same shape it went in. The user can still change it later.
  const nearestSize = (w: number, h: number): string => {
    const ar = w / h
    let best = FLYER_SIZES[0]
    let bestDiff = Infinity
    for (const s of FLYER_SIZES) {
      const diff = Math.abs(Math.log((s.w / s.h) / ar))
      if (diff < bestDiff) { bestDiff = diff; best = s }
    }
    return best.id
  }

  const startRemake = () => {
    if (!img || !owned || busy) return
    // A remake is a FRESH job: wipe any leftover wizard state, then seed it.
    reset()
    patch({
      kind: 'print',
      reference: { dataUrl: img.dataUrl, name: img.name },
      referenceOwned: true,       // confirmed by the checkbox below
      recreate: true,             // Restylez: exact remake, not style-inspired
      sizes: [nearestSize(img.w, img.h)],
    })
    try { sessionStorage.setItem('design:walking', String(Date.now())) } catch { /* reset guard tolerates absence */ }
    router.push('/design/content')
  }

  const startDeck = () => {
    reset()
    patch({ kind: 'deck' })
    try { sessionStorage.setItem('design:walking', String(Date.now())) } catch { /* fine */ }
    router.push('/design/content')
  }

  if (!ready) return null

  const card: React.CSSProperties = { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, padding: '22px 24px' }

  const graphicCard = (
    <div style={card}>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Remake a template or graphic</div>
      <p style={{ fontSize: 13.5, color: SOFT, lineHeight: 1.55, margin: '0 0 14px' }}>
        Upload a picture of the design — same layout, same style comes back, with your words and images swapped in.
      </p>

      {!img ? (
        <label onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void onFile(e.dataTransfer.files?.[0]) }}
          style={{ display: 'block', border: `1.5px dashed ${LINE}`, borderRadius: 10, padding: '30px 16px', textAlign: 'center', cursor: 'pointer', color: SOFT, fontSize: 13.5 }}>
          <div style={{ fontSize: 26, marginBottom: 6 }}>🖼️</div>
          <strong style={{ color: INK }}>{busy ? 'Reading it…' : 'Drop the design here'}</strong><br />
          {!busy && 'or click to pick a file — JPG, PNG or a screenshot'}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
      ) : (
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.dataUrl} alt="Your design" style={{ width: 160, borderRadius: 8, border: `1px solid ${LINE}`, display: 'block' }} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: INK, marginBottom: 8 }}>{img.name}</div>
            <button onClick={() => { setImg(null); setOwned(false) }}
              style={{ fontSize: 12.5, color: SOFT, background: 'none', border: `1px solid ${LINE}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Use a different picture
            </button>

            {/* THE OWN-IT GATE. Without it the remake never runs — the server
                enforces the same rule, this is just the honest front of it. */}
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={owned} onChange={(e) => setOwned(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18, cursor: 'pointer' }} />
              <span style={{ fontSize: 13, color: INK, lineHeight: 1.5 }}>
                <strong>This design is mine to use</strong> — I bought this template, or I made it.
              </span>
            </label>

            <button onClick={startRemake} disabled={!owned || busy}
              style={{ marginTop: 14, padding: '12px 22px', borderRadius: 10, border: 'none', background: INK, color: '#fff',
                fontSize: 14.5, fontWeight: 700, cursor: owned ? 'pointer' : 'default', opacity: owned ? 1 : 0.45, fontFamily: 'inherit' }}>
              Remake it with my stuff →
            </button>
          </div>
        </div>
      )}
      {err && <p role="alert" style={{ fontSize: 12.5, color: '#b91c1c', margin: '10px 0 0' }}>{err}</p>}
    </div>
  )

  const deckCard = (
    <div style={card}>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Restyle a whole deck</div>
      <p style={{ fontSize: 13.5, color: SOFT, lineHeight: 1.55, margin: '0 0 14px' }}>
        Upload a PowerPoint or PDF and every slide is redrawn to match — one consistent look, your words kept, back as images and a PDF.
      </p>
      <button onClick={startDeck}
        style={{ padding: '12px 22px', borderRadius: 10, border: `1px solid ${LINE}`, background: deckFirst ? INK : '#fff',
          color: deckFirst ? '#fff' : INK, fontSize: 14.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
        Start with my deck →
      </button>
    </div>
  )

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 64px', color: INK }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: SOFT, marginBottom: 10 }}>Restylez</div>
      <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 8px' }}>Remake it as yours</h1>
      <p style={{ fontSize: 15, color: SOFT, lineHeight: 1.6, margin: '0 0 24px', maxWidth: 560 }}>
        Upload the design, confirm it’s yours, add your words — we rebuild it exactly, with your content in place.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {deckFirst ? <>{deckCard}{graphicCard}</> : <>{graphicCard}{deckCard}</>}
      </div>

      <p style={{ fontSize: 12, color: SOFT, marginTop: 18, lineHeight: 1.5 }}>
        Restylez only remakes designs you own — bought templates or your own work. The confirmation above is required, every time.
        <span style={{ background: `${MINT}55`, borderRadius: 6, padding: '1px 6px', marginLeft: 6 }}>Same credits as any design.</span>
      </p>
    </div>
  )
}
