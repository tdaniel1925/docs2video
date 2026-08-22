'use client'

import { usePathname } from 'next/navigation'
import { STEPS, activeStepIndex, stepDoneFlags } from './steps'
import { Sidebar } from './ui'
import { useWizard } from './useWizard'
import './system/tokens.css'

/**
 * THE FIVE-STEP FRAME.
 *
 * A persistent left SIDEBAR lists the steps (lit = here, check = done) so the
 * user always knows where they are and can jump back. Each page's primary action
 * lives in a STICKY BOTTOM BAR (see StepShell) that never leaves the viewport, so
 * nobody scrolls back up to advance. The step list lives in ./steps as the single
 * source of truth. Brand-neutral: no product name, because /design serves both
 * storefronts.
 *
 * The whole frame carries the `t2a` class so the design-wizard tokens apply here
 * and nowhere else in the app.
 *
 * The wait screen (/design/making) and results (/design/results) are OUTSIDE the
 * numbered flow — they render full-bleed with no sidebar.
 */
export default function DesignLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { state, ready } = useWizard()
  const bare = pathname === '/design/making' || pathname === '/design/results'

  if (bare) {
    return (
      <div className="t2a" style={{ minHeight: '100vh', background: 'var(--t2a-canvas)' }}>{children}</div>
    )
  }

  const activeIdx = activeStepIndex(pathname)
  const doneFlags = ready ? stepDoneFlags(state) : undefined

  return (
    // height:100vh + overflow on the content column so the step body scrolls
    // UNDER a sticky bottom bar that pins to the viewport edge.
    <div className="t2a" style={{ height: '100vh', display: 'flex', background: 'var(--t2a-canvas)', overflow: 'hidden' }}>
      <Sidebar steps={STEPS} activeIdx={activeIdx} doneFlags={doneFlags} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  )
}
