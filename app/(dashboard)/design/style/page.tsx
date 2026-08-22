'use client'

import { useState } from 'react'
import { VISIBLE_STYLES, thumbUrl } from '../../../_lib/flyer-engine'
import { useWizard } from '../useWizard'
import { guessRole } from '../guessRole'
import { downscaleDataUrl } from '../downscale'
import { INK, SOFT, LINE, MINT, card, plainBtn, StepShell } from '../ui'

const PAGE = 24

export default function StyleStep() {
  const { state, patch, ready } = useWizard()
  const [openStyles, setOpenStyles] = useState(false)
  const [shown, setShown] = useState(PAGE)
  const [guessing, setGuessing] = useState(false)
  // When picking a look ejects an uploaded reference (or vice versa), we say so
  // and offer Undo — the old behaviour cleared the other choice silently.
  const [ejected, setEjected] = useState<{ msg: string; restore: () => void } | null>(null)
  const flashEject = (msg: string, restore: () => void) => {
    setEjected({ msg, restore }); setTimeout(() => setEjected(null), 6000)
  }

  if (!ready) return null

  const readAsDataUrl = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = () => res(String(r.result))
      r.onerror = rej
      r.readAsDataURL(file)
    })

  // ONE box for all uploads. We guess logo vs photo for each, but the user can
  // flip any guess with a tap — so a headshot + a house photo + a logo can all
  // go in together and only the wrong guesses need a correction.
  const onDropAny = async (files: FileList | null) => {
    if (!files) return
    const imgs = [...files].filter((f) => f.type.startsWith('image/')).slice(0, 6)
    if (!imgs.length) return
    setGuessing(true)
    const added = await Promise.all(imgs.map(async (f) => {
      const raw = await readAsDataUrl(f)
      const role = await guessRole(raw)
      // Shrink for storage so a big logo/photo doesn't overflow localStorage
      // and get silently dropped between steps. Logos keep transparency (PNG).
      const dataUrl = await downscaleDataUrl(raw, role === 'logo' ? 900 : 1280)
      return { dataUrl, role, name: f.name }
    }))
    patch({ photos: [...state.photos, ...added].slice(0, 6) })
    setGuessing(false)
  }

  // A QR code always goes in as role 'qr' — it's pasted pixel-exact, never
  // guessed or redrawn.
  const onAddQr = async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return
    // A QR must stay crisp to scan, but 600px is plenty and keeps it storable.
    const dataUrl = await downscaleDataUrl(await readAsDataUrl(file), 600)
    patch({ photos: [...state.photos, { dataUrl, role: 'qr' as const, name: file.name }].slice(0, 6) })
  }

  // A logo/photo can be flipped between the two; a QR is never one of those.
  const flipRole = (i: number) =>
    patch({ photos: state.photos.map((p, j) => j === i ? { ...p, role: p.role === 'logo' ? 'person' : 'logo' } : p) })

  const removeImg = (i: number) =>
    patch({ photos: state.photos.filter((_, j) => j !== i) })

  const onReference = async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return
    // The reference is used for STYLE only, so a smaller copy is plenty — and it
    // MUST be small enough to persist, or it's lost on the way to the next step.
    const dataUrl = await downscaleDataUrl(await readAsDataUrl(file), 1280)
    // A reference and one of our styles can't both be used. If a style was
    // chosen, SAY it's being cleared and offer to undo — never silent.
    const prevStyle = state.templateId
    patch({ reference: { dataUrl, name: file.name }, referenceOwned: false, templateId: null })
    setOpenStyles(false)
    if (prevStyle) flashEject('Using your reference — the chosen style was cleared.', () => patch({ templateId: prevStyle, reference: null }))
  }
  const onReferencePaste = async (e: React.ClipboardEvent) => {
    const file = [...(e.clipboardData?.items ?? [])].find((it) => it.type.startsWith('image/'))?.getAsFile()
    if (file) { e.preventDefault(); await onReference(file) }
  }

  const pickStyle = (id: string) => {
    const prevRef = state.reference
    patch({ templateId: id, reference: null,
      aiSuggested: { ...state.aiSuggested, templateId: false } })
    if (prevRef) flashEject('Using this style — your uploaded reference was cleared.', () => patch({ reference: prevRef, templateId: null }))
  }

  const ready2 = Boolean(state.templateId) || Boolean(state.reference)
  const pickedName = VISIBLE_STYLES.find((t) => t.id === state.templateId)?.name ?? null

  return (
    <StepShell title="Choose your *look*"
      subtitle="Drop in a design you like and we’ll work in its style, or open our styles below. Add your logo and photos in the other box — we sort them out for you."
      back="/design"
      // A deck already has its words (from the upload), so skip the Content chat.
      next={state.deckSlides ? '/design/sizes' : '/design/content'}
      nextLabel={state.deckSlides ? 'Next: pick sizes' : 'Next: your words'}
      nextReady={ready2}
      nextHint="Drop a reference or pick one of our styles">

      {/* AI picked this look from your sentence — say so, and it's easy to change. */}
      {state.aiSuggested?.templateId && pickedName && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '6px 12px', borderRadius: 8, background: `${MINT}55`, border: `1px solid ${MINT}`, fontSize: 13, color: INK }}>
          <span>✨ Suggested look: <strong>{pickedName}</strong> — keep it or pick another below.</span>
        </div>
      )}

      {/* Reference↔style swap notice with Undo — never a silent clear. */}
      {ejected && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '9px 14px', borderRadius: 8, background: '#23201c', color: '#fff', fontSize: 13 }}>
          <span>{ejected.msg}</span>
          <button onClick={() => { ejected.restore(); setEjected(null) }}
            style={{ background: 'none', border: '1px solid rgba(255,255,255,.4)', color: '#fff', borderRadius: 6, padding: '3px 10px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5 }}>
            Undo
          </button>
        </div>
      )}

      <div className="t2a-style-cols" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>

        {/* BOX 1 — REFERENCE / STYLE */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: INK }}>The look</div>

          {state.reference ? (
            <>
              <img src={state.reference.dataUrl} alt="" style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 8, background: '#faf8f4' }} />
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: INK, cursor: 'pointer' }}>
                <input type="checkbox" checked={state.referenceOwned} onChange={(e) => patch({ referenceOwned: e.target.checked })} style={{ marginTop: 2 }} />
                <span>I own this artwork or have the right to use it. <span style={{ color: SOFT }}>(Leave unticked and we’ll take style inspiration only, never a close copy.)</span></span>
              </label>
              <button style={plainBtn} onClick={() => patch({ reference: null, referenceOwned: false })}>Remove reference</button>
            </>
          ) : (
            <label onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); void onReference(e.dataTransfer.files?.[0]) }}
              onPaste={onReferencePaste}
              style={{ display: 'block', border: `1.5px dashed ${LINE}`, borderRadius: 10, padding: '26px 16px', textAlign: 'center', cursor: 'pointer', color: SOFT, fontSize: 13, lineHeight: 1.55 }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>🎨</div>
              <strong style={{ color: INK }}>Drop or paste a design you like</strong><br />
              Grab an image from anywhere online and drop or paste it here — we’ll design in its <strong>style</strong>, not copy it.
              <input type="file" accept="image/*" hidden
                onChange={(e) => { void onReference(e.target.files?.[0]); e.target.value = '' }} />
            </label>
          )}

          {/* premade styles accordion */}
          <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 10 }}>
            <button onClick={() => setOpenStyles((v) => !v)} aria-expanded={openStyles}
              style={{ ...plainBtn, width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{state.templateId ? `Style: ${pickedName}` : 'Or choose one of our styles'}</span>
              <span style={{ color: SOFT }}>{openStyles ? '▲' : '▼'}</span>
            </button>
            {openStyles && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(96px,1fr))', gap: 8, maxHeight: 340, overflowY: 'auto', paddingRight: 4 }}>
                  {VISIBLE_STYLES.slice(0, shown).map((t) => (
                    <button key={t.id} onClick={() => pickStyle(t.id)} title={`The ${t.name} look`}
                      style={{ padding: 0, borderRadius: 9, overflow: 'hidden', cursor: 'pointer', background: '#111',
                        transition: 'box-shadow 180ms ease, border-color 180ms ease',
                        border: state.templateId === t.id ? `3px solid ${MINT}` : `1px solid ${LINE}` }}>
                      <img src={thumbUrl(t.id)} alt={t.name} loading="lazy"
                        style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', display: 'block' }} />
                      <div style={{ fontSize: 10, fontWeight: 700, padding: '3px 3px', background: 'white', color: INK,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                    </button>
                  ))}
                </div>
                {shown < VISIBLE_STYLES.length && (
                  <button style={{ ...plainBtn, marginTop: 10 }}
                    onClick={() => setShown((n) => Math.min(n + PAGE, VISIBLE_STYLES.length))}>
                    See more — {VISIBLE_STYLES.length - shown} left
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* BOX 2 — YOUR IMAGES (one box, auto-sorted) */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: INK }}>Your logo &amp; photos <span style={{ color: SOFT, fontWeight: 400, fontSize: 12 }}>(optional)</span></div>

          <label onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); void onDropAny(e.dataTransfer.files) }}
            style={{ display: 'block', border: `1.5px dashed ${LINE}`, borderRadius: 10, padding: '22px 16px', textAlign: 'center', cursor: 'pointer', color: SOFT, fontSize: 13, lineHeight: 1.55 }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>🖼️</div>
            <strong style={{ color: INK }}>Drop your logo and photos here</strong><br />
            Put them all in — a logo, a headshot, a photo of your place. We tell each one apart; fix any we get wrong with a tap.
            <input type="file" accept="image/*" multiple hidden
              onChange={(e) => { void onDropAny(e.target.files); e.target.value = '' }} />
          </label>

          {/* QR CODE — a separate button because a QR must be placed pixel-exact
              (never redrawn), so it's tagged 'qr' and pasted as-is on the design. */}
          <label style={{ ...plainBtn, display: 'inline-block' }}>
            Add a QR code
            <input type="file" accept="image/*" hidden
              onChange={(e) => { void onAddQr(e.target.files?.[0]); e.target.value = '' }} />
          </label>

          {guessing && <div style={{ fontSize: 12.5, color: SOFT }}>Sorting your images…</div>}

          {state.photos.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {state.photos.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 6, border: `1px solid ${LINE}`, borderRadius: 9 }}>
                  <img src={p.dataUrl} alt="" style={{ width: 46, height: 46, flexShrink: 0, objectFit: p.role === 'person' ? 'cover' : 'contain', background: p.role === 'person' ? undefined : '#fff', borderRadius: 6, border: `1px solid ${LINE}` }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: INK, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'white', background: p.role === 'logo' ? '#2E7D32' : p.role === 'qr' ? '#4A3B8A' : INK, borderRadius: 4, padding: '2px 5px' }}>{p.role === 'logo' ? 'Logo' : p.role === 'qr' ? 'QR' : 'Photo'}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name ?? 'image'}</span>
                    </div>
                    {p.role !== 'qr' && (
                      <button onClick={() => flipRole(i)} style={{ marginTop: 3, background: 'none', border: 'none', padding: 0, color: SOFT, fontSize: 11.5, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
                        Not a {p.role === 'logo' ? 'logo' : 'photo'}? Mark it a {p.role === 'logo' ? 'photo' : 'logo'}
                      </button>
                    )}
                  </div>
                  <button onClick={() => removeImg(i)} aria-label="Remove"
                    style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 11, border: 'none', background: LINE, color: INK, fontSize: 13, cursor: 'pointer', lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          )}

          <p style={{ fontSize: 11.5, color: SOFT, margin: 0, lineHeight: 1.5, background: `${MINT}44`, padding: '8px 10px', borderRadius: 8 }}>
            A <strong style={{ color: INK }}>logo</strong> or <strong style={{ color: INK }}>QR code</strong> is placed exactly as given — never redrawn (so a QR still scans). A <strong style={{ color: INK }}>photo</strong> of a person becomes the featured subject.
          </p>
        </div>
      </div>
      <style>{`@media (max-width: 720px) { .t2a-style-cols { grid-template-columns: 1fr !important; } }`}</style>
    </StepShell>
  )
}
