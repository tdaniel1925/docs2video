'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWizard } from '../useWizard'
import { INK, SOFT, LINE, card, plainBtn, primaryBtn, StepShell } from '../ui'

type Design = { id: string; sizeId: string; label: string; w: number; h: number; url: string; src?: string }

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
  const { state, reset, ready } = useWizard()
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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const drawing = useRef(false)

  useEffect(() => {
    if (!ready) return
    if (!state.roundId) { setLoading(false); return }
    // Scope the fetch to THIS job's chat. Unscoped, history returns the most
    // recent chat's rounds — never ours — so our design would be invisible even
    // though it was made and saved.
    const url = state.chatId ? `/api/flyer-history?chat=${state.chatId}` : '/api/flyer-history'
    fetch(url).then((r) => r.json()).then((r) => {
      const round = (r.rounds ?? []).find((x: { id: string }) => x.id === state.roundId)
      const ds: Design[] = round?.designs ?? []
      setDesigns(ds)
      setSelected(ds[0] ?? null)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [ready, state.roundId])

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

  if (loading) {
    return <StepShell title="Your designs"><p style={{ color: SOFT }}>Loading your designs…</p></StepShell>
  }
  if (!designs.length) {
    return (
      <StepShell title="Nothing to show yet"
        subtitle="This step shows the designs you made — go back and generate them first.">
        <button style={primaryBtn} onClick={() => router.push('/design/make')}>&larr; Back to sizes</button>
      </StepShell>
    )
  }

  return (
    <StepShell title="Your designs — edit any part"
      subtitle="Click a design to open it. To change one part, press “Edit a part”, paint over it, and say what to change — only that part is redrawn.">

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 200px', gap: 24, alignItems: 'start' }}>
        {/* PREVIEW + EDITOR */}
        <div>
          <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
            <img ref={imgRef} src={shown} alt={selected?.label} onLoad={sizeCanvas}
              style={{ maxWidth: '100%', maxHeight: '62vh', borderRadius: 10, background: '#111', display: 'block' }} />
            <canvas ref={canvasRef}
              onPointerDown={(e) => { if (!brushing) return; drawing.current = true; paintAt(e) }}
              onPointerMove={(e) => { if (brushing && drawing.current) paintAt(e) }}
              onPointerUp={() => { drawing.current = false }}
              onPointerLeave={() => { drawing.current = false }}
              style={{ position: 'absolute', inset: 0, borderRadius: 10,
                pointerEvents: brushing ? 'auto' : 'none', cursor: brushing ? 'crosshair' : 'default', touchAction: 'none' }} />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {!brushing ? (
              <button style={plainBtn} onClick={() => setBrushing(true)}>Edit a part</button>
            ) : (
              <button style={plainBtn} onClick={() => { clearBrush(); setBrushing(false); setProblem('') }}>Cancel edit</button>
            )}
            {shown && <a href={shown} download={`${selected?.label || 'design'}.png`} style={{ ...plainBtn, textDecoration: 'none' }}>Download</a>}
          </div>

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

        {/* THE OTHER SIZES — its own scroll so a long list never runs off the page */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '72vh', overflowY: 'auto', paddingRight: 4 }}>
          {designs.map((d) => (
            <button key={d.id} onClick={() => { setSelected(d); clearBrush(); setBrushing(false); setProblem('') }}
              style={{ padding: 4, borderRadius: 9, cursor: 'pointer', background: 'white',
                border: (selected?.id === d.id) ? `2px solid ${INK}` : `1px solid ${LINE}` }}>
              <img src={d.src ?? d.url} alt={d.label} style={{ width: '100%', borderRadius: 6, display: 'block' }} />
              <div style={{ fontSize: 11, color: SOFT, padding: '4px 2px 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
        <button style={plainBtn} onClick={() => router.push('/design/make')}>&larr; Make more sizes</button>
        <button style={primaryBtn} onClick={() => { reset(); router.push('/design') }}>Start another design</button>
      </div>
    </StepShell>
  )
}
