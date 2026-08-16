'use client'

import { useMemo, useState } from 'react'
import { VISIBLE_STYLES, thumbUrl } from '../../../_lib/flyer-engine'
import { useWizard } from '../useWizard'
import { INK, SOFT, LINE, card, plainBtn, StepShell } from '../ui'

// A handful to start; "see more" reveals the rest. Phase 3 will add the one
// smart image box (logo/photo auto-guess) and the own-it reference checkbox.
const PAGE = 24

export default function StyleStep() {
  const { state, patch, ready } = useWizard()
  const [shown, setShown] = useState(PAGE)

  const picked = state.templateId
  const styleName = useMemo(
    () => VISIBLE_STYLES.find((t) => t.id === picked)?.name ?? null,
    [picked],
  )

  if (!ready) return null

  const readAsDataUrl = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = () => res(String(r.result))
      r.onerror = rej
      r.readAsDataURL(file)
    })

  const onReference = async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return
    const dataUrl = await readAsDataUrl(file)
    patch({ reference: { dataUrl, name: file.name }, templateId: null })
  }

  const onUpload = async (files: FileList | null, role: 'person' | 'logo') => {
    if (!files) return
    const imgs = [...files].filter((f) => f.type.startsWith('image/')).slice(0, 6)
    const added = await Promise.all(imgs.map(async (f) => ({
      dataUrl: await readAsDataUrl(f), role, name: f.name,
    })))
    patch({ photos: [...state.photos, ...added].slice(0, 6) })
  }

  const ready2 = Boolean(picked) || Boolean(state.reference)

  return (
    <StepShell title="Choose a look"
      subtitle="Pick one of our styles, or drop in a design you already like and we’ll work in its style. Add your logo and photos on the right — all optional."
      back="/design" next="/design/content" nextReady={ready2}
      nextHint="Pick a style or drop your own design">

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
        {/* THE LOOKS */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 10 }}>Our styles</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 10 }}>
            {VISIBLE_STYLES.slice(0, shown).map((t) => (
              <button key={t.id} onClick={() => patch({ templateId: t.id, reference: null })}
                title={`The ${t.name} look`}
                style={{ padding: 0, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', background: '#111',
                  border: picked === t.id ? `3px solid ${INK}` : `1px solid ${LINE}` }}>
                <img src={thumbUrl(t.id)} alt={t.name} loading="lazy"
                  style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', display: 'block' }} />
                <div style={{ fontSize: 11, fontWeight: 700, padding: '5px 4px', background: 'white', color: INK,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
              </button>
            ))}
          </div>
          {shown < VISIBLE_STYLES.length && (
            <button style={{ ...plainBtn, marginTop: 14 }}
              onClick={() => setShown((n) => Math.min(n + PAGE, VISIBLE_STYLES.length))}>
              See more — {VISIBLE_STYLES.length - shown} left
            </button>
          )}
        </div>

        {/* PREVIEW + YOUR STUFF */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
            {state.reference ? (
              <>
                <img src={state.reference.dataUrl} alt="" style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 8 }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>Working from your own design</div>
                <button style={plainBtn} onClick={() => patch({ reference: null })}>Use one of our looks instead</button>
              </>
            ) : picked ? (
              <>
                <img src={thumbUrl(picked)} alt={styleName ?? ''} style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 8 }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>The {styleName} look</div>
                <div style={{ fontSize: 12, color: SOFT }}>Your design will be made in this style.</div>
              </>
            ) : (
              <div style={{ padding: '30px 0', color: SOFT, fontSize: 13 }}>
                Pick a style, or drop your own design below — it shows here.
              </div>
            )}
          </div>

          {/* Drop your own design */}
          <label onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); void onReference(e.dataTransfer.files?.[0]) }}
            style={{ ...card, display: 'block', border: `1px dashed ${LINE}`, cursor: 'pointer', textAlign: 'center', fontSize: 12.5, color: SOFT }}>
            <strong style={{ color: INK }}>Have a design you like?</strong><br />
            Drag it here or click to pick a file.
            <input type="file" accept="image/*" hidden
              onChange={(e) => { void onReference(e.target.files?.[0]); e.target.value = '' }} />
          </label>

          {/* Logo & photos */}
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 6 }}>Your logo &amp; photos <span style={{ color: SOFT, fontWeight: 400 }}>(optional)</span></div>
            {state.photos.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {state.photos.map((p, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={p.dataUrl} alt="" style={{ width: 44, height: 44, objectFit: p.role === 'logo' ? 'contain' : 'cover', background: p.role === 'logo' ? '#fff' : undefined, borderRadius: 6, border: `1px solid ${LINE}` }} />
                    <span style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', fontSize: 8.5, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase', color: 'white', background: p.role === 'logo' ? '#2E7D32' : INK, borderRadius: 4, padding: '1px 4px', lineHeight: 1.3, whiteSpace: 'nowrap' }}>{p.role === 'logo' ? 'Logo' : 'Photo'}</span>
                    <button onClick={() => patch({ photos: state.photos.filter((_, j) => j !== i) })}
                      aria-label="Remove" style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, border: 'none', background: INK, color: 'white', fontSize: 11, cursor: 'pointer', lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <label style={{ ...plainBtn, display: 'inline-block' }}>
                Add your logo
                <input type="file" accept="image/*" hidden
                  onChange={(e) => { void onUpload(e.target.files, 'logo'); e.target.value = '' }} />
              </label>
              <label style={{ ...plainBtn, display: 'inline-block' }}>
                Add photos
                <input type="file" accept="image/*" multiple hidden
                  onChange={(e) => { void onUpload(e.target.files, 'person'); e.target.value = '' }} />
              </label>
            </div>
            <p style={{ fontSize: 11.5, color: SOFT, margin: '8px 0 0', lineHeight: 1.5 }}>
              Your logo is placed as-is — never redrawn or restyled. Photos of people become the featured subject.
            </p>
          </div>
        </div>
      </div>
    </StepShell>
  )
}
