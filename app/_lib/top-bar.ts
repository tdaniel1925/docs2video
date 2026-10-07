// =============================================================================
// DOCS2VIDEO'S TOP BAR — what's in it, kept apart from the drawing so a test
// can read it (the bar itself is a client component with server imports).
//
//   logo (→ Home) · + New · Library · Clients · Brands
//                       How to use · credits (gold) · bell · your initial ▾
//
// Text2Art wears the classic bar (brand.topBar) and none of this applies.
// =============================================================================

import type { Brand } from './brand'

/** The words across the bar, in order: the create button, then the nav. */
export function topBarWords(brand: Brand): string[] {
  return [...(brand.create ? [brand.create.label] : []), ...brand.nav.map((n) => n.label)]
}

/**
 * The account menu behind your initial. Brands is NOT here any more — it's
 * one of the four words in the bar. The plan name sits at the top of the menu
 * (planLabel in names.ts) and Sign out at the bottom.
 */
export const ACCOUNT_MENU: { href: string; label: string; addOnBadge?: boolean; adminOnly?: boolean }[] = [
  { href: '/analytics', label: 'Analytics' },
  // AI Social is a paid add-on; without it the page explains the add-on.
  { href: '/social-media', label: 'AI Social', addOnBadge: true },
  { href: '/affiliate', label: 'Affiliate Program' },
  { href: '/settings', label: 'Settings' },
  { href: '/help', label: 'Help Center' },
  { href: '/admin', label: 'Admin', adminOnly: true },
]

export const SIGN_OUT = 'Sign out'

/**
 * Is the balance running low? Low = not enough left for one standard video
 * (the threshold comes from credits.ts via the layout, never typed here).
 * The chip turns amber then, so it's noticed before a Make button refuses.
 *
 * The old chip divided the balance by the month's remaining credits — a
 * number that is never smaller than the balance — so it was always green.
 */
export function creditLevel(balance: number, lowAt: number): 'ok' | 'low' {
  return balance < lowAt ? 'low' : 'ok'
}

/** Is this nav item the page you're on (or a page under it)? */
export function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/')
}
