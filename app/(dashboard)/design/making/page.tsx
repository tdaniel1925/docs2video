'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWizard } from '../useWizard'
import { INK, SOFT, CREAM } from '../ui'

/**
 * THE WAIT SCREEN.
 *
 * This is where the designs are actually made. It fires ONE generate call on
 * mount (guarded so React strict-mode's double-mount can't double-charge), then
 * moves to results. Phase 7 makes this beautiful — rotating fun facts and the
 * three brand ads. For now it does the real work and shows honest progress.
 */
export default function MakingScreen() {
  const { state, patch, ready } = useWizard()
  const router = useRouter()
  const fired = useRef(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!ready || fired.current) return
    if (!state.sizes.length || !state.kind) { router.replace('/design'); return }
    fired.current = true

    const roundId = crypto.randomUUID()
    const chatId = state.chatId ?? crypto.randomUUID()
    ;(async () => {
      try {
        const r = await fetch('/api/flyer-art', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            templateId: state.templateId ?? undefined,
            sizeIds: state.sizes,
            bleed: state.bleed,
            fields: state.fields,
            referenceDataUrl: state.reference?.dataUrl,
            // Only allow close matching when the user confirmed they own the
            // reference; otherwise the engine takes style inspiration only.
            keepMotif: Boolean(state.reference && state.referenceOwned),
            photos: state.photos.map((p) => ({ dataUrl: p.dataUrl, role: p.role })),
            brandId: state.brandId ?? undefined,
            roundId, chatId,
          }),
        }).then((x) => x.json())
        if (r?.error) { setErr(r.error); return }
        patch({ roundId, chatId })
        router.replace('/design/results')
      } catch {
        setErr('Something went wrong while making your designs. You were not charged for anything that failed.')
      }
    })()
  }, [ready])

  return (
    <div style={{ minHeight: '100vh', background: CREAM, display: 'grid', placeItems: 'center', padding: 32 }}>
      <div style={{ textAlign: 'center', maxWidth: 520 }}>
        {!err ? (
          <>
            <div style={{ width: 54, height: 54, borderRadius: '50%', border: `4px solid ${INK}`, borderTopColor: 'transparent', margin: '0 auto 20px', animation: 'design-spin 0.9s linear infinite' }} />
            <h1 style={{ fontSize: 24, color: INK, margin: '0 0 8px' }}>Designing your artwork…</h1>
            <p style={{ fontSize: 14, color: SOFT, lineHeight: 1.6 }}>
              Each size is made from scratch, so this takes a moment. Please keep this page open.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 22, color: INK, margin: '0 0 8px' }}>That didn’t finish</h1>
            <p style={{ fontSize: 14, color: SOFT, lineHeight: 1.6, marginBottom: 18 }}>{err}</p>
            <button onClick={() => router.push('/design/summary')}
              style={{ padding: '11px 22px', borderRadius: 9, border: 'none', background: INK, color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              &larr; Back to review
            </button>
          </>
        )}
      </div>
      <style>{`@keyframes design-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
