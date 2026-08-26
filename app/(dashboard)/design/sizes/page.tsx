'use client'

import { useEffect, useMemo, useState } from 'react'
import { FLYER_SIZES, canBleed } from '../../../_lib/flyer-engine'
import { useWizard } from '../useWizard'
import { INK, SOFT, LINE, MINT, card, StepShell } from '../ui'

const GROUPS: { id: string; label: string }[] = [
  { id: 'print', label: 'Print' },
  { id: 'social', label: 'Social' },
  { id: 'banner', label: 'Banners & headers' },
  { id: 'card', label: 'Business cards' },
  { id: 'slide', label: 'Slides' },
]

/**
 * STEP 4 — WHERE IT'S USED (the output sizes) + BLEED for print.
 *
 * Tick the sizes you need. If ANY printable size is chosen, we force a clear
 * choice — full bleed or no bleed — and explain the difference with a small
 * drawn illustration, because it is the one print term that trips people up and
 * getting it wrong means a white line around the edge or lost artwork.
 */
export default function SizesStep() {
  const { state, patch, ready } = useWizard()
  const [unit, setUnit] = useState<number | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  // 'loading' until we know the price, 'failed' if we couldn't fetch it. The
  // price must never silently vanish — a failed lookup BLOCKS Next with a retry,
  // so nobody picks sizes blind and then hits "not enough credits" at generate.
  const [costState, setCostState] = useState<'loading' | 'ok' | 'failed'>('loading')

  const loadCost = () => {
    setCostState('loading')
    fetch('/api/flyer-history').then((r) => r.json()).then((r) => {
      if (typeof r.unit === 'number') { setUnit(r.unit); setCostState('ok') }
      else setCostState('failed')
      if (typeof r.balance === 'number') setBalance(r.balance)
    }).catch(() => setCostState('failed'))
  }
  useEffect(() => { loadCost() }, [])

  // A deck is a deck the moment it's picked on Step 1 — NOT only once slides are
  // planned. Keying off deckSlides meant a deck whose plan hadn't been confirmed
  // yet fell through to the full flyer size picker (the "it still showed sizes"
  // bug). kind==='deck' is the true signal; slide-16x9 is always its size.
  const isDeck = state.kind === 'deck'
  // A deck's size is fixed to 16:9 slides — set it once so Review + generate agree.
  useEffect(() => {
    if (isDeck && (state.sizes.length !== 1 || state.sizes[0] !== 'slide-16x9')) {
      patch({ sizes: ['slide-16x9'] })
    }
  }, [isDeck])

  const sizes = state.sizes
  // Does the current pick include any printable (inch) size? Only then does bleed matter.
  const hasPrint = useMemo(
    () => sizes.some((id) => { const s = FLYER_SIZES.find((x) => x.id === id); return s ? canBleed(s) : false }),
    [sizes],
  )

  if (!ready) return null

  const toggle = (id: string) =>
    patch({ sizes: sizes.includes(id) ? sizes.filter((x) => x !== id) : [...sizes, id].slice(0, 8) })

  const drawableSlides = (state.deckSlides ?? []).filter((s) => !s.imageOnly).length
  const cost = unit === null ? null : unit * (isDeck ? drawableSlides : sizes.length)
  const lbl = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: SOFT, margin: '0 0 6px' }

  // A deck skips the size picker — its size is fixed to 16:9 slides.
  if (isDeck) {
    return (
      <StepShell title="Your deck is set to *slides*"
        subtitle="Every restyled slide is made at standard 16:9 slide size."
        back="/design/style" next="/design/summary" nextLabel="Next: review" nextReady={drawableSlides > 0}
        nextHint="Go back and add a deck with text">
        <div style={{ ...card, maxWidth: 520 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>Slide · 1920 × 1080 (16:9)</div>
          <div style={{ fontSize: 13, color: SOFT, marginTop: 4 }}>{drawableSlides} slide{drawableSlides === 1 ? '' : 's'} will be restyled.</div>
          {cost !== null && (
            <p style={{ fontSize: 13, color: SOFT, margin: '12px 0 0' }}>
              <strong style={{ color: INK }}>{cost.toLocaleString()} credits</strong>
              {balance !== null && ` · ${Math.max(0, balance - cost).toLocaleString()} left after`}
            </p>
          )}
        </div>
      </StepShell>
    )
  }

  return (
    <StepShell title="Where will you *use* it?"
      nextLabel="Next: review"
      subtitle="Tick as many sizes as you need — each one is designed from scratch. You’ll review everything next, then we make them."
      help={{
        title: 'Which sizes should I tick?',
        intro: 'Pick where the design will actually be used — each ticked size is drawn from scratch and billed on its own.',
        points: [
          'Printing it? Choose a Print size (letter flyer, poster, postcard, yard sign…).',
          'Posting it? Choose a Social size — each one is already the right shape for Instagram, Facebook or LinkedIn.',
          'Want it in a few places? Tick several — you get one matching design in every size.',
          'Bleed (print only): “Full bleed” lets colour run off the paper’s edge; “No bleed” keeps a safe white margin. Pick full bleed if your art reaches the edge.',
        ],
        example: 'A grand-opening flyer to print AND post: tick “Letter flyer” and “Instagram post”.',
      }}
      back="/design/style" next="/design/summary"
      nextReady={sizes.length > 0 && costState === 'ok'}
      nextHint={costState === 'failed' ? 'Couldn’t load the price — retry below' : costState === 'loading' ? 'Checking the price…' : 'Pick at least one size'}>

      <div style={{ ...card, maxWidth: 720 }}>
        {GROUPS.map((g) => {
          const rows = FLYER_SIZES.filter((s) => s.group === g.id)
          if (!rows.length) return null
          return (
            <div key={g.id} style={{ marginBottom: 16 }}>
              <div style={lbl}>{g.label}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 4 }}>
                {rows.map((s) => (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer', padding: '4px 6px', borderRadius: 6, color: INK }}>
                    <input type="checkbox" checked={sizes.includes(s.id)} onChange={() => toggle(s.id)} />
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                    {unit !== null && <span style={{ fontSize: 11, color: SOFT }}>{unit.toLocaleString()} cr</span>}
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* BLEED CHOICE — only when a printable size is picked. */}
      {hasPrint && <BleedChoice bleed={state.bleed} onPick={(b) => patch({ bleed: b })} />}

      {/* THE PRICE IS NEVER HIDDEN. If we couldn't load it, say so and offer a
          retry — Next stays blocked until we know the cost. */}
      {costState === 'failed' && (
        <div role="alert" style={{ margin: '16px 0 0', padding: '10px 12px', borderRadius: 8, border: '1px solid #e6b0b0', background: '#fdf3f3', color: '#8a3b3b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10, maxWidth: 720 }}>
          <span>We couldn’t load the credit price. You won’t be charged until we can show it.</span>
          <button onClick={loadCost} style={{ ...card, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12.5 }}>Try again</button>
        </div>
      )}
      {sizes.length > 0 && costState === 'ok' && cost !== null && (
        <p style={{ fontSize: 13, color: SOFT, margin: '16px 0 0' }}>
          {sizes.length} design{sizes.length === 1 ? '' : 's'} · <strong style={{ color: INK }}>{cost.toLocaleString()} credits</strong>
          {balance !== null && ` · ${Math.max(0, balance - cost).toLocaleString()} left after`}
        </p>
      )}
    </StepShell>
  )
}

/**
 * The full-bleed vs no-bleed picker, with a drawn diagram of each so the
 * difference is obvious without knowing the jargon. Both tiles are always shown;
 * the chosen one is outlined.
 */
function BleedChoice({ bleed, onPick }: { bleed: boolean; onPick: (b: boolean) => void }) {
  const tile = (on: boolean) => ({
    ...card, flex: 1, minWidth: 220, cursor: 'pointer', textAlign: 'center' as const,
    borderColor: on ? INK : LINE, boxShadow: on ? `inset 0 0 0 2px ${INK}` : 'none',
  })
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: INK, marginBottom: 4 }}>For printing — do you want a bleed?</div>
      <p style={{ fontSize: 12.5, color: SOFT, margin: '0 0 12px', lineHeight: 1.5, maxWidth: 620 }}>
        A “bleed” lets the artwork run right off the paper’s edge. If your design has colour or a photo reaching the edge, choose full bleed so trimming never leaves a thin white line. If it sits on a plain white margin, no bleed is fine.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {/* FULL BLEED */}
        <button style={tile(bleed)} onClick={() => onPick(true)}>
          <BleedDiagram full />
          <div style={{ fontSize: 13.5, fontWeight: 700, color: INK, marginTop: 8 }}>Full bleed</div>
          <div style={{ fontSize: 12, color: SOFT, marginTop: 2 }}>Colour runs to the edge — no white line after trimming.</div>
        </button>
        {/* NO BLEED */}
        <button style={tile(!bleed)} onClick={() => onPick(false)}>
          <BleedDiagram />
          <div style={{ fontSize: 13.5, fontWeight: 700, color: INK, marginTop: 8 }}>No bleed</div>
          <div style={{ fontSize: 12, color: SOFT, marginTop: 2 }}>A safe white margin around the design.</div>
        </button>
      </div>
    </div>
  )
}

/** A tiny drawn page: 'full' fills to the trim line; otherwise a white margin. */
function BleedDiagram({ full = false }: { full?: boolean }) {
  return (
    <div style={{ position: 'relative', width: 120, height: 84, margin: '0 auto', borderRadius: 6, overflow: 'hidden', background: 'white', border: `1px solid ${LINE}` }}>
      {/* the artwork */}
      <div style={{
        position: 'absolute',
        inset: full ? -6 : 12,
        background: `linear-gradient(135deg, ${INK}, #4a4640)`,
        borderRadius: full ? 0 : 4,
      }} />
      {/* dashed trim line */}
      <div style={{ position: 'absolute', inset: 6, border: `1.5px dashed ${MINT}`, borderRadius: 3, pointerEvents: 'none' }} />
    </div>
  )
}
