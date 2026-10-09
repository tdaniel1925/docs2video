'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef, useCallback, type ComponentType } from 'react'
import { ArrowLeft, Bell, Check, CircleHelp, Coins, LibraryBig, Menu as MenuIcon, Palette, Plus, Users, X, type LucideProps } from 'lucide-react'
import NotificationBell from './NotificationBell'
import BuyCreditsModal from './BuyCreditsModal'
import ClassicHeader from './ClassicHeader'
import HowToUseDialog from './HowToUse'
import { ThemeToggle } from './theme'
import { Button, Chip } from './kit'
import { logout } from '../_actions/auth'
import type { Profile } from '../_lib/types'
import { DOCS2VIDEO, type Brand } from '../_lib/brand'
import { NAMES, planLabel } from '../_lib/names'
import { ACCOUNT_MENU, OPEN_HELP_EVENT, SIGN_OUT, creditLevel, focusTitle, isCurrent, isFocusPath } from '../_lib/top-bar'
import { STEPS, stepIndexFor } from '../(dashboard)/create/_components/workspace/steps'

/* ONE ICON SET (round A): lucide, the set VidWiz uses. Two sizes only — 16 in
   buttons and menus, 20 for the bell and the phone menu button. Icons sit
   next to words, so they are decoration: lucide marks them aria-hidden. */
const NAV_ICONS: Record<string, ComponentType<LucideProps>> = {
  '/videos': LibraryBig,
  '/clients': Users,
  '/brands': Palette,
}

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
  return <KitHeader profile={profile} brand={brand} lowCreditsAt={lowCreditsAt} />
}

/** Making something gets the quiet focus header; everything else the full bar. */
function KitHeader({ profile, brand, lowCreditsAt }: { profile: Profile; brand: Brand; lowCreditsAt: number }) {
  const pathname = usePathname() ?? ''
  if (isFocusPath(pathname)) return <FocusHeader brand={brand} pathname={pathname} lowCreditsAt={lowCreditsAt} />
  return <TopBar profile={profile} brand={brand} lowCreditsAt={lowCreditsAt} />
}

/** The balance, read once per page. Null until it arrives (no chip flashes 0). */
function useCredits(): number | null {
  const [credits, setCredits] = useState<number | null>(null)
  useEffect(() => {
    fetch('/api/credits/balance')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && typeof d.balance === 'number') setCredits(d.balance) })
      .catch(() => {})
  }, [])
  return credits
}

/** The gold credit chip — the same one in both headers. Press it to top up. */
function CreditChip({ credits, lowCreditsAt, onTopUp }: { credits: number; lowCreditsAt: number; onTopUp: () => void }) {
  const level = creditLevel(credits, lowCreditsAt)
  const balance = credits.toLocaleString('en-US')
  return (
    <button
      type="button"
      className="kit-credit"
      data-level={level}
      onClick={onTopUp}
      aria-label={`${balance} credits${level === 'low' ? ', running low' : ''}. Top up`}
      title={level === 'low' ? 'Not enough left for a standard video — top up' : 'Your credits — press to top up'}
    >
      <Coins size={16} />
      <span>{balance}<span className="kit-credit-long"> credits</span></span>
      <span className="kit-credit-top">
        <span className="kit-credit-long">+ Top Up</span>
        <span className="kit-credit-short">+</span>
      </span>
    </button>
  )
}

/*
 * THE FOCUS HEADER — VidWiz's header while you make something:
 *   ← Home     (1) What it's about  (2) The story  (3) Make it yours  (4) Send it     How to use · credits
 * The step numbers come from the same list as the step rail (steps.ts), so
 * the two can't disagree. Leaving is safe: drafts are saved as you go and
 * wait on Home (the rail's note says so too).
 * On a phone: the arrow, the numbers alone, one help button and the balance.
 */
function FocusHeader({ brand, pathname, lowCreditsAt }: { brand: Brand; pathname: string; lowCreditsAt: number }) {
  const credits = useCredits()
  const [howToOpen, setHowToOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [showBuyCredits, setShowBuyCredits] = useState(false)
  const helpRef = useRef<HTMLDivElement>(null)
  const closeHowTo = useCallback(() => setHowToOpen(false), [])
  const active = stepIndexFor(pathname)

  useEffect(() => { setHelpOpen(false) }, [pathname])
  useEffect(() => {
    if (!helpOpen) return
    const onDown = (e: MouseEvent) => { if (helpRef.current && !helpRef.current.contains(e.target as Node)) setHelpOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setHelpOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [helpOpen])

  return (
    <header className="app-header kit-topbar kit-focusbar" data-testid="focus-header">
      <div className="kit-topbar-inner">
        <Link href={brand.home} className="kit-focusbar-exit" aria-label="Home" title="Your work is saved as you go — it waits on Home">
          <ArrowLeft size={16} />
          <span>Home</span>
        </Link>

        {active >= 0 ? (
          <ol className="kit-focusbar-steps" aria-label="Progress">
            {STEPS.map((step, i) => {
              const state = i < active ? 'done' : i === active ? 'now' : 'todo'
              return (
                <li key={step.label} className={`kit-focusbar-step is-${state}`} aria-current={state === 'now' ? 'step' : undefined}>
                  <span className="kit-focusbar-num" aria-hidden="true">{state === 'done' ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
                  <span className="kit-focusbar-word">{step.short}</span>
                </li>
              )
            })}
          </ol>
        ) : (
          <span className="kit-focusbar-title">{focusTitle(pathname)}</span>
        )}

        <div className="kit-topbar-end">
          <span className="kit-topbar-howto">
            <Button variant="quiet" size="sm" onClick={() => setHowToOpen(true)} aria-haspopup="dialog">
              <CircleHelp size={16} />{NAMES.howToUse}
            </Button>
          </span>
          {/* Phone: one help button holding both kinds of help (the ☰ menu
              that holds them on other screens isn't in this header). */}
          <div className="kit-menu-anchor kit-focusbar-help" ref={helpRef}>
            <button type="button" className="kit-icon-btn" aria-label="Help" aria-haspopup="true" aria-expanded={helpOpen} onClick={() => setHelpOpen(!helpOpen)}>
              <CircleHelp size={20} />
            </button>
            {helpOpen && (
              <div className="kit-menu">
                <button type="button" className="kit-menu-item" onClick={() => { setHelpOpen(false); setHowToOpen(true) }} aria-haspopup="dialog">
                  {NAMES.howToUse} this screen
                </button>
                <button type="button" className="kit-menu-item" onClick={() => { setHelpOpen(false); window.dispatchEvent(new Event(OPEN_HELP_EVENT)) }} aria-haspopup="dialog">
                  Ask the help assistant
                </button>
              </div>
            )}
          </div>
          {credits != null && <CreditChip credits={credits} lowCreditsAt={lowCreditsAt} onTopUp={() => setShowBuyCredits(true)} />}
        </div>
      </div>
      <BuyCreditsModal open={showBuyCredits} onClose={() => setShowBuyCredits(false)} />
      <HowToUseDialog open={howToOpen} onClose={closeHowTo} />
    </header>
  )
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
  const [showBuyCredits, setShowBuyCredits] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const closeHowTo = useCallback(() => setHowToOpen(false), [])

  const credits = useCredits()

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
            <Button href={brand.create.href} size="sm" aria-label={brand.create.label}><Plus size={16} strokeWidth={2.5} />{brand.create.label.replace(/^\+\s*/, '')}</Button>
          )}
          {brand.nav.map((link) => {
            const Icon = NAV_ICONS[link.href]
            return (
              <Link
                key={link.href}
                href={link.href}
                className="kit-topbar-link"
                aria-current={isCurrent(pathname, link.href) ? 'page' : undefined}
              >
                {Icon && <Icon size={16} />}
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="kit-topbar-end">
          <span className="kit-topbar-howto">
            <Button variant="quiet" size="sm" onClick={() => setHowToOpen(true)} aria-haspopup="dialog">
              <CircleHelp size={16} />{NAMES.howToUse}
            </Button>
          </span>

          {credits != null && <CreditChip credits={credits} lowCreditsAt={lowCreditsAt} onTopUp={() => setShowBuyCredits(true)} />}

          <NotificationBell icon={<Bell size={20} color="var(--ink)" />} />

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
                {/* Light / dark (round C). System · Light · Dark is in Settings → Profile. */}
                <ThemeToggle onDone={() => setMenuOpen(false)} />
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
            {phoneOpen ? <X size={20} /> : <MenuIcon size={20} />}
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

