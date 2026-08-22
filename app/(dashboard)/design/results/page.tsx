'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FLYER_SIZES } from '../../../_lib/flyer-engine'
import { useWizard } from '../useWizard'
import { INK, SOFT, LINE, card, plainBtn, primaryBtn, StepShell } from '../ui'

type Design = { id: string; sizeId: string; label: string; w: number; h: number; url: string; src?: string }

/**
 * The size/format NAME to show, so the user always knows what each design is
 * for. The stored label can be the design's own headline text (not a size), so
 * we prefer the real size name looked up from the engine by sizeId, and fall
 * back to the stored label only if the id is unknown.
 */
const sizeName = (d: Design): string =>
  FLYER_SIZES.find((s) => s.id === d.sizeId)?.label ?? d.label ?? 'Design'

/**
 * STEP 4 — SEE AND SPOT-EDIT.
 *
 * The designs the round produced, and a big preview of the selected one with
 * the same paint-a-region editor the /flyer modal has — lifted onto its own
 * page so there is room to work. Draw over a part, say the change, and
 * /api/flyer-edit repaints ONLY that region and saves a NEW version (the old
 * one is never lost). The mask convention is the API's: opaque = keep,
 * transparent = may repaint, built explicitly here.
 */
export default function EditStep() {
  const { state, reset, clearInputsKeepJob, patch, ready } = useWizard()
  const router = useRouter()
  const [designs, setDesigns] = useState<Design[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Design | null>(null)

  // editor state
  const [brushing, setBrushing] = useState(false)
  const [painted, setPainted] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [working, setWorking] = useState(false)
  const [problem, setProblem] = useState('')
  const [shared, setShared] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)
  // place-an-image (logo/QR) mode
  const [placing, setPlacing] = useState<null | 'logo' | 'qr'>(null)
  const [overlayUrl, setOverlayUrl] = useState('')
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const overlayFileRef = useRef<HTMLInputElement>(null)
  const drawing = useRef(false)

  useEffect(() => {
    if (!ready) return
    // A walk that reached results is OVER. Clear the in-progress mark so the
    // next time the user opens Step 1 (e.g. via the nav) it resets to a clean
    // slate instead of showing this job's leftover words.
    try { sessionStorage.removeItem('design:walking') } catch { /* ignore */ }
    // Need at least a job pointer: the round we made, OR the chat it lives in
    // (the Library "Edit again" deep-link seeds the chat but not a round).
    if (!state.roundId && !state.chatId) { setLoading(false); return }
    // Scope the fetch to THIS job's chat. Unscoped, history returns the most
    // recent chat's rounds — never ours — so our design would be invisible even
    // though it was made and saved.
    // A Library reopen hands us a chat but no round (openedFromLibrary). In that
    // case we must NOT wipe inputs — we RESTORE them, so "Make more sizes" has
    // the words and look to redraw with. A freshly-finished job (we have the
    // roundId) still clears, as before.
    const fromLibrary = !state.roundId && !!state.chatId
    const url = state.chatId ? `/api/flyer-history?chat=${state.chatId}` : '/api/flyer-history'
    fetch(url).then((r) => r.json()).then((r) => {
      const rounds = (r.rounds ?? []) as { id: string; designs?: Design[]; fields?: Record<string, unknown>; templateId?: string }[]
      // Prefer the round we made; otherwise fall back to the newest round with
      // designs in this chat — that's what "reopen this job to edit" means when
      // the library only handed us the project.
      const round = rounds.find((x) => x.id === state.roundId)
        ?? [...rounds].reverse().find((x) => (x.designs?.length ?? 0) > 0)
      const ds: Design[] = round?.designs ?? []
      setDesigns(ds)
      setSelected(ds[0] ?? null)
      if (fromLibrary && round) {
        // Bring the job's words, look and sizes back into the wizard so the
        // "Make more sizes" button redraws the SAME design in new sizes instead
        // of an empty one. roundId is set too, so this page keeps working.
        const sizes = [...new Set(ds.map((d) => d.sizeId).filter(Boolean))]
        patch({
          roundId: round.id,
          fields: (round.fields as typeof state.fields) ?? state.fields,
          templateId: round.templateId ?? state.templateId,
          sizes: sizes.length ? sizes : state.sizes,
        })
      } else if (ds.length) {
        // A just-made job: wipe the reusable inputs so the NEXT design starts
        // empty — no leftovers pretending to belong to it. Keeps the round
        // pointer so this page keeps working.
        clearInputsKeepJob()
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [ready, state.roundId, state.chatId])

  if (!ready) return null

  const sizeCanvas = () => {
    const c = canvasRef.current, i = imgRef.current
    if (!c || !i) return
    c.width = i.clientWidth; c.height = i.clientHeight
  }
  const paintAt = (e: React.PointerEvent) => {
    const c = canvasRef.current
    if (!c) return
    const r = c.getBoundingClientRect()
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = 'rgba(255,90,60,0.55)'
    ctx.beginPath()
    ctx.arc(e.clientX - r.left, e.clientY - r.top, Math.max(14, c.width * 0.045), 0, Math.PI * 2)
    ctx.fill()
    setPainted(true)
  }
  const clearBrush = () => {
    const c = canvasRef.current
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height)
    setPainted(false)
  }
  const buildMask = (): string | null => {
    const c = canvasRef.current
    if (!c) return null
    const out = document.createElement('canvas')
    out.width = c.width; out.height = c.height
    const ctx = out.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, out.width, out.height)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.drawImage(c, 0, 0)
    return out.toDataURL('image/png')
  }

  // Start placing a logo/QR: pick the file, then the user clicks where it goes.
  const startPlace = (role: 'logo' | 'qr') => {
    setBrushing(false); clearBrush(); setProblem(''); setSpot(null); setOverlayUrl('')
    setPlacing(role)
    overlayFileRef.current?.click()
  }
  const onOverlayFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) { setPlacing(null); return }
    const r = new FileReader()
    r.onload = () => setOverlayUrl(String(r.result))
    r.readAsDataURL(file)
  }
  // Click on the preview → record where (as a fraction of the design).
  const pickSpot = (e: React.PointerEvent) => {
    if (!placing || !overlayUrl) return
    const el = imgRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setSpot({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height })
  }
  // Paste it exactly (no AI) at the chosen spot.
  const applyPlace = async () => {
    if (!selected || !overlayUrl || !spot) return
    setProblem(''); setWorking(true)
    try {
      const res = await fetch('/api/flyer-edit', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          designId: selected.id, overlayDataUrl: overlayUrl, overlayRole: placing,
          x: spot.x, y: spot.y, w: placing === 'qr' ? 0.16 : 0.2,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.png) { setProblem(data?.error || 'That could not be placed.'); return }
      const updated = { ...selected, id: data.designId ?? selected.id, src: data.png }
      setSelected(updated)
      setDesigns((ds) => ds.map((d) => (d.id === selected.id ? updated : d)))
      setPlacing(null); setOverlayUrl(''); setSpot(null)
    } catch {
      setProblem('Network error — you were not charged.')
    } finally {
      setWorking(false)
    }
  }

  const applyChange = async () => {
    if (!selected) return
    if (!instruction.trim()) { setProblem('Say what should change in the area you painted.'); return }
    const maskDataUrl = buildMask()
    if (!maskDataUrl || !painted) { setProblem('Paint over the part you want changed first.'); return }
    setProblem(''); setWorking(true)
    try {
      const res = await fetch('/api/flyer-edit', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ designId: selected.id, maskDataUrl, instruction }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.png) { setProblem(data?.error || 'That change could not be made.'); return }
      const updated = { ...selected, id: data.designId ?? selected.id, src: data.png }
      setSelected(updated)
      setDesigns((ds) => ds.map((d) => (d.id === selected.id ? updated : d)))
      clearBrush(); setBrushing(false); setInstruction('')
    } catch {
      setProblem('Network error — you were not charged.')
    } finally {
      setWorking(false)
    }
  }

  const shown = selected?.src ?? selected?.url

  // A deck's designs are the restyled slides — offer them stitched into one PDF.
  const isDeck = designs.length > 1 && designs.every((d) => /^slide-\d+$/.test(d.sizeId))

  // Build a landscape PDF, one page per slide, in order — client-side (pdf-lib).
  const downloadPdf = async () => {
    if (pdfBusy) return
    setPdfBusy(true)
    try {
      const { PDFDocument } = await import('pdf-lib')
      const pdf = await PDFDocument.create()
      // designs are already in slide order (round.designs order preserved).
      for (const d of designs) {
        const href = d.src ?? d.url
        const ab = await fetch(href).then((r) => r.arrayBuffer())
        const head = new Uint8Array(ab.slice(0, 2))
        // Our slides are PNG; fall back to JPG if the byte header says so.
        const img = head[0] === 0xff && head[1] === 0xd8
          ? await pdf.embedJpg(ab)
          : await pdf.embedPng(ab)
        const page = pdf.addPage([img.width, img.height])
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
      }
      const out = await pdf.save()
      // Wrap in a fresh ArrayBuffer so TS/Blob is happy about the byte source.
      const buf = new ArrayBuffer(out.byteLength)
      new Uint8Array(buf).set(out)
      const url = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url; a.download = 'deck.pdf'
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setShared('Could not build the PDF — you can still download the slides one by one.')
      setTimeout(() => setShared(''), 5000)
    } finally {
      setPdfBusy(false)
    }
  }

  // Save one image to the user's device. Fetch to a blob first so the browser
  // downloads it instead of navigating to it (cross-origin URLs ignore the
  // `download` attribute otherwise).
  const downloadOne = async (d: Design) => {
    const href = d.src ?? d.url
    try {
      const blob = await fetch(href).then((r) => r.blob())
      const u = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = u; a.download = `${d.label || 'design'}.png`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(u)
    } catch {
      window.open(href, '_blank')
    }
  }
  // Download every size, one after another (a small gap so browsers don't block
  // the burst as a popup).
  const downloadAll = async () => {
    for (const d of designs) { await downloadOne(d); await new Promise((r) => setTimeout(r, 350)) }
  }

  // Share the selected design. Native share sheet where it exists (phones), else
  // copy the image link to the clipboard as a friendly fallback. (`shared` state
  // is declared with the other hooks at the top — never after an early return.)
  const shareOne = async () => {
    if (!selected) return
    const href = selected.src ?? selected.url
    const abs = href.startsWith('http') ? href : `${location.origin}${href}`
    try {
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean }
      if (typeof navigator.share === 'function') {
        // Try sharing the actual file; fall back to the link.
        try {
          const blob = await fetch(href).then((r) => r.blob())
          const file = new File([blob], `${selected.label || 'design'}.png`, { type: blob.type })
          if (nav.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'My design' }); return }
        } catch { /* fall through to link share */ }
        await navigator.share({ title: 'My design', url: abs }); return
      }
      await navigator.clipboard.writeText(abs)
      setShared('Link copied — paste it into an email or a post.')
      setTimeout(() => setShared(''), 4000)
    } catch {
      setShared('Could not open sharing — use Download instead.')
      setTimeout(() => setShared(''), 4000)
    }
  }

  if (loading) {
    return <StepShell title="Your designs"><p style={{ color: SOFT }}>Loading your designs…</p></StepShell>
  }
  if (!designs.length) {
    return (
      <StepShell title="Nothing to show yet"
        subtitle="This step shows the designs you made — go back and generate them first.">
        <button style={primaryBtn} onClick={() => router.push('/design/summary')}>&larr; Back to review</button>
      </StepShell>
    )
  }

  return (
    <StepShell title="Your designs — download, share, or edit any part"
      subtitle="Click a design to open it. Download one or all, share it, or press “Edit a part” to change just one region.">

      {/* TOP ACTIONS — download all + share, always in reach */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <button style={primaryBtn} onClick={downloadAll}>
          Download all {designs.length > 1 ? `(${designs.length})` : ''}
        </button>
        {isDeck && (
          <button style={plainBtn} onClick={downloadPdf} disabled={pdfBusy}>
            {pdfBusy ? 'Building PDF…' : 'Download as PDF'}
          </button>
        )}
        <button style={plainBtn} onClick={shareOne}>Share</button>
        {shared && <span style={{ fontSize: 12.5, color: SOFT }}>{shared}</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 200px', gap: 24, alignItems: 'start' }}>
        {/* PREVIEW + EDITOR */}
        <div>
          {/* which size/format this is — so the preview is never ambiguous */}
          {selected && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: INK }}>{sizeName(selected)}</span>
              {selected.w > 0 && selected.h > 0 && (
                <span style={{ fontSize: 12.5, color: SOFT }}>{selected.w.toLocaleString()} × {selected.h.toLocaleString()} px</span>
              )}
            </div>
          )}
          <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
            <img ref={imgRef} src={shown} alt={selected?.label} onLoad={sizeCanvas}
              style={{ maxWidth: '100%', maxHeight: '62vh', borderRadius: 10, background: '#111', display: 'block' }} />
            <canvas ref={canvasRef}
              onPointerDown={(e) => { if (placing && overlayUrl) { pickSpot(e); return } if (!brushing) return; drawing.current = true; paintAt(e) }}
              onPointerMove={(e) => { if (brushing && drawing.current) paintAt(e) }}
              onPointerUp={() => { drawing.current = false }}
              onPointerLeave={() => { drawing.current = false }}
              style={{ position: 'absolute', inset: 0, borderRadius: 10,
                pointerEvents: (brushing || (placing && overlayUrl)) ? 'auto' : 'none',
                cursor: brushing ? 'crosshair' : (placing && overlayUrl) ? 'copy' : 'default', touchAction: 'none' }} />
            {/* where the logo/QR will land */}
            {placing && overlayUrl && spot && (
              <img src={overlayUrl} alt="" style={{ position: 'absolute', left: `${spot.x * 100}%`, top: `${spot.y * 100}%`,
                width: `${(placing === 'qr' ? 16 : 20)}%`, border: '2px solid #C0392B', borderRadius: 4, pointerEvents: 'none',
                background: placing === 'qr' ? '#fff' : 'transparent' }} />
            )}
          </div>
          <input ref={overlayFileRef} type="file" accept="image/*" hidden
            onChange={(e) => { onOverlayFile(e.target.files?.[0]); e.target.value = '' }} />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {!brushing && !placing ? (
              <button style={plainBtn} onClick={() => setBrushing(true)}>Edit a part</button>
            ) : brushing ? (
              <button style={plainBtn} onClick={() => { clearBrush(); setBrushing(false); setProblem('') }}>Cancel edit</button>
            ) : null}
            {!brushing && !placing && <button style={plainBtn} onClick={() => startPlace('qr')}>Add a QR code</button>}
            {!brushing && !placing && <button style={plainBtn} onClick={() => startPlace('logo')}>Add a logo</button>}
            {placing && <button style={plainBtn} onClick={() => { setPlacing(null); setOverlayUrl(''); setSpot(null); setProblem('') }}>Cancel</button>}
            {selected && <button style={plainBtn} onClick={() => downloadOne(selected)}>Download this one</button>}
          </div>

          {/* PLACE A QR / LOGO — click the design, then confirm. No AI: pasted exact. */}
          {placing && (
            <div style={{ ...card, marginTop: 12, width: 'min(560px,100%)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, color: INK }}>
                {!overlayUrl ? `Pick your ${placing === 'qr' ? 'QR code' : 'logo'} image` : !spot ? `Click on the design where the ${placing === 'qr' ? 'QR code' : 'logo'} should go` : 'Looks right? Place it.'}
              </div>
              <p style={{ fontSize: 12.5, color: SOFT, margin: '0 0 10px', lineHeight: 1.5 }}>
                It’s pasted exactly as your file — never redrawn{placing === 'qr' ? ', so the QR still scans' : ''}. Placing it costs one design.
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {!overlayUrl && <button style={plainBtn} onClick={() => overlayFileRef.current?.click()}>Choose file</button>}
                <button onClick={applyPlace} disabled={working || !overlayUrl || !spot}
                  style={{ ...primaryBtn, padding: '9px 16px', opacity: working || !overlayUrl || !spot ? 0.5 : 1 }}>
                  {working ? 'Placing…' : 'Place it'}
                </button>
              </div>
              {problem && <p style={{ fontSize: 12.5, color: '#B4432F', margin: '8px 0 0' }}>{problem}</p>}
            </div>
          )}

          {brushing && (
            <div style={{ ...card, marginTop: 12, width: 'min(560px,100%)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, color: INK }}>
                {painted ? 'What should change there?' : 'Paint over the part you want changed'}
              </div>
              <p style={{ fontSize: 12.5, color: SOFT, margin: '0 0 10px', lineHeight: 1.5 }}>
                Cover the whole thing, not just its outline — everything you leave unpainted stays exactly as it is. A change costs one design.
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <input value={instruction} onChange={(e) => setInstruction(e.target.value)}
                  placeholder="e.g. make the price $25"
                  style={{ flex: 1, minWidth: 200, padding: '9px 11px', borderRadius: 8, border: `1px solid ${LINE}`, font: 'inherit', fontSize: 14 }} />
                <button onClick={applyChange} disabled={working || !painted}
                  style={{ ...primaryBtn, padding: '9px 16px', opacity: working || !painted ? 0.5 : 1 }}>
                  {working ? 'Changing…' : 'Change it'}
                </button>
              </div>
              {problem && <p style={{ fontSize: 12.5, color: '#B4432F', margin: '8px 0 0' }}>{problem}</p>}
            </div>
          )}
        </div>

        {/* THE OTHER SIZES — its own scroll so a long list never runs off the page.
            Each shows a Download link so any one size can be saved on its own. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '72vh', overflowY: 'auto', paddingRight: 4 }}>
          {designs.map((d) => (
            <div key={d.id} style={{ borderRadius: 9, background: 'white', border: (selected?.id === d.id) ? `2px solid ${INK}` : `1px solid ${LINE}`, overflow: 'hidden' }}>
              <button onClick={() => { setSelected(d); clearBrush(); setBrushing(false); setProblem('') }}
                style={{ display: 'block', width: '100%', padding: 4, border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <img src={d.src ?? d.url} alt={sizeName(d)} style={{ width: '100%', borderRadius: 6, display: 'block' }} />
                <div style={{ fontSize: 11, fontWeight: 700, color: INK, padding: '4px 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sizeName(d)}</div>
              </button>
              <button onClick={() => downloadOne(d)}
                style={{ width: '100%', border: 'none', borderTop: `1px solid ${LINE}`, background: 'transparent', color: INK, fontSize: 11.5, fontWeight: 700, padding: '6px 4px', cursor: 'pointer', fontFamily: 'inherit' }}>
                ↓ Download
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
        <button style={plainBtn} onClick={() => router.push('/design/summary')}>&larr; Make more sizes</button>
        <button style={primaryBtn} onClick={() => { reset(); router.push('/design') }}>Start another design</button>
      </div>
    </StepShell>
  )
}
