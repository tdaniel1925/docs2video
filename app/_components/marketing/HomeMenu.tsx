'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// Phone-width menu for the front page header. Hidden above 900px by CSS
// (app/_components/marketing/home.css).
export default function HomeMenu({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="hp-menu">
      <button
        type="button"
        className="hp-menu-btn"
        aria-expanded={open}
        aria-controls="hp-menu-panel"
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
        <div id="hp-menu-panel" className="hp-menu-panel">
          {links.map((l) => <a key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</a>)}
          <Link href="/blog" onClick={() => setOpen(false)}>Blog</Link>
          <Link href="/login" onClick={() => setOpen(false)}>Log in</Link>
        </div>
      )}
    </div>
  )
}
