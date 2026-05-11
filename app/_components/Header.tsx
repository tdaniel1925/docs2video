'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { logout } from '../_actions/auth'
import type { Profile } from '../_lib/types'

const ADMIN_EMAIL = 'trenttdaniel@gmail.com'

const baseNavLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/create', label: 'Create' },
  { href: '/videos', label: 'My Explainers' },
  { href: '/brands', label: 'Brands' },
  { href: '/flyers', label: 'Flyers' },
  { href: '/business-cards', label: 'Cards' },
  { href: '/infographic-creator', label: 'Infographics' },
  { href: '/logo-creator', label: 'Logos' },
  { href: '/settings', label: 'Settings' },
]

export default function Header({ profile }: { profile: Profile }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  const navLinks = profile.email === ADMIN_EMAIL
    ? [...baseNavLinks, { href: '/admin', label: 'Admin' }]
    : baseNavLinks

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            <img src="/logo.png" alt="Docs2Video" style={{ height: 64 }} />
          </Link>
          <nav className="app-nav">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href)) ? 'active' : ''}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="app-user"
            style={{ background: 'none', border: 'none' }}
          >
            <div className="app-avatar">
              {profile.full_name?.[0]?.toUpperCase() ?? profile.email[0].toUpperCase()}
            </div>
          </button>

          {menuOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: 4,
                width: 200,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                borderRadius: 10,
                padding: '4px 0',
                boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                zIndex: 200,
              }}
            >
              <div style={{ padding: '8px 14px', fontSize: 13, color: 'var(--muted)' }}>
                {profile.credits_remaining} credits remaining
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: 0 }} />
              <Link
                href="/settings"
                onClick={() => setMenuOpen(false)}
                style={{ display: 'block', padding: '8px 14px', fontSize: 14, color: 'var(--ink)', textDecoration: 'none' }}
              >
                Settings
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  style={{
                    width: '100%',
                    padding: '8px 14px',
                    textAlign: 'left',
                    fontSize: 14,
                    color: 'var(--ink)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Sign Out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
