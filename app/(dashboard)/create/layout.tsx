'use client'

import { usePathname } from 'next/navigation'

/**
 * THE STEP RAIL — four steps, matching what the user actually does.
 *
 *   1 What it's about   /create                        client, goal, content
 *   2 Check the story   /create/script (/brief forwards) points and scenes
 *   3 Make it yours     /create/theme (+ /brand, /voice) look, voice, price, make
 *   4 Send it           /create/generating → the result page
 *
 * A left rail on wide screens, a compact bar on phones (see .steps-rail in
 * globals.css). Pages outside the flow — the chooser, commercials — get none.
 *
 * "Save for later" is gone: drafts are saved to the account as you go and
 * listed on Home. The button wrote a browser-only copy nothing ever read.
 */
const STEPS = [
  { label: 'What it’s about', hint: 'Client, goal, your document', paths: ['/create'] },
  { label: 'Check the story', hint: 'Points and scenes — free', paths: ['/create/brief', '/create/script'] },
  { label: 'Make it yours', hint: 'Look, voice, what to send', paths: ['/create/theme', '/create/brand', '/create/voice'] },
  { label: 'Send it', hint: 'One link, and follow-up', paths: ['/create/generating'] },
]

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const activeIdx = STEPS.findIndex((s) => s.paths.includes(pathname))
  const showRail = activeIdx >= 0 && pathname !== '/create/generating'

  if (!showRail) {
    return <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>{children}</div>
  }

  return (
    <div className="steps-shell">
      <nav className="steps-rail" aria-label="Steps">
        <div className="steps-rail-title">New project · 4 steps</div>
        <ol>
          {STEPS.map((step, i) => {
            const state = i < activeIdx ? 'done' : i === activeIdx ? 'now' : 'todo'
            return (
              <li key={step.label} className={`steps-rail-item is-${state}`} aria-current={state === 'now' ? 'step' : undefined}>
                <span className="steps-rail-dot" aria-hidden="true">{state === 'done' ? '✓' : i + 1}</span>
                <span>
                  <span className="steps-rail-label">{step.label}</span>
                  <span className="steps-rail-hint">{step.hint}</span>
                </span>
              </li>
            )
          })}
        </ol>
        <div className="steps-rail-note">
          Saved as you go. Close the tab and it’s waiting on <strong>Home</strong>.
        </div>
      </nav>
      <div className="steps-main">{children}</div>
    </div>
  )
}
