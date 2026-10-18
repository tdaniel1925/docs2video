'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useBrand } from './BrandProvider'

/**
 * Pages a CLIENT opens from a share link. They never log in, so there is no
 * login cookie to tell them about, and the bar covered the agent's video and
 * contact card (audit 2026-10-09). Exported for the guard test.
 */
export function isClientSharePage(pathname: string | null | undefined): boolean {
  return /^\/watch(\/|$)/.test(pathname ?? '')
}

/**
 * The Docs2Video front page (light, ink + cobalt). The notice there is a small
 * card in the bottom-left corner (a slim one-line bar on a phone) in the
 * page's own colours, so it never sits on the hero's buttons on first view
 * (front page rebuild 2026-10-14). Exported for the guard test.
 */
export function isFrontPage(pathname: string | null | undefined, brandId: string): boolean {
  return pathname === '/' && brandId !== 'text2art'
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const bar = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const hidden = isClientSharePage(pathname)
  const brand = useBrand()
  const front = isFrontPage(pathname, brand.id)

  useEffect(() => {
    if (hidden) { setVisible(false); return }
    let seen: string | null = null
    try { seen = localStorage.getItem('cookie_consent') } catch { /* blocked storage: show it */ }
    if (!seen) setVisible(true)
  }, [hidden])

  /**
   * SAY HOW TALL YOU ARE, so pages can get out of the way.
   *
   * This bar is pinned to the bottom of the window and nothing made room for
   * it, so on any page built to exactly fill the screen it simply sat on top of
   * the bottom row of controls — on the design page that was the Clear chat
   * button, invisible until you dismissed a banner you had no reason to think
   * was hiding anything.
   *
   * Measured, not guessed: the text wraps on a narrow window and the bar gets
   * taller, and a hard-coded 52 would be wrong exactly when it matters most.
   */
  useEffect(() => {
    const root = document.documentElement
    const set = () => root.style.setProperty('--bottom-bar',
      visible && bar.current ? `${Math.round(bar.current.getBoundingClientRect().height)}px` : '0px')
    set()
    if (!visible) return
    const ro = new ResizeObserver(set)
    if (bar.current) ro.observe(bar.current)
    return () => { ro.disconnect(); root.style.setProperty('--bottom-bar', '0px') }
  }, [visible])

  function accept() {
    try { localStorage.setItem('cookie_consent', 'accepted') } catch { /* fine */ }
    setVisible(false)
  }

  if (!visible) return null

  if (front) {
    return (
      <div ref={bar} className="hp-cookie" role="region" aria-label="Cookie notice">
        <span>We only use essential cookies, to keep you logged in.</span>
        <button type="button" onClick={accept}>Got it</button>
      </div>
    )
  }

  return (
    <div ref={bar} style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      /* Docs2Video's fixed navy and logo blue (globals.css --d2v-*), the same on
         every page and in either theme. */
      background: 'var(--d2v-frame)',
      color: 'var(--d2v-text)',
      borderTop: '1px solid var(--d2v-line2)',
      padding: '14px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      fontSize: 14,
      fontFamily: 'inherit',
    }}>
      <span>We use essential cookies to keep you logged in. No tracking cookies.</span>
      <button
        onClick={accept}
        style={{
          background: 'var(--d2v-blue)',
          color: 'var(--d2v-on-blue)',
          border: 'none',
          borderRadius: 8,
          padding: '8px 20px',
          fontWeight: 700,
          fontSize: 13,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Got it
      </button>
    </div>
  )
}
