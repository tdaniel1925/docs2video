'use client'

import { useState, type ReactNode } from 'react'
import SoFarPanel, { type SoFar } from './SoFarPanel'

/**
 * THE WORKSPACE — the middle and right of the three parts (the step rail on
 * the left comes from create/layout.tsx). Every step uses it, so the work is
 * always in the middle and "Your video so far" is always on the right.
 *
 *   <Workspace soFar={facts} side={<PricePanel …/>}>…the work…</Workspace>
 *
 * `side` is anything this step adds under the summary (step 2's "Change it by
 * asking", step 3's price and Make it button).
 *
 * On a phone the right part folds under the work: the summary starts closed
 * (one tap opens it) so the work comes first.
 */
export default function Workspace({ soFar, side, children }: { soFar: SoFar; side?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="ws-grid">
      <div className="ws-work">{children}</div>
      <aside className="ws-side" aria-label="Your project so far">
        <SoFarPanel facts={soFar} open={open} onToggle={() => setOpen((o) => !o)} />
        {side}
      </aside>
    </div>
  )
}
