'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FLYER_SIZES } from '../../../_lib/flyer-engine'
import { useWizard } from '../useWizard'
import { INK, SOFT, LINE, card, StepNav, StepShell, primaryBtn } from '../ui'

const GROUPS: { id: string; label: string }[] = [
  { id: 'print', label: 'Print' },
  { id: 'social', label: 'Social' },
  { id: 'banner', label: 'Banners & headers' },
  { id: 'card', label: 'Business cards' },
  { id: 'slide', label: 'Slides' },
]

export default function MakeStep() {
  const { state, patch, ready } = useWizard()
  const router = useRouter()
  const [unit, setUnit] = useState<number | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [making, setMaking] = useState(false)
  const [err, setErr] = useState('')

  // Deck default: one 16:9 slide size is implied; the wizard treats a deck like
  // the /flyer page does (slide-16x9 ticked), so here we just show print/social.
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

  const generate = async () => {
    if (!sizes.length || making) return
    setErr(''); setMaking(true)
    const roundId = crypto.randomUUID()
    try {
      const r = await fetch('/api/flyer-art', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          templateId: state.templateId ?? undefined,
          sizeIds: sizes,
          fields: state.fields,
          referenceDataUrl: state.reference?.dataUrl,
          photos: state.photos.map((p) => ({ dataUrl: p.dataUrl, role: p.role })),
          brandId: state.brandId ?? undefined,
          roundId,
        }),
      }).then((x) => x.json())
      if (r?.error) { setErr(r.error); setMaking(false); return }
      // Hand the round to the edit page.
      patch({ roundId })
      router.push('/design/edit')
    } catch {
      setErr('Something went wrong. Please try again.')
      setMaking(false)
    }
  }

  const lbl = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: SOFT, margin: '0 0 6px' }

  return (
    <StepShell title="Pick your sizes"
      subtitle="Tick as many as you need — each one is designed from scratch. You’ll see them next, and can spot-edit any of them.">

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
          {' · about '}{Math.ceil(sizes.length * 0.5)}–{sizes.length * 2} min
        </p>
      )}

      {err && <p style={{ fontSize: 13, color: '#B4432F', margin: '12px 0 0' }}>{err}</p>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
        <StepNav back="/design/words" />
        <button onClick={generate} disabled={!sizes.length || making}
          style={{ ...primaryBtn, padding: '11px 22px', fontSize: 15, opacity: !sizes.length || making ? 0.4 : 1, cursor: !sizes.length || making ? 'default' : 'pointer' }}>
          {making ? 'Designing…' : `Make ${sizes.length || ''}`.trim()}
        </button>
      </div>
    </StepShell>
  )
}
