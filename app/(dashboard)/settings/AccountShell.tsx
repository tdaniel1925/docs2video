'use client'

import { Suspense, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChartNoAxesColumn, CreditCard, HandCoins, Mail, Megaphone, Palette, UserRound, type LucideIcon } from 'lucide-react'
import { useBrand } from '../../_components/BrandProvider'
import { accountItems, currentItem, sectionFromParams, type AccountItemId } from './account-sections'

const ICONS: Record<AccountItemId, LucideIcon> = {
  profile: UserRound,
  billing: CreditCard,
  brand: Palette,
  email: Mail,
  analytics: ChartNoAxesColumn,
  affiliate: HandCoins,
  social: Megaphone,
}

/**
 * THE ACCOUNT AREA (round B) — VidWiz's left menu with icons; on phones the
 * same items become one row you swipe sideways. Wraps /settings, /analytics
 * and /affiliate (each through its own layout.tsx), so the menu is the same
 * wherever you are in your account.
 */
export default function AccountShell({ hasSocial, children }: { hasSocial: boolean; children: React.ReactNode }) {
  return (
    <div className="kit-account">
      <Suspense fallback={<nav className="kit-account-menu" aria-label="Your account" />}>
        <AccountMenu hasSocial={hasSocial} />
      </Suspense>
      <div className="kit-account-body">{children}</div>
    </div>
  )
}

function AccountMenu({ hasSocial }: { hasSocial: boolean }) {
  const storefront = useBrand()
  const pathname = usePathname() ?? ''
  const params = useSearchParams()
  const section = sectionFromParams((k) => params?.get(k) ?? null, { showVideoFeatures: storefront.showVideoFeatures })
  const here = currentItem(pathname, section)
  // Someone sent to the AI Social section (the add-on checkout, its sign-in
  // return) sees it in the menu even before the add-on shows as active.
  const items = accountItems({ showVideoFeatures: storefront.showVideoFeatures, hasSocial: hasSocial || here === 'social' })

  // On a phone the menu is a row you swipe; bring the current item into view
  // (sideways only — the page itself doesn't move).
  const navRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const nav = navRef.current
    const link = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!nav || !link || nav.scrollWidth <= nav.clientWidth) return
    const left = link.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft
    nav.scrollLeft = Math.max(0, left - (nav.clientWidth - link.offsetWidth) / 2)
  }, [here])

  return (
    <nav className="kit-account-menu" aria-label="Your account" ref={navRef}>
      <p className="kit-label kit-account-title">Your account</p>
      <ul>
        {items.map((item) => {
          const Icon = ICONS[item.id]
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className="kit-account-link"
                aria-current={here === item.id ? 'page' : undefined}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
