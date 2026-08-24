'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWizard } from '../useWizard'
import { generateDeck } from '../deckGenerate'
import { INK, SOFT, CREAM } from '../ui'
import { SkeletonTile } from '../system/Preview'
import { FLYER_SIZES } from '../../../_lib/flyer-engine'

// The status line cycles through the real stages of a design so the wait reads
// as work happening, not a hung spinner.
const STAGES = [
  'Sketching the layout…',
  'Setting your headline…',
  'Placing your images…',
  'Bringing in colour…',
  'Final polish…',
]

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
  const [stage, setStage] = useState(0)
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
            brandColors: state.brandColors,
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
            // Colours read off a website in the chat — used to tint only when no
            // saved brand and no uploaded reference is driving the look.
            brandColors: state.brandColors && state.brandColors.length ? state.brandColors : undefined,
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

  // Cycle the status verb so the wait reads as work happening. Stops at the last
  // stage rather than looping, so it never claims to restart.
  useEffect(() => {
    if (err) return
    const t = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 2600)
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

  // Every other slide is an ad; the rest are facts (secondary strip below).
  const showAd = tick % 2 === 1
  const ad = ADS[Math.floor(tick / 2) % ADS.length]
  const fact = FACTS[Math.floor(tick / 2) % FACTS.length]

  // What to draw as skeletons: one tile per chosen size, or per deck slide.
  const isDeck = Boolean(state.deckSlides && state.deckSlides.length)
  const tiles: { id: string; label: string }[] = isDeck
    ? (deckProg ? Array.from({ length: deckProg.total }) : state.deckSlides ?? []).map((_, i) => ({ id: `slide-${i}`, label: `Slide ${i + 1}` }))
    : state.sizes.map((id) => ({ id, label: FLYER_SIZES.find((s) => s.id === id)?.label?.replace(/ \d.*$/, '') ?? id }))

  // Per-tile state. A deck fills in for real via onProgress; a normal batch
  // returns all at once, so every tile shows "busy" until the page routes away.
  const tileState = (i: number): 'wait' | 'busy' | 'done' => {
    if (isDeck && deckProg) return i < deckProg.done ? 'done' : i === deckProg.done ? 'busy' : 'wait'
    return 'busy'
  }

  const headline = deckProg
    ? `Restyling your deck — ${deckProg.done} of ${deckProg.total} slides`
    : STAGES[stage]

  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(120% 120% at 50% 0%, #fff 0%, ${CREAM} 60%)`, padding: '32px 24px 48px' }}>
      <div style={{ width: 'min(880px,100%)', margin: '0 auto' }}>
        {/* status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 6 }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', border: `3px solid ${INK}`, borderTopColor: 'transparent', animation: 't2a-spin 0.8s linear infinite' }} />
          <h1 className="t2a-display" style={{ fontSize: 'clamp(24px,4vw,36px)', margin: 0 }}>{headline}</h1>
        </div>
        <p style={{ fontSize: 13, color: SOFT, textAlign: 'center', margin: '0 0 24px' }}>
          Your finished designs are saved to your Library — even if you close this tab, they’ll be waiting there.
        </p>

        {/* THE WORK, HAPPENING — a skeleton in the true shape of every design,
            filling in as each lands (decks) or sharpening together (a batch). */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(tiles.length, 4)}, 1fr)`, gap: 14, maxWidth: tiles.length === 1 ? 360 : '100%', margin: '0 auto 28px' }}>
          {tiles.map((t, i) => (
            <SkeletonTile key={t.id} sizeId={isDeck ? 'slide-16x9' : t.id} label={t.label} state={tileState(i)} />
          ))}
        </div>

        {/* secondary: one fact or ad, quietly, below the work */}
        <div key={tick} style={{ maxWidth: 480, margin: '0 auto', animation: 't2a-rise .5s var(--ease)' }}>
          {showAd ? (
            <a href={ad.href} target="_blank" rel="noreferrer"
              style={{ display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none', border: `1px solid ${LINE_C}`, borderRadius: 10, padding: 12, background: 'white' }}>
              <img src={`/wait-ads/${ad.file}.png`} alt={ad.name} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, background: '#0d0d12', flexShrink: 0 }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{ad.name}</div>
                <div style={{ fontSize: 12, color: SOFT }}>{ad.line} →</div>
              </div>
            </a>
          ) : (
            <div style={{ border: `1px solid ${LINE_C}`, borderRadius: 10, padding: '14px 16px', background: 'white' }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: SOFT, marginBottom: 5 }}>Did you know</div>
              <div style={{ fontSize: 14, color: INK, lineHeight: 1.5 }}>{fact}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const LINE_C = 'var(--t2a-line,#ddd6cc)'
