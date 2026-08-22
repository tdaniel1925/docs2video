'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { VISIBLE_STYLES, FLYER_SIZES, canBleed } from '../../../_lib/flyer-engine'
import { useWizard } from '../useWizard'
import { INK, SOFT, LINE, card, StepShell } from '../ui'

/**
 * STEP 5 — REVIEW AND START.
 *
 * Shows the choices back. Phase 6 adds pre-done example outputs and turns Start
 * into the red button that hands off to the wait screen. For now Start goes
 * straight to the wait screen, which does the actual generating.
 */
const KIND_LABEL: Record<string, string> = {
  print: 'Something to print', social: 'A social graphic', deck: 'A slide deck', set: 'A set of sizes',
}

export default function SummaryStep() {
  const { state, ready } = useWizard()
  const router = useRouter()

  const styleName = useMemo(
    () => VISIBLE_STYLES.find((t) => t.id === state.templateId)?.name ?? null,
    [state.templateId],
  )
  const sizeLabels = useMemo(
    () => state.sizes.map((id) => FLYER_SIZES.find((s) => s.id === id)?.label ?? id),
    [state.sizes],
  )

  if (!ready) return null

  const hasPrint = state.sizes.some((id) => { const s = FLYER_SIZES.find((x) => x.id === id); return s ? canBleed(s) : false })

  const isDeck = Boolean(state.deckSlides)
  const drawableSlides = (state.deckSlides ?? []).filter((s) => !s.imageOnly).length

  // Everything Start needs, and — when something's missing — WHICH one, by name.
  // "Finish the earlier steps first" told nobody what to fix; here all five ticks
  // can be green while Style is empty, so the hint has to name the gap.
  const needStyle = !(state.templateId || state.reference)
  const needKind = !state.kind
  const needContent = !(state.fields.headline || isDeck)
  const needSizes = !state.sizes.length
  const ready_ = !needKind && !needStyle && !needContent && !needSizes
  const hint = needKind ? 'Pick what you’re making (step 1) first'
    : needStyle ? 'Pick a look on the Style step first'
    : needContent ? 'Add your words on the Content step first'
    : needSizes ? 'Choose at least one size first'
    : 'Finish the earlier steps first'

  const rows: { k: string; v: string }[] = isDeck ? [
    { k: 'Making', v: 'Restyled slide deck' },
    { k: 'From', v: state.deckName || 'your deck' },
    { k: 'Look', v: state.reference ? 'Your own design (style-matched)' : styleName ?? '—' },
    { k: 'Slides', v: `${drawableSlides} slide${drawableSlides === 1 ? '' : 's'}, restyled at 16:9` },
    { k: 'Your images', v: state.photos.length ? `${state.photos.filter((p) => p.role === 'logo').length} logo, ${state.photos.filter((p) => p.role !== 'logo').length} photo` : 'none' },
  ] : [
    { k: 'Making', v: state.kind ? KIND_LABEL[state.kind] : '—' },
    { k: 'Look', v: state.reference ? 'Your own design (style-matched)' : styleName ?? '—' },
    { k: 'Headline', v: state.fields.headline || '—' },
    { k: 'Sizes', v: sizeLabels.length ? sizeLabels.join(', ') : '—' },
    ...(hasPrint ? [{ k: 'Print edge', v: state.bleed ? 'Full bleed (runs to the edge)' : 'No bleed (white margin)' }] : []),
    { k: 'Your images', v: state.photos.length ? `${state.photos.filter((p) => p.role === 'logo').length} logo, ${state.photos.filter((p) => p.role !== 'logo').length} photo` : 'none' },
  ]

  return (
    <StepShell title="Review and *start*"
      subtitle="Here’s what we’ll make. Press Start designing and we’ll get to work — you’ll see a progress screen, then your finished designs."
      back="/design/sizes" nextLabel="Start designing" startMode
      nextReady={ready_}
      nextHint={hint}
      onNext={() => router.push('/design/making')}>

      {/* Full-width summary. The live-preview rail on the right already shows a
          sample of the look, so we don't cram a second examples card in here —
          that squeezed the table into one-word-per-line. On its own the table
          has room to breathe; on narrow screens the label/value stack. */}
      <div style={{ ...card, maxWidth: 640 }}>
        {rows.map((r, i) => (
          <div key={r.k} className="t2a-sum-row" style={{ display: 'flex', gap: 16, padding: '10px 0', borderTop: i ? `1px solid ${LINE}` : 'none' }}>
            <div style={{ width: 120, flexShrink: 0, fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: SOFT }}>{r.k}</div>
            <div style={{ fontSize: 14, color: INK, minWidth: 0 }}>{r.v}</div>
          </div>
        ))}
      </div>
      <style>{`@media (max-width: 560px) { .t2a-sum-row { flex-direction: column; gap: 2px !important; } }`}</style>
    </StepShell>
  )
}

/**
 * "Here's the kind of thing you'll get." Pre-made showpieces — generated ONCE
 * with OpenAI and stored in public/design-examples, reused for every visitor
 * (never generated live). Not the user's actual design; just a quality preview.
 * The one matching what they're making is featured; the rest sit in a small row.
 */
const EXAMPLES: { kind: string; file: string; label: string }[] = [
  { kind: 'print', file: 'print', label: 'Flyer' },
  { kind: 'social', file: 'social', label: 'Social post' },
  { kind: 'deck', file: 'slide', label: 'Slide' },
  { kind: 'set', file: 'card', label: 'Business card' },
]

function Examples({ kind }: { kind: string | null }) {
  const featured = EXAMPLES.find((e) => e.kind === kind) ?? EXAMPLES[0]
  const others = EXAMPLES.filter((e) => e !== featured)
  return (
    <div style={{ ...card }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: SOFT, marginBottom: 8 }}>
        Samples of this kind
      </div>
      <img src={`/design-examples/${featured.file}.png`} alt={`Example ${featured.label}`}
        style={{ width: '100%', borderRadius: 8, border: `1px solid ${LINE}`, display: 'block', background: '#faf8f4' }} />
      <div style={{ fontSize: 11.5, color: SOFT, margin: '6px 0 12px' }}>A sample {featured.label.toLowerCase()} for the look — yours is made fresh from your words and style, so it won’t look like this one.</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {others.map((e) => (
          <img key={e.file} src={`/design-examples/${e.file}.png`} alt={`Example ${e.label}`} title={e.label}
            style={{ width: `${100 / others.length}%`, height: 56, objectFit: 'cover', borderRadius: 6, border: `1px solid ${LINE}`, background: '#faf8f4' }} />
        ))}
      </div>
    </div>
  )
}
