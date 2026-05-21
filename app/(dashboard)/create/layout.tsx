'use client'

import { usePathname } from 'next/navigation'

const STEPS = [
  { path: '/create', label: 'Goal' },
  { path: '/create/source', label: 'Content' },
  { path: '/create/review', label: 'Review' },
  { path: '/create/script', label: 'Script' },
  { path: '/create/options', label: 'Options' },
  { path: '/create/generating', label: 'Build' },
]

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const currentIdx = STEPS.findIndex(s => pathname === s.path || pathname?.startsWith(s.path + '/'))
  const activeIdx = currentIdx >= 0 ? currentIdx : 0

  // Hide step bar on generating page
  const isGenerating = pathname === '/create/generating'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {!isGenerating && (
        <div style={{
          padding: '20px 32px 0',
          maxWidth: 900,
          width: '100%',
          margin: '0 auto',
        }}>
          {/* Progress dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            {STEPS.map((step, i) => (
              <div key={step.path} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: i <= activeIdx ? 32 : 10,
                  height: 10,
                  borderRadius: 10,
                  background: i < activeIdx ? 'var(--mint)' : i === activeIdx ? 'var(--ink)' : 'var(--border)',
                  transition: 'all 0.4s ease',
                }} />
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-light)', fontWeight: 600, letterSpacing: '0.05em' }}>
            STEP {activeIdx + 1} OF {STEPS.length} &mdash; {STEPS[activeIdx]?.label.toUpperCase()}
          </div>
        </div>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}
