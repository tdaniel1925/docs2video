'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button className="hamburger" onClick={() => setOpen(true)} aria-label="Open menu">
        <span />
        <span />
        <span />
      </button>

      {open && (
        <div className="mobile-menu">
          <button className="mobile-menu-close" onClick={() => setOpen(false)} aria-label="Close menu">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <div className="mobile-menu-links">
            <a href="#how-it-works" onClick={() => setOpen(false)}>How It Works</a>
            <a href="#features" onClick={() => setOpen(false)}>Features</a>
            <a href="#industries" onClick={() => setOpen(false)}>Industries</a>
            <a href="#compare" onClick={() => setOpen(false)}>Compare</a>
            <a href="#pricing" onClick={() => setOpen(false)}>Pricing</a>
            <Link href="/blog" onClick={() => setOpen(false)}>Blog</Link>
          </div>

          <div className="mobile-menu-cta">
            <Link href="/login" className="btn btn-outlined" style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'white' }} onClick={() => setOpen(false)}>
              Login
            </Link>
            <Link href="/signup" className="btn btn-mint" onClick={() => setOpen(false)}>
              Try for free
            </Link>
          </div>
        </div>
      )}
    </>
  )
}
