'use client'

import { usePathname } from 'next/navigation'
import { STEPS, phoneStepLine, stepIndexFor } from './_components/workspace/steps'

/**
 * THE STEP RAIL — the left part of the three-part workspace (rail · the work ·
 * "Your video so far"). The other two parts come from <Workspace> on each page.
 *
 * Shown on all four steps, the waiting screen included: it used to vanish
 * there, so the person waiting lost sight of where they were.
 *
 * On a phone the four-dot row was cramped and unreadable; it is now one line,
 * "Step 2 of 4 · The story" (see .steps-rail-phone in globals.css).
 *
 * "Save for later" is gone: drafts are saved to the account as you go and
 * listed on Home. The button wrote a browser-only copy nothing ever read.
 */
export default function CreateLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const activeIdx = stepIndexFor(pathname)

  if (activeIdx < 0) {
    return <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>{children}</div>
  }

  return (
    <div className="steps-shell">
      <nav className="steps-rail" aria-label="Steps">
        <div className="steps-rail-title">New project · 4 steps</div>
        <p className="steps-rail-phone">{phoneStepLine(activeIdx)}</p>
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
