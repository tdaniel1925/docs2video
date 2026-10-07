'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import NotificationBell from './NotificationBell'
import BuyCreditsModal from './BuyCreditsModal'
import ClassicHeader from './ClassicHeader'
import HowToUseDialog from './HowToUse'
import { Button, Chip } from './kit'
import { logout } from '../_actions/auth'
import type { Profile } from '../_lib/types'
import { DOCS2VIDEO, type Brand } from '../_lib/brand'
import { NAMES, planLabel } from '../_lib/names'
import { ACCOUNT_MENU, OPEN_HELP_EVENT, SIGN_OUT, creditLevel, isCurrent } from '../_lib/top-bar'

/*
 * THE TOP BAR. Which bar a storefront wears is its brand's choice
 * (brand.topBar): Docs2Video has the overhaul bar below; Text2Art keeps the
 * classic one, untouched, in ClassicHeader.tsx.
 */
export default function Header({ profile, brand = DOCS2VIDEO, lowCreditsAt = 0 }: {
  profile: Profile
  brand?: Brand
  /** Below this many credits the chip turns amber (from credits.ts). */
  lowCreditsAt?: number
}) {
  if (brand.topBar === 'classic') return <ClassicHeader profile={profile} brand={brand} />
  return <TopBar profile={profile} brand={brand} lowCreditsAt={lowCreditsAt} />
}

/*
 * Docs2Video's bar — the sibling apps' calm one:
 *   logo (Home) · + New · Library · Clients · Brands
 *                         How to use · credits (gold) · bell · your initial
 * On a phone the four words and How to use move into the ☰ menu.
 */
function TopBar({ profile, brand, lowCreditsAt }: { profile: Profile; brand: Brand; lowCreditsAt: number }) {
  const pathname = usePathname() ?? ''
  const [menuOpen, setMenuOpen] = useState(false)
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [howToOpen, setHowToOpen] = useState(false)
  const [credits, setCredits] = useState<number | null>(null)
  const [showBuyCredits, setShowBuyCredits] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const closeHowTo = useCallback(() => setHowToOpen(false), [])

  useEffect(() => {
    fetch('/api/credits/balance')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && typeof d.balance === 'number') setCredits(d.balance) })
      .catch(() => {})
  }, [])

  // A new screen closes the menus.
  useEffect(() => { setMenuOpen(false); setPhoneOpen(false) }, [pathname])

  // The account menu closes on a click elsewhere or Escape (it used to stay
  // open until you pressed the avatar again).
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [menuOpen])

  const hasSocialAddon = !!(profile as Profile & { social_addon_active?: boolean }).social_addon_active
  const initial = profile.full_name?.[0]?.toUpperCase() ?? profile.email[0].toUpperCase()
  const level = credits == null ? 'ok' : creditLevel(credits, lowCreditsAt)
  const balance = credits?.toLocaleString('en-US') ?? ''

  return (
    <header className="app-header kit-topbar">
      <div className="kit-topbar-inner">
        <Link href={brand.home} className="kit-topbar-logo" aria-label={`${brand.name} — Home`}>
          {brand.logoSrc
            ? <img src={brand.logoSrc} alt="" />
            : <span className="kit-card-title">{brand.name}</span>}
        </Link>

        <nav className="kit-topbar-nav" aria-label="Main">
          {brand.create && (
            <Button href={brand.create.href} size="sm">{brand.create.label}</Button>
          )}
          {brand.nav.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="kit-topbar-link"
              aria-current={isCurrent(pathname, link.href) ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="kit-topbar-end">
          <span className="kit-topbar-howto">
            <Button variant="quiet" size="sm" onClick={() => setHowToOpen(true)} aria-haspopup="dialog">
              <QuestionIcon />{NAMES.howToUse}
            </Button>
          </span>

          {credits != null && (
            <button
              type="button"
              className="kit-credit"
              data-level={level}
              onClick={() => setShowBuyCredits(true)}
              aria-label={`${balance} credits${level === 'low' ? ', running low' : ''}. Top up`}
              title={level === 'low' ? 'Not enough left for a standard video — top up' : 'Your credits — press to top up'}
            >
              <CoinIcon />
              <span>{balance}<span className="kit-credit-long"> credits</span></span>
              <span className="kit-credit-top">
                <span className="kit-credit-long">+ Top Up</span>
                <span className="kit-credit-short">+</span>
              </span>
            </button>
          )}

          <NotificationBell />

          <div className="kit-menu-anchor" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="app-user kit-avatar-btn"
              aria-haspopup="true"
              aria-expanded={menuOpen}
              aria-label="Your account"
            >
              <span className="app-avatar">{initial}</span>
            </button>

            {menuOpen && (
              <div className="kit-menu">
                <div className="kit-menu-head">
                  <div className="kit-menu-name">{profile.full_name || profile.email}</div>
                  {/* The real plan name from pricing.ts (names.ts). */}
                  <div className="kit-menu-plan">{planLabel(profile.subscription_status)}</div>
                </div>
                <hr className="kit-menu-sep" />
                {ACCOUNT_MENU.filter((item) => !item.adminOnly || profile.is_admin === true).map((item) => (
                  <Link key={item.href} href={item.href} className="kit-menu-item" onClick={() => setMenuOpen(false)}>
                    <span>{item.label}</span>
                    {item.addOnBadge && !hasSocialAddon && <Chip>Add-on</Chip>}
                  </Link>
                ))}
                <hr className="kit-menu-sep" />
                <form action={logout}>
                  <button type="submit" className="kit-menu-item">{SIGN_OUT}</button>
                </form>
              </div>
            )}
          </div>

          <button
            type="button"
            className="kit-icon-btn kit-topbar-menu-btn"
            onClick={() => setPhoneOpen(!phoneOpen)}
            aria-label="Menu"
            aria-expanded={phoneOpen}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {phoneOpen
                ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
            </svg>
          </button>
        </div>
      </div>

      {/* Phone menu: the four words and How to use. Your account stays behind
          your initial, as on a computer. */}
      {phoneOpen && (
        <nav className="kit-phone-menu" aria-label="Phone menu">
          {brand.create && <Link href={brand.create.href} className="kit-menu-item">{brand.create.label}</Link>}
          {brand.nav.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="kit-menu-item"
              aria-current={isCurrent(pathname, link.href) ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
          <button type="button" className="kit-menu-item" onClick={() => { setPhoneOpen(false); setHowToOpen(true) }} aria-haspopup="dialog">
            {NAMES.howToUse} this screen
          </button>
          {/* On a phone the help assistant lives here, not as a round button
              floating over the page (HelpChatWidget). */}
          <button type="button" className="kit-menu-item" onClick={() => { setPhoneOpen(false); window.dispatchEvent(new Event(OPEN_HELP_EVENT)) }} aria-haspopup="dialog">
            Ask the help assistant
          </button>
        </nav>
      )}

      <BuyCreditsModal open={showBuyCredits} onClose={() => setShowBuyCredits(false)} />
      <HowToUseDialog open={howToOpen} onClose={closeHowTo} />
    </header>
  )
}

function QuestionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function CoinIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v12M15 9.5c0-1.38-1.34-2.5-3-2.5s-3 1.12-3 2.5 1.34 2.5 3 2.5 3 1.12 3 2.5-1.34 2.5-3 2.5" />
    </svg>
  )
}
