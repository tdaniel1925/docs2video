'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import NotificationBell from './NotificationBell'
import { logout } from '../_actions/auth'
import type { Profile } from '../_lib/types'
import { isAdmin } from '../_lib/admin'

const CREATE_ITEMS_LIST = [
  { href: '/create', icon: '\uD83D\uDCF9', title: 'Video Explainer', desc: '$29 — Narrated video + share page' },
]

// Flat list for route matching
const CREATE_ITEMS = CREATE_ITEMS_LIST

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/videos', label: 'Library' },
  { href: '/clients', label: 'Clients' },
  { href: '/settings', label: 'Settings' },
]

export default function Header({ profile }: { profile: Profile }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const createRef = useRef<HTMLDivElement>(null)

  const showAdmin = isAdmin(profile.email)

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

            {/* Create — direct link (single product) */}
            <Link
              href="/create"
              className={isCreateActive ? 'active' : ''}
            >
              Create Explainer
            </Link>

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
                {['pro', 'professional', 'active', 'agency'].includes(profile.subscription_status?.toLowerCase() ?? '') ? 'Pro Member' : 'Free Account'}
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: 0 }} />
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
          <Link href="/create" className={pathname === '/create' || pathname.startsWith('/create/') ? 'active' : ''}>
            Create Explainer
          </Link>
          <Link href="/videos" className={pathname === '/videos' ? 'active' : ''}>Library</Link>
          <Link href="/clients" className={pathname === '/clients' ? 'active' : ''}>Clients</Link>
          <Link href="/settings" className={pathname === '/settings' ? 'active' : ''}>Settings</Link>
          {showAdmin && (
            <Link href="/admin" className={pathname.startsWith('/admin') ? 'active' : ''}>Admin</Link>
          )}
        </div>
      )}
    </header>
  )
}
