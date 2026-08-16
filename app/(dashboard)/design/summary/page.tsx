'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { VISIBLE_STYLES, FLYER_SIZES } from '../../../_lib/flyer-engine'
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

  const rows: { k: string; v: string }[] = [
    { k: 'Making', v: state.kind ? KIND_LABEL[state.kind] : '—' },
    { k: 'Look', v: state.reference ? 'Your own design (style-matched)' : styleName ?? '—' },
    { k: 'Headline', v: state.fields.headline || '—' },
    { k: 'Sizes', v: sizeLabels.length ? sizeLabels.join(', ') : '—' },
    { k: 'Your images', v: state.photos.length ? `${state.photos.filter((p) => p.role === 'logo').length} logo, ${state.photos.filter((p) => p.role !== 'logo').length} photo` : 'none' },
  ]

  return (
    <StepShell title="Review and start"
      subtitle="Here’s what we’ll make. Press Start designing and we’ll get to work — you’ll see a progress screen, then your finished designs."
      back="/design/sizes" nextLabel="Start designing" startMode
      nextReady={Boolean(state.kind && (state.templateId || state.reference) && state.sizes.length)}
      nextHint="Finish the earlier steps first"
      onNext={() => router.push('/design/making')}>

      <div style={{ ...card, maxWidth: 620 }}>
        {rows.map((r, i) => (
          <div key={r.k} style={{ display: 'flex', gap: 16, padding: '10px 0', borderTop: i ? `1px solid ${LINE}` : 'none' }}>
            <div style={{ width: 120, flexShrink: 0, fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: SOFT }}>{r.k}</div>
            <div style={{ fontSize: 14, color: INK }}>{r.v}</div>
          </div>
        ))}
      </div>
    </StepShell>
  )
}
