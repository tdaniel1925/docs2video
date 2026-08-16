'use client'

import { usePathname } from 'next/navigation'
import { STEPS, activeStepIndex } from './steps'
import { Sidebar } from './ui'

/**
 * THE FIVE-STEP FRAME.
 *
 * A persistent left SIDEBAR lists the steps (lit = here, check = done) so the
 * user always knows where they are and can jump back. Each page also puts its
 * own Back/Next up TOP (see StepShell), so nobody has to scroll to advance.
 * The step list lives in ./steps as the single source of truth. Brand-neutral:
 * no product name, because /design serves both storefronts.
 *
 * The wait screen (/design/making) and results (/design/results) are OUTSIDE the
 * numbered flow — they render full-bleed with no sidebar.
 */
export default function DesignLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const bare = pathname === '/design/making' || pathname === '/design/results'

  if (bare) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg,#F4F1EC)' }}>{children}</div>
    )
  }

  const activeIdx = activeStepIndex(pathname)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg,#F4F1EC)' }}>
      <Sidebar steps={STEPS} activeIdx={activeIdx} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}
