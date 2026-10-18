'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import MainAction, { type Missing } from './MainAction'

/**
 * THE BOTTOM BAR — one per step, fixed to the bottom of the screen (clear of
 * the phone's home bar and the cookie notice):
 *
 *   Free                                     [ Free preview ]  [ Read it → ]
 *   Nothing charged yet
 *
 * - Left: where the money stands, in big words. Always from the server's
 *   quote (or "Free" where nothing can be charged) — never worked out here.
 * - Right: the ONE main button of the step (MainAction: says why when it
 *   can't be pressed, with "Show me"), plus at most one quiet helper button
 *   (step 3's free preview).
 * - `notice` is a message that belongs next to the button: an error from the
 *   server, "you need more credits", "add a card first".
 *
 * The bar measures itself into --cf-bar-h so the page can leave that much
 * room at the bottom: nothing is ever hidden behind it.
 */
export default function BottomBar({
  info,
  sub,
  notice,
  helper,
  label,
  onMain,
  mainLabel,
  disabled,
  busy,
  missing,
}: {
  /** The big words on the left ("Free", "1,000 credits"). */
  info: ReactNode
  /** The quiet line under them ("Nothing charged yet", "4,400 left after"). */
  sub?: ReactNode
  notice?: ReactNode
  /** One quiet button beside the main one (step 3's "Free preview"). */
  helper?: ReactNode
  /** What a screen reader calls the bar. */
  label: string
  onMain: () => void
  mainLabel: ReactNode
  disabled?: boolean
  busy?: boolean
  missing?: Missing | null
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const root = document.documentElement
    const set = () => root.style.setProperty('--cf-bar-h', `${Math.ceil(el.getBoundingClientRect().height)}px`)
    set()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(set) : null
    ro?.observe(el)
    return () => { ro?.disconnect(); root.style.removeProperty('--cf-bar-h') }
  }, [])

  return (
    <div ref={ref} className="cf-bar" role="region" aria-label={label}>
      <div className="cf-bar-in">
        {notice ? <div className="cf-bar-notice">{notice}</div> : null}
        <div className="cf-bar-info" data-testid="bar-info">
          <span className="cf-bar-big">{info}</span>
          {sub ? <span className="cf-bar-sub">{sub}</span> : null}
        </div>
        <div className="cf-bar-buttons">
          {helper}
          <MainAction onClick={onMain} disabled={disabled} busy={busy} missing={missing}>
            {mainLabel}
          </MainAction>
        </div>
      </div>
    </div>
  )
}
