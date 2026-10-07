'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import NotificationBell from './NotificationBell'
import BuyCreditsModal from './BuyCreditsModal'
import { logout } from '../_actions/auth'
import type { Profile } from '../_lib/types'
import type { Brand } from '../_lib/brand'
import { NAMES, planLabel } from '../_lib/names'

/*
 * THE TOP BAR AS IT WAS BEFORE THE 2026-10 OVERHAUL — kept frozen for the
 * storefronts whose brand says topBar: 'classic' (Text2Art). Text2Art has its
 * own nav and the overhaul must not move it, so this is the old Header.tsx
 * with only the never-shown Tools dropdown taken out (it was switched off).
 * Docs2Video's bar is TopBar in Header.tsx. Change this file only on purpose
 * for Text2Art.
 */
export default function ClassicHeader({ profile, brand }: { profile: Profile; brand: Brand }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [credits, setCredits] = useState<{ balance: number; monthly: number } | null>(null)
  const [showBuyCredits, setShowBuyCredits] = useState(false)
  const pathname = usePathname()

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
  // The layout selects profiles.* so the add-on flag is present even though the
  // shared Profile type doesn't declare it.
  const hasSocialAddon = !!(profile as Profile & { social_addon_active?: boolean }).social_addon_active

  // Close dropdowns on route change
  useEffect(() => {
    setMenuOpen(false)
    setMobileOpen(false)
  }, [pathname])

  // The phone menu closes on Escape too (and on a tap outside it, below).
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const isCreateActive = pathname === '/create' || pathname.startsWith('/create/')

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Link href={brand.home} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            {brand.logoSrc
              ? <img src={brand.logoSrc} alt={brand.name} style={{ height: 64 }} />
              : <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--ink)' }}>{brand.name}</span>}
          </Link>
          <nav className="app-nav">
            {/* First nav item (Designs on Text2Art). */}
            {brand.nav[0] && (
              <Link
                href={brand.nav[0].href}
                className={pathname === brand.nav[0].href ? 'active' : ''}
              >
                {brand.nav[0].label}
              </Link>
            )}

            {brand.create && (
              <Link
                href={brand.create.href}
                className={isCreateActive ? 'active' : ''}
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 16px', borderRadius: 10, fontSize: 14, fontWeight: 500, color: 'var(--ink-soft)' }}
              >
                {brand.create.label}
              </Link>
            )}

            {/* Other nav links */}
            {brand.nav.slice(1).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={isActive(link.href) ? 'active' : ''}
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
          aria-expanded={mobileOpen}
          aria-controls="t2a-phone-menu"
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
          <button
            onClick={() => setShowBuyCredits(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
              fontSize: 13, fontWeight: 600, color: creditColor,
              background: 'var(--bg-soft)', border: '1px solid var(--border-light)',
              fontFamily: 'inherit',
            }}
            title="Credit balance — click to top up"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={creditColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v12M15 9.5c0-1.38-1.34-2.5-3-2.5s-3 1.12-3 2.5 1.34 2.5 3 2.5 3 1.12 3 2.5-1.34 2.5-3 2.5" />
            </svg>
            {credits.balance.toLocaleString()} credits
            <span style={{ marginLeft: 4, fontSize: 12, fontWeight: 700, color: 'var(--mint-darker)' }}>+ Top Up</span>
          </button>
        )}

        <BuyCreditsModal open={showBuyCredits} onClose={() => setShowBuyCredits(false)} />

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
              {/* The real plan name from pricing.ts. */}
              <div style={{ padding: '0 14px 6px', fontSize: 12, color: 'var(--ink-light)' }}>
                {planLabel(profile.subscription_status)}
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: 0 }} />

              {/* Credits balance section */}
              <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Credits</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>
                    {credits ? credits.balance.toLocaleString() : '—'}
                  </div>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); setShowBuyCredits(true) }}
                  className="btn btn-sm"
                  style={{ background: 'var(--accent)', color: 'var(--ink)', fontWeight: 700, fontSize: 12, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Top Up
                </button>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: 0 }} />
              {brand.showVideoFeatures && (
                <Link
                  href="/analytics"
                  onClick={() => setMenuOpen(false)}
                  style={{ display: 'block', padding: '8px 14px', fontSize: 14, color: 'var(--ink)', textDecoration: 'none' }}
                >
                  Analytics
                </Link>
              )}
              {brand.showVideoFeatures && (
                <Link
                  href="/social-media"
                  onClick={() => setMenuOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 14px', fontSize: 14, color: 'var(--ink)', textDecoration: 'none' }}
                >
                  <span>AI Social</span>
                  {!hasSocialAddon && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', background: 'var(--bg-soft)', border: '1px solid var(--border-light)', borderRadius: 6, padding: '1px 6px' }}>
                      Add-on
                    </span>
                  )}
                </Link>
              )}
              {brand.showVideoFeatures && (
                <Link
                  href="/brands"
                  onClick={() => setMenuOpen(false)}
                  style={{ display: 'block', padding: '8px 14px', fontSize: 14, color: 'var(--ink)', textDecoration: 'none' }}
                >
                  {NAMES.brands}
                </Link>
              )}
              <Link
                href="/settings"
                onClick={() => setMenuOpen(false)}
                style={{ display: 'block', padding: '8px 14px', fontSize: 14, color: 'var(--ink)', textDecoration: 'none' }}
              >
                Settings
              </Link>
              <Link
                href="/affiliate"
                onClick={() => setMenuOpen(false)}
                style={{ display: 'block', padding: '8px 14px', fontSize: 14, color: 'var(--ink)', textDecoration: 'none' }}
              >
                Affiliate Program
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

      {/*
        * PHONE MENU (owner-approved change, 2026-10). It used to reuse the
        * marketing site's .mobile-menu class, which turned it into a full-screen
        * navy cover with grey links you couldn't read and no way to close it
        * (the ☰ button sat underneath). Now it's a light panel in Text2Art's
        * own colours with a close button; Escape and a tap outside close it.
        * The desktop bar above is unchanged.
        */}
      {mobileOpen && (
        <div className="t2a-phone-menu-backdrop" onClick={() => setMobileOpen(false)}>
          <nav id="t2a-phone-menu" className="t2a-phone-menu" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
            <div className="t2a-phone-menu-head">
              <span className="t2a-phone-menu-title">Menu</span>
              <button type="button" className="t2a-phone-menu-close" aria-label="Close menu" onClick={() => setMobileOpen(false)} autoFocus>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {brand.nav[0] && (
              <Link href={brand.nav[0].href} className={pathname === brand.nav[0].href ? 'active' : ''}>{brand.nav[0].label}</Link>
            )}
            {brand.create && (
              <Link href={brand.create.href} className={isCreateActive ? 'active' : ''}>{brand.create.label}</Link>
            )}
            {brand.nav.slice(1).map((link) => (
              <Link key={link.href} href={link.href} className={pathname === link.href ? 'active' : ''}>{link.label}</Link>
            ))}
            <div className="t2a-phone-menu-group">Account</div>
            {brand.showVideoFeatures && (
              <Link href="/analytics" className={pathname === '/analytics' ? 'active' : ''}>Analytics</Link>
            )}
            {brand.showVideoFeatures && (
              <Link href="/social-media" className={pathname === '/social-media' ? 'active' : ''}>
                AI Social{hasSocialAddon ? '' : ' (add-on)'}
              </Link>
            )}
            {brand.showVideoFeatures && (
              <Link href="/brands" className={pathname.startsWith('/brands') ? 'active' : ''}>{NAMES.brands}</Link>
            )}
            <Link href="/settings" className={pathname === '/settings' ? 'active' : ''}>Settings</Link>
            <Link href="/affiliate" className={pathname.startsWith('/affiliate') ? 'active' : ''}>Affiliate Program</Link>
            <Link href="/help" className={pathname.startsWith('/help') ? 'active' : ''}>Help Center</Link>
            {showAdmin && (
              <Link href="/admin" className={pathname.startsWith('/admin') ? 'active' : ''}>Admin</Link>
            )}
            <form action={logout}>
              <button type="submit" className="t2a-phone-menu-signout">Sign Out</button>
            </form>
          </nav>
        </div>
      )}
    </header>
  )
}
