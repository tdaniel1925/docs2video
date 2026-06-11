'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import NotificationBell from './NotificationBell'
import { logout } from '../_actions/auth'
import type { Profile } from '../_lib/types'

const CREATE_ITEMS = [
  { href: '/create', icon: '\uD83D\uDCF9', title: 'Video Explainer', desc: 'Narrated video + share page' },
  { href: '/deck-builder', icon: '\uD83D\uDCCA', title: 'Slide Deck', desc: 'PPTX presentation without audio' },
]

const TOOLS_ITEMS = [
  { href: '/create', icon: '\uD83C\uDFAC', title: 'Pro Mode', desc: 'Full control over every detail' },
  { href: '/brands', icon: '\uD83C\uDFA8', title: 'Brands', desc: 'Manage colors, logos, brand guides' },
  { href: '/brands/new', icon: '\uD83C\uDF10', title: 'New Brand from URL', desc: 'Scrape website for brand identity' },
]

// Focused product (2026-06-11): video + deck only — peripheral tools unlinked
const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/videos', label: 'Library' },
  { href: '/clients', label: 'Clients' },
]

export default function Header({ profile }: { profile: Profile }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [credits, setCredits] = useState<{ balance: number; monthly: number } | null>(null)
  const pathname = usePathname()
  const createRef = useRef<HTMLDivElement>(null)
  const toolsRef = useRef<HTMLDivElement>(null)

  // Fetch credit balance on mount
  useEffect(() => {
    fetch('/api/credits/balance')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && typeof d.balance === 'number') setCredits({ balance: d.balance, monthly: d.monthly }) })
      .catch(() => {})
  }, [])

  const creditColor = credits && credits.monthly > 0
    ? credits.balance / credits.monthly > 0.25 ? '#22c55e'
      : credits.balance / credits.monthly > 0.10 ? '#eab308'
      : '#ef4444'
    : credits ? '#22c55e' : undefined

  const showAdmin = profile.is_admin === true

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (createRef.current && !createRef.current.contains(e.target as Node)) setCreateOpen(false)
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) setToolsOpen(false)
    }
    if (createOpen || toolsOpen) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [createOpen, toolsOpen])

  // Close dropdowns on route change
  useEffect(() => {
    setCreateOpen(false)
    setToolsOpen(false)
    setMenuOpen(false)
    setMobileOpen(false)
  }, [pathname])

  const isCreateActive = CREATE_ITEMS.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  ) || pathname === '/create' || pathname.startsWith('/create/')
  const isToolsActive = TOOLS_ITEMS.some(
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
            <div ref={createRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <button
                onClick={() => setCreateOpen(!createOpen)}
                className={isCreateActive ? 'active' : ''}
                style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 16px', borderRadius: 10, fontSize: 14, fontWeight: 500, color: 'var(--ink-soft)' }}
              >
                + Create
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5 }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {createOpen && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: 8,
                  width: 280, background: 'var(--bg-card)', border: '1px solid var(--border-light)',
                  borderRadius: 10, padding: 6, boxShadow: '0 8px 30px rgba(0,0,0,0.12)', zIndex: 200,
                }}>
                  {CREATE_ITEMS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setCreateOpen(false)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                        borderRadius: 8, textDecoration: 'none', color: 'var(--ink)',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-soft)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ fontSize: 20, width: 32, textAlign: 'center' }}>{item.icon}</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{item.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-light)' }}>{item.desc}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Tools dropdown */}
            <div ref={toolsRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <button
                onClick={() => setToolsOpen(!toolsOpen)}
                className={isToolsActive ? 'active' : ''}
                style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 16px', borderRadius: 10, fontSize: 14, fontWeight: 500, color: 'var(--ink-soft)' }}
              >
                Tools
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5 }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {toolsOpen && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: 8,
                  width: 280, background: 'var(--bg-card)', border: '1px solid var(--border-light)',
                  borderRadius: 10, padding: 6, boxShadow: '0 8px 30px rgba(0,0,0,0.12)', zIndex: 200,
                }}>
                  {TOOLS_ITEMS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setToolsOpen(false)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                        borderRadius: 8, textDecoration: 'none', color: 'var(--ink)',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-soft)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ fontSize: 20, width: 32, textAlign: 'center' }}>{item.icon}</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{item.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-light)' }}>{item.desc}</div>
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

        {credits && (
          <Link
            href="/pricing"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 8, textDecoration: 'none',
              fontSize: 13, fontWeight: 600, color: creditColor,
              background: 'var(--bg-soft)', border: '1px solid var(--border-light)',
            }}
            title="Credit balance"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={creditColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v12M15 9.5c0-1.38-1.34-2.5-3-2.5s-3 1.12-3 2.5 1.34 2.5 3 2.5 3 1.12 3 2.5-1.34 2.5-3 2.5" />
            </svg>
            {credits.balance.toLocaleString()} credits
          </Link>
        )}

        <NotificationBell />

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
                {profile.full_name || profile.email}
              </div>
              <div style={{ padding: '0 14px 6px', fontSize: 12, color: 'var(--ink-light)' }}>
                {['pro', 'professional', 'active', 'agency'].includes(profile.subscription_status?.toLowerCase() ?? '') ? 'Pro Member' : 'Free Account'}
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: 0 }} />
              <Link
                href="/analytics"
                onClick={() => setMenuOpen(false)}
                style={{ display: 'block', padding: '8px 14px', fontSize: 14, color: 'var(--ink)', textDecoration: 'none' }}
              >
                Analytics
              </Link>
              <Link
                href="/settings"
                onClick={() => setMenuOpen(false)}
                style={{ display: 'block', padding: '8px 14px', fontSize: 14, color: 'var(--ink)', textDecoration: 'none' }}
              >
                Settings
              </Link>
              <Link
                href="/help"
                onClick={() => setMenuOpen(false)}
                style={{ display: 'block', padding: '8px 14px', fontSize: 14, color: 'var(--ink)', textDecoration: 'none' }}
              >
                Help Center
              </Link>
              {showAdmin && (
                <>
                  <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: 0 }} />
                  <Link
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                    style={{ display: 'block', padding: '8px 14px', fontSize: 14, color: 'var(--ink)', textDecoration: 'none', fontWeight: 600 }}
                  >
                    Admin
                  </Link>
                </>
              )}
              <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: 0 }} />
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
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-light)', padding: '12px 0 4px' }}>Create</div>
          {CREATE_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className={pathname === item.href ? 'active' : ''}>
              {item.icon} {item.title}
            </Link>
          ))}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-light)', padding: '12px 0 4px' }}>Tools</div>
          {TOOLS_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className={pathname === item.href ? 'active' : ''}>
              {item.icon} {item.title}
            </Link>
          ))}
          <div style={{ height: 8 }} />
          <Link href="/videos" className={pathname === '/videos' ? 'active' : ''}>Library</Link>
          <Link href="/clients" className={pathname === '/clients' ? 'active' : ''}>Clients</Link>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-light)', padding: '12px 0 4px' }}>Account</div>
          <Link href="/analytics" className={pathname === '/analytics' ? 'active' : ''}>Analytics</Link>
          <Link href="/settings" className={pathname === '/settings' ? 'active' : ''}>Settings</Link>
          <Link href="/help" className={pathname.startsWith('/help') ? 'active' : ''}>Help Center</Link>
          {showAdmin && (
            <Link href="/admin" className={pathname.startsWith('/admin') ? 'active' : ''}>Admin</Link>
          )}
        </div>
      )}
    </header>
  )
}
