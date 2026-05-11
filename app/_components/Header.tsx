'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { logout } from '../_actions/auth'
import type { Profile } from '../_lib/types'

const ADMIN_EMAIL = 'trenttdaniel@gmail.com'

const CREATE_ITEMS = [
  { href: '/create', icon: '\uD83D\uDCF9', title: 'Video Explainer', desc: 'Create a narrated video' },
  { href: '/infographic-creator', icon: '\uD83D\uDCCA', title: 'Infographic', desc: 'Generate a visual summary' },
  { href: '/flyers', icon: '\uD83D\uDCCB', title: 'Flyer', desc: 'Design a professional flyer' },
  { href: '/business-cards', icon: '\uD83D\uDCB3', title: 'Business Card', desc: 'Create branded cards' },
  { href: '/logo-creator', icon: '\uD83C\uDFA8', title: 'Logo', desc: 'AI-powered logo design' },
  { href: '/templates', icon: '\uD83C\uDFAF', title: 'Custom Template', desc: 'Build your own slide style' },
]

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/videos', label: 'Library' },
  { href: '/brands', label: 'Brands' },
  { href: '/settings', label: 'Settings' },
]

export default function Header({ profile }: { profile: Profile }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const createRef = useRef<HTMLDivElement>(null)

  const showAdmin = profile.email === ADMIN_EMAIL

  // Close create dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (createRef.current && !createRef.current.contains(e.target as Node)) {
        setCreateOpen(false)
      }
    }
    if (createOpen) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [createOpen])

  // Close dropdowns on route change
  useEffect(() => {
    setCreateOpen(false)
    setMenuOpen(false)
    setMobileOpen(false)
  }, [pathname])

  const isCreateActive = CREATE_ITEMS.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  )

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            <img src="/logo.png" alt="Docs2Video" style={{ height: 64 }} />
          </Link>
          <nav className="app-nav">
            {/* Dashboard */}
            <Link
              href="/dashboard"
              className={pathname === '/dashboard' ? 'active' : ''}
            >
              Dashboard
            </Link>

            {/* Create dropdown */}
            <div ref={createRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setCreateOpen(!createOpen)}
                className={`app-nav-btn${isCreateActive ? ' active' : ''}`}
                type="button"
              >
                Create
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 2 }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {createOpen && (
                <div className="create-dropdown">
                  {CREATE_ITEMS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="create-dropdown-item"
                      onClick={() => setCreateOpen(false)}
                    >
                      <div className="create-dropdown-icon">{item.icon}</div>
                      <div>
                        <div className="create-dropdown-text">{item.title}</div>
                        <div className="create-dropdown-desc">{item.desc}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Other nav links */}
            {NAV_LINKS.slice(1).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={pathname === link.href || pathname.startsWith(link.href + '/') ? 'active' : ''}
              >
                {link.label}
              </Link>
            ))}

            {/* Admin */}
            {showAdmin && (
              <Link
                href="/admin"
                className={pathname.startsWith('/admin') ? 'active' : ''}
              >
                Admin
              </Link>
            )}
          </nav>
        </div>

        {/* Mobile hamburger */}
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileOpen(!mobileOpen)}
          type="button"
          aria-label="Menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2">
            {mobileOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>

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

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="mobile-menu">
          <Link href="/dashboard" className={pathname === '/dashboard' ? 'active' : ''}>Dashboard</Link>
          {CREATE_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className={pathname === item.href ? 'active' : ''}>
              <span style={{ marginRight: 8 }}>{item.icon}</span>
              {item.title}
            </Link>
          ))}
          <Link href="/videos" className={pathname === '/videos' ? 'active' : ''}>Library</Link>
          <Link href="/brands" className={pathname === '/brands' ? 'active' : ''}>Brands</Link>
          <Link href="/settings" className={pathname === '/settings' ? 'active' : ''}>Settings</Link>
          {showAdmin && (
            <Link href="/admin" className={pathname.startsWith('/admin') ? 'active' : ''}>Admin</Link>
          )}
        </div>
      )}
    </header>
  )
}
