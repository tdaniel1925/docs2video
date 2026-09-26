'use client'

import { usePathname } from 'next/navigation'

/**
 * THE STEP BAR — four steps, matching what the user actually does.
 *
 *   1 What it's about   /create                       client, goal, content
 *   2 Check the story   /create/brief, /create/script  points and scenes
 *   3 Make it yours     /create/brand, /voice, /theme  look, voice, price, make
 *   4 Send it           /create/generating → the result page
 *
 * It used to show seven dots and fell back to "STEP 1 OF 7 — CONTENT" on any
 * page it didn't know, so the chooser, the client page and the commercial
 * form all claimed to be step 1. Pages outside the flow now get no bar.
 *
 * "Save for later" is gone: drafts are saved to the account as you go and
 * listed under "Continue where you left off". The button wrote a browser-only
 * copy nothing ever read.
 */
const STEPS = [
  { label: 'What it’s about', paths: ['/create'] },
  { label: 'Check the story', paths: ['/create/brief', '/create/script'] },
  { label: 'Make it yours', paths: ['/create/brand', '/create/voice', '/create/theme'] },
  { label: 'Send it', paths: ['/create/generating'] },
]

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const activeIdx = STEPS.findIndex((s) => s.paths.includes(pathname))
  const showBar = activeIdx >= 0 && pathname !== '/create/generating'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {showBar && (
        <div style={{ padding: '20px 32px 0', maxWidth: 900, width: '100%', margin: '0 auto' }}>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }} aria-label="Steps">
            {STEPS.map((step, i) => {
              const state = i < activeIdx ? 'done' : i === activeIdx ? 'now' : 'todo'
              return (
                <li key={step.label} aria-current={state === 'now' ? 'step' : undefined} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ height: 6, borderRadius: 3, background: state === 'todo' ? 'var(--border)' : state === 'now' ? 'var(--ink)' : 'var(--mint)' }} />
                  <div style={{ fontSize: 12.5, fontWeight: state === 'now' ? 800 : 600, color: state === 'todo' ? 'var(--ink-light)' : 'var(--ink)' }}>
                    {i + 1}. {step.label}
                  </div>
                </li>
              )
            })}
          </ol>
          <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 8, textAlign: 'right' }}>Saved as you go</div>
        </div>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}
