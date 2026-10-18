// =============================================================================
// LIGHT START — a new person can look around before giving us a card.
//
// Before (until 2026-10): sign up → "Add your payment method" → a 5-page setup
// wizard → Home. Nobody saw anything the app makes until a card was saved.
//
// Now: sign up → Home → make a first project (steps 1–3, the free first-scene
// preview included) without a card. The card is asked for at the moment it
// matters: pressing "Make it" on a real video, presentation or deck. That rule
// is not new and is not here — it lives in credits.ts (spendBlockReason):
// a free/trial account with no card can't spend credits, on any product.
// The 2,000 trial credits are still tied to the card in the same way.
//
// What IS here: the pure rules (no database) so tests can check them.
// The server half (the daily cap on free reading/writing for cardless
// accounts) is in cardless-prep.ts.
// =============================================================================

/** The one thing we need to know about the storefront. */
type BrandLike = { showVideoFeatures: boolean }

/**
 * Where someone lands right after signing up (or after clicking the
 * "confirm your email" link).
 *
 * Docs2Video: Home — no card yet. Other storefronts (Text2Art) keep the old
 * card-first start; nothing about them changes here.
 */
export function afterSignupPath(brand: BrandLike): string {
  return brand.showVideoFeatures ? '/dashboard' : '/setup-payment'
}

/**
 * The "confirm your email" links already sitting in people's inboxes (and the
 * Supabase email template) say `next=/setup-payment`. On Docs2Video that plain
 * card page is no longer the first stop, so it becomes Home. A card page with
 * its own `?next=` (sent there by "Make it") is left alone.
 */
export function landingAfterEmailLink(next: string, brand: BrandLike): string {
  if (brand.showVideoFeatures && next === '/setup-payment') return afterSignupPath(brand)
  return next
}

// ── Free reading/writing for accounts with no card ──────────────────────────
//
// Steps 1–2 (reading the document, writing the story, asking for changes) are
// free for everyone, but they do cost us a little AI time. An account with no
// card gets this many of those a day (UTC), counted in the existing
// rate_limits table. Plenty for trying it out (one project is about 3–6);
// it stops one person opening many accounts to use the AI for free.
export const CARDLESS_PREP_PER_DAY = 30

/** How long the counter row lives — longer than a day; the DAY is in the key. */
export const CARDLESS_PREP_WINDOW_SECS = 2 * 24 * 60 * 60

/** The rate_limits key for one cardless account's free reading/writing today. */
export function cardlessPrepKey(userId: string, now: Date): string {
  return `cardless-prep:${userId}:${now.toISOString().slice(0, 10)}`
}

/** Said when the day's free reading/writing is used up. */
export const CARDLESS_PREP_CAP_MESSAGE =
  'You’ve tried a lot today without a card. Add a card to keep going now, or come back tomorrow.'

// ── The daily ceiling on free AI steps for EVERY account ────────────────────
//
// Audit 2026-10-09: the free AI steps (reading, writing, chat helpers, the
// microphone) were unlimited for any account with a card. One account could
// run them all day at our cost. Every non-admin account now has a generous
// daily ceiling — far above real use (a busy day is a few dozen) — counted the
// same way as the cardless cap.
export const AI_STEPS_PER_DAY = 300

/** The rate_limits key for one account's free AI steps today (UTC). */
export function aiDailyKey(userId: string, now: Date): string {
  return `ai-daily:${userId}:${now.toISOString().slice(0, 10)}`
}

export const AI_DAILY_CAP_MESSAGE =
  'You’ve reached today’s limit for the free AI helpers. It resets at midnight UTC — or contact support if you need more today.'

/** Said when the counter itself can't be checked (we stop rather than run unmetered). */
export const AI_CAP_UNAVAILABLE_MESSAGE =
  'This step is resting for a moment. Please try again in a minute.'
