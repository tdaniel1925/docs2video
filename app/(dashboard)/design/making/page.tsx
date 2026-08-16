'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWizard } from '../useWizard'
import { generateDeck } from '../deckGenerate'
import { INK, SOFT, CREAM } from '../ui'

/**
 * THE WAIT SCREEN.
 *
 * This is where the designs are actually made. It fires ONE generate call on
 * mount (guarded so React strict-mode's double-mount can't double-charge), then
 * moves to results. While it works, the whole page is a slideshow so the wait
 * feels short: fun facts about design/print, and a rotating ad for each of the
 * three products (jordyn.app, docs2video, botmakers.ai — images generated once,
 * in public/wait-ads). A blank spinner reads as "broken"; this reads as "worth
 * the wait."
 */
const FACTS = [
  'Designers call the space around your words “white space” — and using more of it is what makes a design look expensive.',
  'The rule of thirds: put the important thing a third of the way in, not dead centre. Your eye likes it better.',
  'Red draws the eye first, which is why “sale” and “now” are so often painted in it.',
  'A “bleed” means the ink runs off the paper’s edge, so trimming never leaves a thin white line.',
  'Two typefaces is plenty. Three starts to look like a ransom note.',
  'The best logos work in one colour. If it only looks good in full colour, it isn’t finished.',
  'Left-aligned text is the easiest to read — your eye always knows where the next line starts.',
  'Contrast is kindness: dark words on a light ground (or the reverse) is what makes a design readable across a room.',
]

const ADS = [
  { file: 'jordyn', href: 'https://jordyn.app', name: 'Jordyn', line: 'The AI assistant with a brain for your business.' },
  { file: 'docs2video', href: 'https://docs2video.com', name: 'Docs2Video', line: 'Turn any document into a professional explainer video.' },
  { file: 'botmakers', href: 'https://botmakers.ai', name: 'Botmakers.ai', line: 'Custom full-stack software, AI powered.' },
]

export default function MakingScreen() {
  const { state, patch, ready } = useWizard()
  const router = useRouter()
  const fired = useRef(false)
  const [err, setErr] = useState('')
  const [tick, setTick] = useState(0)
  const [deckProg, setDeckProg] = useState<{ done: number; total: number } | null>(null)

  // Fire the generate ONCE.
  useEffect(() => {
    if (!ready || fired.current) return
    if (!state.sizes.length || !state.kind) { router.replace('/design'); return }
    fired.current = true

    const roundId = crypto.randomUUID()
    const chatId = state.chatId ?? crypto.randomUUID()
    ;(async () => {
      try {
        // DECK: draw one styled slide per slide (deckGenerate loops flyer-art).
        if (state.deckSlides && state.deckSlides.length) {
          const res = await generateDeck({
            slides: state.deckSlides,
            templateId: state.templateId,
            brandId: state.brandId,
            // If the user dropped a reference on the Style step, style every
            // slide from it (own-it gate controls close matching).
            referenceDataUrl: state.reference?.dataUrl,
            keepMotif: Boolean(state.reference && state.referenceOwned),
            // Logo + photos, placed on every slide.
            photos: state.photos.map((p) => ({ dataUrl: p.dataUrl, role: p.role })),
            roundId, chatId,
            onProgress: (p) => setDeckProg({ done: p.done, total: p.total }),
          })
          if (!res.made) { setErr(res.firstError || 'None of the slides could be made. You were not charged for anything that failed.'); return }
          patch({ roundId, chatId })
          router.replace('/design/results')
          return
        }

        // Everything else: one design (or one batch of sizes).
        const r = await fetch('/api/flyer-art', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            templateId: state.templateId ?? undefined,
            sizeIds: state.sizes,
            bleed: state.bleed,
            fields: state.fields,
            referenceDataUrl: state.reference?.dataUrl,
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

  // Rotate the slideshow every 10s (long enough to actually read a fact or take
  // in an ad). Facts and ads interleave.
  useEffect(() => {
    if (err) return
    const t = setInterval(() => setTick((n) => n + 1), 10000)
    return () => clearInterval(t)
  }, [err])

  if (err) {
    return (
      <div style={{ minHeight: '100vh', background: CREAM, display: 'grid', placeItems: 'center', padding: 32 }}>
        <div style={{ textAlign: 'center', maxWidth: 520 }}>
          <h1 style={{ fontSize: 22, color: INK, margin: '0 0 8px' }}>That didn’t finish</h1>
          <p style={{ fontSize: 14, color: SOFT, lineHeight: 1.6, marginBottom: 18 }}>{err}</p>
          <button onClick={() => router.push('/design/summary')}
            style={{ padding: '11px 22px', borderRadius: 9, border: 'none', background: INK, color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            &larr; Back to review
          </button>
        </div>
      </div>
    )
  }

  // Every other slide is an ad; the rest are facts.
  const showAd = tick % 2 === 1
  const ad = ADS[Math.floor(tick / 2) % ADS.length]
  const fact = FACTS[Math.floor(tick / 2) % FACTS.length]

  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(120% 120% at 50% 0%, #fff 0%, ${CREAM} 60%)`, display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ width: 'min(560px,100%)', textAlign: 'center' }}>
        {/* progress heading */}
        <div style={{ width: 48, height: 48, borderRadius: '50%', border: `4px solid ${INK}`, borderTopColor: 'transparent', margin: '0 auto 16px', animation: 'design-spin 0.9s linear infinite' }} />
        <h1 style={{ fontSize: 22, color: INK, margin: '0 0 4px' }}>
          {deckProg ? `Restyling your deck — slide ${Math.min(deckProg.done + 1, deckProg.total)} of ${deckProg.total}…` : 'Designing your artwork…'}
        </h1>
        <p style={{ fontSize: 13.5, color: SOFT, margin: '0 0 6px' }}>Each slide is made from scratch. Please keep this page open.</p>
        <p style={{ fontSize: 13, color: INK, fontWeight: 600, margin: '0 0 22px' }}>
          While you wait, here’s a little about our other AI-powered business products.
        </p>

        {/* the rotating card */}
        <div key={tick} style={{ animation: 'design-fade .6s ease' }}>
          {showAd ? (
            <a href={ad.href} target="_blank" rel="noreferrer"
              style={{ display: 'block', textDecoration: 'none', borderRadius: 16, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,.14)' }}>
              <img src={`/wait-ads/${ad.file}.png`} alt={ad.name}
                style={{ width: '100%', maxHeight: '52vh', objectFit: 'contain', display: 'block', background: '#0d0d12' }} />
              <div style={{ background: 'white', padding: '10px 14px', textAlign: 'left' }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: SOFT }}>While you wait</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{ad.name}</div>
                <div style={{ fontSize: 12.5, color: SOFT }}>{ad.line} →</div>
              </div>
            </a>
          ) : (
            <div style={{ background: 'white', borderRadius: 16, padding: '30px 26px', boxShadow: '0 12px 40px rgba(0,0,0,.10)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: SOFT, marginBottom: 10 }}>Did you know</div>
              <div style={{ fontSize: 17, color: INK, lineHeight: 1.5 }}>{fact}</div>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes design-spin { to { transform: rotate(360deg); } }
        @keyframes design-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  )
}
