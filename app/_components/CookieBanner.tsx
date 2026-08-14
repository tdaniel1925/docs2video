'use client'

import { useState, useEffect, useRef } from 'react'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const bar = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('cookie_consent')) {
      setVisible(true)
    }
  }, [])

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
    localStorage.setItem('cookie_consent', 'accepted')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div ref={bar} style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: '#1B365D',
      color: '#fff',
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
          background: '#C7E8A8',
          color: '#1B365D',
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
