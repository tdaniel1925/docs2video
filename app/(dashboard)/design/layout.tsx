'use client'

import { usePathname } from 'next/navigation'

/**
 * THE FOUR-STEP FRAME.
 *
 * Same shape as Docs2Video's /create wizard — a progress bar that says where
 * you are, wrapping four routed pages. The steps and their order are the single
 * source of truth here; each page just renders its own body. Brand-neutral: no
 * product name, because /design serves both storefronts.
 */
const STEPS = [
  { path: '/design', label: 'Style' },
  { path: '/design/words', label: 'Words' },
  { path: '/design/make', label: 'Sizes' },
  { path: '/design/edit', label: 'Edit' },
]

export default function DesignLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Longest-prefix match, so /design/words wins over /design.
  const activeIdx = STEPS.reduce((best, s, i) =>
    pathname === s.path || pathname?.startsWith(s.path + '/') || pathname?.startsWith(s.path + '?')
      ? (s.path.length > STEPS[best].path.length ? i : best) : best, 0)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg,#F4F1EC)' }}>
      <div style={{ padding: '20px 32px 0', maxWidth: 1100, width: '100%', margin: '0 auto' }}>
        {/* Progress dots — filled behind you (mint), solid on you (ink), faint ahead. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          {STEPS.map((step, i) => (
            <div key={step.path} style={{
              width: i <= activeIdx ? 40 : 12, height: 10, borderRadius: 5,
              background: i < activeIdx ? 'var(--mint,#C7E8A8)' : i === activeIdx ? 'var(--ink,#23201c)' : 'var(--border,#ddd6cc)',
              transition: 'all .35s ease',
            }} />
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft,#6b6459)', fontWeight: 700, letterSpacing: '.05em' }}>
          STEP {activeIdx + 1} OF {STEPS.length} &mdash; {STEPS[activeIdx]?.label.toUpperCase()}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}
