'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// Phone-width menu for the marketing header. Hidden above 900px by CSS.
export default function MarketingMenu({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="mk-menu">
      <button
        type="button"
        className="mk-menu-btn"
        aria-expanded={open}
        aria-controls="mk-menu-panel"
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        )}
      </button>
      {open && (
        <div id="mk-menu-panel" className="mk-menu-panel">
          {links.map((l) =>
            l.href.startsWith('/#')
              ? <a key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</a>
              : <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</Link>
          )}
          <Link href="/login" onClick={() => setOpen(false)}>Log in</Link>
          <Link href="/signup" className="mk-btn mk-btn-navy" onClick={() => setOpen(false)}>Start free</Link>
        </div>
      )}
    </div>
  )
}
