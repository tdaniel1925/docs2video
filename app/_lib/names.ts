// =============================================================================
// ONE NAME PER THING.
//
// The button that starts something new said "+ Create" in the top bar,
// "+ New project" on Home and "+ New Creation" in the Library. A saved logo and
// colours was "Brand profiles" in the menu, "Your profiles" on its own page and
// "default brand" in Settings. Different words read as different things, so
// people went looking for a second feature that doesn't exist.
//
// Every screen that names one of these reads the word from here, so they can't
// drift apart again. Only what people READ lives here — URLs, database values
// and Stripe keys keep their old names.
//
// Imports only pricing.ts (which imports nothing), so client components, server
// components and brand.ts can all use it.
// =============================================================================

import { getPlan, getUserTier } from './pricing'

export const NAMES = {
  /** The one button that starts something new. Same words on every screen. */
  newButton: '+ New',
  /** Where everything you've made lives. */
  library: 'Library',
  /** The people you send things to. */
  clients: 'Clients',
  /** A saved logo + colours (a company) or name + photo (a person). */
  brand: 'Brand',
  brands: 'Brands',
  newBrand: '+ New brand',
  /** The top-bar button that explains the screen you're on. */
  howToUse: 'How to use',
  /** The recommended video look (id 'slides'). Was "Slide Deck", which read
   *  like the retired silent slide-deck product (audit 2026-10-09). */
  animatedSlidesLook: 'Animated slides',
} as const

/**
 * The kinds of thing the Library files your work under, and what each is
 * called. Home's "Made" column and the Library's type column and tabs all read
 * these, so a presentation is a "Presentation" on both screens.
 */
export type LibraryKind = 'video' | 'presentation' | 'deck' | 'graphic'

export const KIND_NAMES: Record<LibraryKind, { one: string; many: string }> = {
  video: { one: 'Video', many: 'Videos' },
  presentation: { one: 'Presentation', many: 'Presentations' },
  deck: { one: 'Slide deck', many: 'Slide decks' },
  graphic: { one: 'Graphic', many: 'Graphics' },
}

/**
 * Which Library kind a videos row is, from its output_type. Commercials are
 * videos: nothing in the data marks them apart (generate-commercial writes a
 * plain videos row), so they file under Videos. Old PowerPoint / PDF exports
 * are slides, so they file with the slide decks.
 */
export function kindOfOutput(outputType: string | null | undefined): LibraryKind {
  switch (outputType) {
    case 'interactive': return 'presentation'
    case 'deck':
    case 'pptx':
    case 'pdf': return 'deck'
    default: return 'video'
  }
}

/**
 * The customer's plan, named the way pricing.ts names it. The avatar menu used
 * to say "Pro Member" only for pro/professional/active/agency, so Business,
 * Enterprise and trial customers were told they had a "Free Account".
 *
 * Past-due is said as what it is (its tier can't be read from the status).
 * A 'trial' account IS the free plan, so it gets the free plan's ONE name
 * from pricing.ts — the billing card used to say "Free trial" right above a
 * plan list that said "Pay As You Go" (audit 2026-10-09).
 */
export function planName(subscriptionStatus: string | null | undefined): string {
  const status = (subscriptionStatus ?? '').toLowerCase()
  if (status === 'past_due') return 'Payment due'
  return getPlan(getUserTier(status)).label
}

/** planName as a line on its own: "Pro plan", "Pay As You Go". */
export function planLabel(subscriptionStatus: string | null | undefined): string {
  const name = planName(subscriptionStatus)
  const status = (subscriptionStatus ?? '').toLowerCase()
  return status !== 'past_due' && getUserTier(status) !== 'free' ? `${name} plan` : name
}
