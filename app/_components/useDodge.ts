'use client'

import { useEffect, useState, type RefObject } from 'react'

/*
 * KEEP A FLOATING BUTTON OFF THE PAGE'S OWN CONTROLS (2026-11-15).
 *
 * The round help button sits in the bottom-right corner, which is exactly where pages put their
 * last button (a side panel's "Done", a dialog's Save, a sticky bar). This watches what is under
 * the button and moves it out of the way:
 *   1. up, just above whatever it would cover (up to half the screen);
 *   2. if that is still covered, to the bottom-LEFT corner (side panels open on the right);
 *   3. if both are covered, it tucks mostly off the right edge, still clickable.
 * It moves with the CSS `translate` property, so hover's `transform: scale()` keeps working.
 * It only looks at things you can click or type in (buttons, links, fields), never plain text.
 */

export type Dodge = { x: number; y: number; tucked: boolean }
const HOME: Dodge = { x: 0, y: 0, tucked: false }
const CONTROL = 'button, a[href], input:not([type="hidden"]), textarea, select, label, summary, [role="button"], [role="link"], [role="tab"], [role="switch"], [role="checkbox"], [contenteditable="true"]'
const GAP = 12
const EDGE = 24

/** The controls (not part of the floating UI itself) that a box at this spot would cover. */
function blockers(r: { left: number; top: number; right: number; bottom: number }, mine: (el: Element) => boolean): DOMRect[] {
  const found = new Set<Element>()
  const xs = [r.left + 4, (r.left + r.right) / 2, r.right - 4]
  const ys = [r.top + 4, (r.top + r.bottom) / 2, r.bottom - 4]
  for (const x of xs) for (const y of ys) {
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue
    for (const el of document.elementsFromPoint(x, y)) {
      if (mine(el)) continue
      const c = el.closest(CONTROL)
      if (c && !mine(c)) found.add(c)
    }
  }
  return [...found].map((el) => el.getBoundingClientRect()).filter((b) => b.width > 0 && b.height > 0)
}

/** Where the button should go so it covers nothing. `ignore` = selectors of the floating UI itself. */
export function useDodge(ref: RefObject<HTMLElement | null>, opts: { paused?: boolean; ignore: string }): Dodge {
  const [dodge, setDodge] = useState<Dodge>(HOME)
  const { paused, ignore } = opts

  useEffect(() => {
    if (paused) return
    let frame = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let last = HOME

    const mine = (el: Element) => !!ref.current && (ref.current.contains(el) || !!el.closest(ignore))

    const place = () => {
      frame = 0
      const el = ref.current
      if (!el) return
      const now = el.getBoundingClientRect()
      if (now.width === 0) { if (last !== HOME) { last = HOME; setDodge(HOME) } return } // hidden (phones)
      // Where it would be with no dodge.
      const base = { left: now.left - last.x, right: now.right - last.x, top: now.top - last.y, bottom: now.bottom - last.y }
      const at = (x: number, y: number) => ({ left: base.left + x, right: base.right + x, top: base.top + y, bottom: base.bottom + y })

      // Try a column (right side, then left side): rise above each blocker until clear.
      const climb = (x: number): number | null => {
        let y = 0
        for (let i = 0; i < 6; i++) {
          const hit = blockers(at(x, y), mine)
          if (!hit.length) return y
          const top = Math.min(...hit.map((b) => b.top))
          y = top - GAP - base.bottom
          if (base.top + y < window.innerHeight / 2) return null
        }
        return null
      }

      let next: Dodge
      const right = climb(0)
      if (right !== null) next = { x: 0, y: right, tucked: false }
      else {
        const toLeft = EDGE - base.left
        const left = climb(toLeft)
        next = left !== null ? { x: toLeft, y: left, tucked: false } : { x: base.right - base.left - 18, y: 0, tucked: true }
      }
      next = { ...next, x: Math.round(next.x), y: Math.round(next.y) }
      if (next.x !== last.x || next.y !== last.y || next.tucked !== last.tucked) { last = next; setDodge(next) }
    }

    // Look again after anything changes, at most every ~120 ms.
    const soon = () => {
      if (frame || timer) return
      timer = setTimeout(() => { timer = undefined; frame = requestAnimationFrame(place) }, 120)
    }
    place()
    const mo = new MutationObserver(soon)
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'open', 'hidden'] })
    window.addEventListener('scroll', soon, { capture: true, passive: true })
    window.addEventListener('resize', soon)
    return () => {
      mo.disconnect()
      window.removeEventListener('scroll', soon, { capture: true })
      window.removeEventListener('resize', soon)
      if (timer) clearTimeout(timer)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ref, paused, ignore])

  // While paused (the help panel is open) it stays where it was: the panel is anchored to it.
  return dodge
}
