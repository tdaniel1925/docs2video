'use client'

import { useEffect, useState } from 'react'
import { FLYER_SIZES } from '../../../_lib/flyer-engine'
import { useWizard } from '../useWizard'
import { INK, SOFT, LINE, card, StepShell } from '../ui'

const GROUPS: { id: string; label: string }[] = [
  { id: 'print', label: 'Print' },
  { id: 'social', label: 'Social' },
  { id: 'banner', label: 'Banners & headers' },
  { id: 'card', label: 'Business cards' },
  { id: 'slide', label: 'Slides' },
]

/**
 * STEP 4 — WHERE IT'S USED (the output sizes).
 *
 * Tick the sizes you need; each is designed from scratch. Generating no longer
 * happens here — it happens after the Review step, on the wait screen. Phase 5
 * adds the full-bleed vs no-bleed choice (with an illustration) for print sizes.
 */
export default function SizesStep() {
  const { state, patch, ready } = useWizard()
  const [unit, setUnit] = useState<number | null>(null)
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/flyer-history').then((r) => r.json()).then((r) => {
      if (typeof r.unit === 'number') setUnit(r.unit)
      if (typeof r.balance === 'number') setBalance(r.balance)
    }).catch(() => {})
  }, [])

  if (!ready) return null

  const sizes = state.sizes
  const toggle = (id: string) =>
    patch({ sizes: sizes.includes(id) ? sizes.filter((x) => x !== id) : [...sizes, id].slice(0, 8) })

  const cost = unit === null ? null : unit * sizes.length
  const lbl = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: SOFT, margin: '0 0 6px' }

  return (
    <StepShell title="Where will you use it?"
      subtitle="Tick as many sizes as you need — each one is designed from scratch. You’ll review everything next, then we make them."
      back="/design/content" next="/design/summary" nextReady={sizes.length > 0}
      nextHint="Pick at least one size">

      <div style={{ ...card, maxWidth: 720 }}>
        {GROUPS.map((g) => {
          const rows = FLYER_SIZES.filter((s) => s.group === g.id)
          if (!rows.length) return null
          return (
            <div key={g.id} style={{ marginBottom: 16 }}>
              <div style={lbl}>{g.label}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 4 }}>
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

      {sizes.length > 0 && cost !== null && (
        <p style={{ fontSize: 13, color: SOFT, margin: '16px 0 0' }}>
          {sizes.length} design{sizes.length === 1 ? '' : 's'} · <strong style={{ color: INK }}>{cost.toLocaleString()} credits</strong>
          {balance !== null && ` · ${Math.max(0, balance - cost).toLocaleString()} left after`}
        </p>
      )}
    </StepShell>
  )
}
