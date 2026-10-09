'use client'

import type { ReactNode } from 'react'
import { Button } from '../../../../_components/kit'

/**
 * THE MAIN BUTTON of a step — the one that moves you on.
 *
 * - Its words say what it does, and the cost when it spends ("Make it —
 *   1,000 credits"). Pass the price from the server's quote, never typed.
 * - When it can't be pressed it says WHY underneath. When the why is a
 *   missing answer on the screen, "Show me" scrolls to that answer and lights
 *   it up, so nobody has to hunt for the grey box they skipped.
 * - It sits in the step's bottom bar (BottomBar.tsx), fixed to the bottom
 *   of the screen; on a phone it fills the bar's width.
 */
export type Missing = { reason: string; target?: string }

export function showMe(targetId: string) {
  const el = document.getElementById(targetId)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.remove('ws-flash')
  // Re-adding the class restarts the glow if "Show me" is pressed twice.
  void el.offsetWidth
  el.classList.add('ws-flash')
  window.setTimeout(() => el.classList.remove('ws-flash'), 2400)
  const field = el.matches('input, textarea, select, button') ? el : el.querySelector<HTMLElement>('input, textarea, select, button')
  field?.focus({ preventScroll: true })
}

export default function MainAction({
  children,
  price,
  onClick,
  disabled,
  missing,
  busy,
  note,
}: {
  children: ReactNode
  price?: string | null
  onClick: () => void
  /** Can't be pressed for a reason that isn't a missing answer (e.g. saving). */
  disabled?: boolean
  /** The first thing still missing. Its presence disables the button. */
  missing?: Missing | null
  busy?: boolean
  /** A quiet line under the button that stays (e.g. "the only button that spends"). */
  note?: ReactNode
}) {
  const off = !!disabled || !!missing
  const reason = missing ? (
    <>
      {missing.reason}
      {missing.target ? (
        <>
          {' '}
          <button type="button" className="ws-showme" onClick={() => showMe(missing.target!)}>Show me</button>
        </>
      ) : null}
    </>
  ) : null
  return (
    <div className="cf-main">
      <Button variant="primary" className="cf-main-btn" onClick={onClick} disabled={off} aria-busy={busy || undefined} price={price || undefined} disabledReason={reason}>
        {children}
      </Button>
      {note ? <p className="cf-main-note">{note}</p> : null}
    </div>
  )
}
