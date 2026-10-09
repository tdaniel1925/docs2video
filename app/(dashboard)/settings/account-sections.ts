// =============================================================================
// THE ACCOUNT AREA'S MENU (round B, 2026-10) — VidWiz's layout: a menu down
// the left (a row you can scroll on phones), one section on the right.
//
// Settings, Billing, Brand kit and Email & sending are sections of /settings
// (?tab=…). Analytics and Affiliate keep their own addresses (/analytics,
// /affiliate) and wear the same menu through their layout.tsx, so every old
// link and bookmark still lands where it did.
//
// Pure — no React — so a test can read it.
// =============================================================================

export type SectionId = 'profile' | 'billing' | 'brand' | 'email' | 'social'
export type AccountItemId = SectionId | 'analytics' | 'affiliate'

export type AccountItem = {
  id: AccountItemId
  label: string
  href: string
  /** Docs2Video only (needs share pages / video views). */
  videoOnly?: boolean
  /** Shown only to people who have the AI Social add-on today. */
  socialOnly?: boolean
}

export const ACCOUNT_ITEMS: AccountItem[] = [
  { id: 'profile', label: 'Profile', href: '/settings' },
  { id: 'billing', label: 'Billing & credits', href: '/settings?tab=billing' },
  { id: 'brand', label: 'Brand kit', href: '/settings?tab=brand' },
  { id: 'email', label: 'Email & sending', href: '/settings?tab=email', videoOnly: true },
  { id: 'analytics', label: 'Analytics', href: '/analytics', videoOnly: true },
  { id: 'affiliate', label: 'Affiliate', href: '/affiliate' },
  { id: 'social', label: 'AI Social', href: '/settings?tab=social', socialOnly: true },
]

/** The menu this person sees. */
export function accountItems(opts: { showVideoFeatures: boolean; hasSocial: boolean }): AccountItem[] {
  return ACCOUNT_ITEMS.filter((i) => (!i.videoOnly || opts.showVideoFeatures) && (!i.socialOnly || opts.hasSocial))
}

/**
 * Old ?tab= words (and a few spoken ones) → today's section. Every link the
 * app, emails and Stripe ever sent into Settings is listed here:
 *   ?tab=subscription  (billing portal return, plan change, credit buys)
 *   ?tab=integrations  (email connect, Stripe connect, "What's left" chips)
 *   ?tab=social        (AI Social add-on and its sign-in callback)
 */
const TAB_ALIASES: Record<string, SectionId> = {
  profile: 'profile',
  account: 'profile',
  security: 'profile',
  api: 'profile',
  billing: 'billing',
  subscription: 'billing',
  plan: 'billing',
  plans: 'billing',
  credits: 'billing',
  brand: 'brand',
  'brand-kit': 'brand',
  email: 'email',
  sending: 'email',
  integrations: 'email',
  booking: 'email',
  social: 'social',
}

/**
 * Which section a /settings address opens.
 * - ?tab=… by the table above;
 * - the return words from the connect flows (?email_connected, ?email_error,
 *   ?stripe_connected) → Email & sending; ?credits=… / ?plan_changed → Billing;
 * - Email & sending doesn't exist on Text2Art: its old "integrations" links
 *   (the API keys lived there) open Profile, where the keys are now.
 */
export function sectionFromParams(
  get: (key: string) => string | null,
  opts: { showVideoFeatures: boolean },
): SectionId {
  const tab = (get('tab') ?? '').toLowerCase()
  // Own keys only: ?tab=__proto__ or ?tab=toString must not reach Object's.
  let s: SectionId | undefined = Object.prototype.hasOwnProperty.call(TAB_ALIASES, tab) ? TAB_ALIASES[tab] : undefined
  if (!s) {
    if (get('email_connected') || get('email_error') || get('stripe_connected')) s = 'email'
    else if (get('credits') || get('plan_changed')) s = 'billing'
    else s = 'profile'
  }
  if (s === 'email' && !opts.showVideoFeatures) return 'profile'
  return s
}

/** Which menu item is "here", from the path (and /settings' section). */
export function currentItem(pathname: string, section: SectionId): AccountItemId | null {
  if (pathname === '/settings' || pathname.startsWith('/settings/')) return section
  if (pathname === '/analytics' || pathname.startsWith('/analytics/')) return 'analytics'
  if (pathname === '/affiliate' || pathname.startsWith('/affiliate/')) return 'affiliate'
  return null
}
