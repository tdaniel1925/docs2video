import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from './supabase/admin'
import { getUserTier, type PlanTier } from './pricing'

// ============================================================
// Credit costs per action (inflated numbers — big feels generous)
// ============================================================
// Pricing doubled 2026-06-21 to restore healthy margin (real video cost is
// ~$1.40 cinematic at Gemini 3 Pro Image rates; old costs left ~50% / negative
// margin on bigger plans). Plans + monthly credit grants are unchanged, so
// doubling these costs = each plan yields half as many videos = a 2x price
// increase with no Stripe/plan changes. Existing paying customers are
// grandfathered (see GRANDFATHERED_USER_IDS below).
export const CREDIT_COSTS = {
  // Legacy actions (keep for backward compat)
  video: 1000,
  infographic: 300,
  logo: 400,
  'logo-refine': 100,
  'business-card': 200,
  flyer: 200,
  headshot: 400,    // fans out ~20 image generations
  'social-kit': 400, // fans out 20+ image generations
  template: 400,
  'template-refine': 100,
  // Interactive presentation (flagship — HTML-first, narrated, shareable)
  interactive: 700,
  // MP4 export derived from a finished presentation (render-service capture+mux)
  videoExport: 400,
  // Deck builder (flagship product #2)
  deck: 600,
  // Produced commercial (URL/text → brand-matched commercial). Single source of
  // truth — the /generate-commercial UI route + the v1 API both read this.
  commercial: 600,
  // New granular video actions.
  //
  // "DRAWN SLIDES" LOOK (videoStyle 'drawn', app/_lib/drawn-slides.ts) is
  // priced like every other video look — no extra charge — ON PURPOSE.
  // Measured 2026-10-09 (scripts/look-samples/make-drawn-samples.ts, 6 real
  // fal calls, gpt-image-2.5 flare, 1920x1088): quality 'low' spelled every
  // word and every $ figure right on all 6 slides across the 3 drawing
  // styles, in 11-24 s each. fal bills per megapixel: low = ~0.29c a slide
  // (text-to-image); the later slides of a video also send the first slide
  // as a style reference (fal "edit"), estimated at up to ~2c each.
  // A standard video is ~12 slides (cover + ~10 + closing):
  //   ~3.5c (no reference) to ~25c (reference on every slide, worst case).
  // 3x margin = at most ~75c ≈ 190 credits (1 credit ≈ $0.004) — well under
  // videoStandard's 1,000 credits, and cheaper than the old Gemini-drawn
  // slides on this same route (~13c a slide). If fal fails, Gemini draws the
  // slide instead (~13c) — still covered. So the normal video price stands.
  // Every drawn slide is also SPELL-CHECKED (render-service/slide-spellcheck.js:
  // Gemini 2.5 Flash read-back, ~0.1c a check); a slide with a dropped or
  // squeezed word is redrawn once (+~0.3c fal + one more check). ~12 slides
  // ≈ +1.2c when all pass — still covered.
  videoQuick: 500,
  videoStandard: 1000,
  videoDetailed: 1500,
  podcastAddon: 400,
  pptx: 800,
  pdf: 600,
  stylePreview: 100,
  scriptRegen: 50,
  aiChatEdit: 50,
  videoIllustrated: 1500,  // 3 frames per scene = 3x image generation
  // Image-gen routes that previously charged NOTHING (un-metered spend). Priced
  // by how many paid image generations each fans out.
  'brand-kit': 400,        // fans out ~7 image generations (4 logos + 3 social)
  'logo-chat': 100,        // single logo refine/edit
  'demo-slide': 100,       // single slide image
  'scene-edit': 100,       // single scene image edit
  'upscale-logo': 100,     // single upscale
  // Fix-a-Scene on a slide-deck video: re-renders the video with ONE edited
  // scene (skips comprehension/writing/backdrops/other VO). Only charged when the
  // user CHANGES content (edit-text) — fixing our glitches (re-record, bad
  // pronunciation) is FREE (the app passes amount 0 for those).
  'slide-scene-fix': 50,
  // Tools that used to charge a flat 1 credit — often AFTER the work, ignoring
  // a failed deduction (audit 2026-09-26). Priced like the equivalent tools
  // above by how many paid AI generations they make.
  'image-remix': 200,        // one full design image (same model/work as a flyer)
  ad: 200,                   // per ad size generated (one designed image each)
  'brand-deck': 400,         // 4 AI reference slides
  'social-post-image': 100,  // per campaign post graphic
  'email-signature': 50,     // template HTML, no AI — the smallest charge
} as const

// Pre-existing paying customers locked at the OLD (pre-2x) rates. They keep the
// original cost per action; everyone else pays CREDIT_COSTS above.
const OLD_CREDIT_COSTS: Partial<Record<string, number>> = {
  video: 500, infographic: 150, logo: 200, 'logo-refine': 50,
  'business-card': 100, flyer: 100, headshot: 200, 'social-kit': 200,
  template: 200, 'template-refine': 50, deck: 300,
  videoQuick: 250, videoStandard: 500, videoDetailed: 750,
  podcastAddon: 200, pptx: 400, pdf: 300, stylePreview: 50,
  scriptRegen: 25, aiChatEdit: 25, videoIllustrated: 750,
}

// User IDs grandfathered at OLD rates. Add early/loyal customers here.
export const GRANDFATHERED_USER_IDS = new Set<string>([
  // Aziz Ali (azizali.insurance@gmail.com) — first paying customer, locked at
  // pre-2x pricing as of 2026-06-21.
  '777c8d8c-7835-4007-a683-5eaad0f99969',
])

/** Cost for an action, honoring grandfathered users (old rates). */
export function costForUser(action: CreditAction, userId?: string | null): number {
  if (userId && GRANDFATHERED_USER_IDS.has(userId)) {
    return OLD_CREDIT_COSTS[action] ?? CREDIT_COSTS[action]
  }
  return CREDIT_COSTS[action]
}

export type CreditAction = keyof typeof CREDIT_COSTS

/**
 * The cheapest thing a user can spend credits on. A trial user whose balance
 * drops below this can't do ANYTHING, so that is when the trial should convert
 * (audit H15: the old "balance must hit exactly 0" rule stranded trial users
 * with a few leftover credits — they could never convert and never create).
 */
export const MIN_ACTION_COST = Math.min(...Object.values(CREDIT_COSTS))

/** Why a user may not spend credits right now, or null when they may. */
export type SpendBlockReason = 'past_due' | 'banned' | 'card_required' | 'no_profile'

/**
 * Pure rule for "may this user spend credits at all?" — shared by
 * checkCredits and deductCredits so EVERY product enforces the same thing
 * (audit H15: only video checked for a card, so the 2,000 free trial credits
 * could be spent on every other tool without ever adding a card).
 *  - admins / beta (promo) accounts: always allowed
 *  - past_due / banned: never (payment failed or account blocked)
 *  - free or trial tier without a saved card: must add a card first
 *  - no profile row could be read: deny (money path — fail closed)
 */
export function spendBlockReason(profile: {
  is_admin?: boolean | null
  is_beta?: boolean | null
  subscription_status?: string | null
  card_on_file?: boolean | null
} | null | undefined): SpendBlockReason | null {
  if (!profile) return 'no_profile'
  if (profile.is_admin || profile.is_beta) return null
  if (profile.subscription_status === 'past_due') return 'past_due'
  if (profile.subscription_status === 'banned') return 'banned'
  if (getUserTier(profile.subscription_status ?? null) === 'free' && !profile.card_on_file) return 'card_required'
  return null
}

/** A short, user-facing sentence for each block reason. */
export function spendBlockMessage(reason: SpendBlockReason): string {
  switch (reason) {
    case 'card_required': return 'Add a card to start your free trial.'
    case 'past_due': return 'Your last payment did not go through. Please update your card in Billing to keep creating.'
    case 'banned': return 'This account cannot create new content. Please contact support.'
    default: return 'We could not check your account just now. Please try again.'
  }
}

// Monthly credit grants per tier
export const TIER_CREDITS: Record<PlanTier, number> = {
  // Free trial = 2000 so a new user can actually make videos: a standard video
  // costs 1000 (post-2x), so 1000 only allowed ONE and any add-on/detailed put
  // it over budget → "not enough credits" on signup. 2000 = ~2 standard videos.
  free: 2000,
  starter: 5000,
  pro: 25000,
  business: 75000,
  enterprise: 200000,
}

// Overage rate per 1,000 credits (in cents)
export const TIER_OVERAGE_RATE: Record<PlanTier, number> = {
  free: 0,
  starter: 500,
  pro: 500,
  business: 400,
  enterprise: 300,
}

// Approximate explainers per tier (for pricing page)
// Halved 2026-06-21 after the 2x credit-cost increase (standard video now
// costs 1000 credits, quick 500). Keep in sync with CREDIT_COSTS.
export const TIER_APPROX_VIDEOS: Record<PlanTier, { standard: number; quick: number }> = {
  free: { standard: 2, quick: 4 },
  starter: { standard: 5, quick: 10 },
  pro: { standard: 25, quick: 50 },
  business: { standard: 75, quick: 150 },
  enterprise: { standard: 200, quick: 400 },
}

// ============================================================
// Core functions
// ============================================================

export function getCreditCost(action: CreditAction): number {
  return CREDIT_COSTS[action]
}

export interface CreditBalance {
  monthly: number
  topup: number
  total: number
  cycleUsed: number
  cycleGranted: number
}

export interface CreditCheckResult {
  allowed: boolean
  remaining: number
  shortfall: number
  /** Set when the user is blocked for a reason other than balance (no card,
   *  payment failed, banned). Callers should show spendBlockMessage(reason)
   *  instead of "not enough credits". */
  blockedReason?: SpendBlockReason
}

/**
 * Get user's credit balance. Self-heals: if no credit_balances row exists yet
 * (new signup, or pre-migration account), one is created at the user's tier
 * grant via ensureCreditBalance — so the stale legacy profiles.credits_remaining
 * default (10) is never shown or spent.
 */
export async function getBalance(userId: string): Promise<CreditBalance> {
  const admin = createAdminClient()

  // Try the credit_balances table first.
  const { data } = await admin
    .from('credit_balances')
    .select('balance, topup_balance, cycle_credits_used, cycle_credits_granted')
    .eq('user_id', userId)
    .single()

  if (data) {
    return {
      monthly: data.balance,
      topup: data.topup_balance,
      total: data.balance + data.topup_balance,
      cycleUsed: data.cycle_credits_used,
      cycleGranted: data.cycle_credits_granted,
    }
  }

  // No row yet — create one at the user's tier grant (self-heal), then re-read.
  // This is the fix for "new user's credits disappeared": previously this path
  // returned the misleading profiles.credits_remaining DEFAULT 10.
  const { data: profile } = await admin
    .from('profiles')
    .select('subscription_status')
    .eq('id', userId)
    .single()

  await ensureCreditBalance(userId, profile?.subscription_status || 'free')

  const { data: fresh } = await admin
    .from('credit_balances')
    .select('balance, topup_balance, cycle_credits_used, cycle_credits_granted')
    .eq('user_id', userId)
    .single()

  if (fresh) {
    return {
      monthly: fresh.balance,
      topup: fresh.topup_balance,
      total: fresh.balance + fresh.topup_balance,
      cycleUsed: fresh.cycle_credits_used,
      cycleGranted: fresh.cycle_credits_granted,
    }
  }

  // Last-resort fallback (should not happen): zero, never the misleading 10.
  return { monthly: 0, topup: 0, total: 0, cycleUsed: 0, cycleGranted: 0 }
}

export async function checkCredits(userId: string, needed: number): Promise<CreditCheckResult> {
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('subscription_status, is_admin, is_beta, card_on_file')
    .eq('id', userId)
    .single()

  // Admin/beta bypass — unlimited credits
  if (profile?.is_admin || profile?.is_beta) {
    return { allowed: true, remaining: 999999, shortfall: 0 }
  }

  // Blocked for a reason that has nothing to do with balance: payment failed
  // (past_due), banned (review B21 — 'banned' used to fall through to the free
  // allotment), or a free/trial account with no card on file (audit H15 — the
  // card-required trial was only enforced for video).
  const blocked = spendBlockReason(profile)
  if (blocked) {
    return { allowed: false, remaining: 0, shortfall: needed, blockedReason: blocked }
  }

  // getBalance() self-heals via ensureCreditBalance: a first-time user gets
  // exactly one credit_balances row at their tier grant. This is now the ONLY
  // place a first grant happens — checkCredits no longer mutates the wallet
  // (no mid-cycle re-grant), so it's a pure "can they afford this" check.
  const balance = await getBalance(userId)

  const allowed = balance.total >= needed
  if (!allowed && profile?.subscription_status === 'trial') {
    // A trial user just tried something their free credits can't cover — that
    // IS "the free credits ran out", from whichever product they were in.
    // Convert the trial now so the plan they picked starts (audit H15).
    await endTrialIfDepleted(userId, { attemptedCost: needed })
  }
  return {
    allowed,
    remaining: balance.total,
    shortfall: allowed ? 0 : needed - balance.total,
  }
}

/**
 * Put back a deduction whose ledger row could not be written. Compare-and-set
 * on the CURRENT balances (a few tries, in case another charge lands at the
 * same moment), so it never overwrites someone else's change. True when the
 * credits are back.
 */
export async function restoreDeduction(
  admin: SupabaseClient,
  userId: string,
  monthly: number,
  topup: number,
  amount: number,
): Promise<boolean> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: row, error: readErr } = await admin
      .from('credit_balances')
      .select('balance, topup_balance, cycle_credits_used')
      .eq('user_id', userId)
      .single()
    if (readErr || !row) return false
    const { data: put, error: putErr } = await admin
      .from('credit_balances')
      .update({
        balance: row.balance + monthly,
        topup_balance: row.topup_balance + topup,
        cycle_credits_used: Math.max(0, (row.cycle_credits_used || 0) - amount),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('balance', row.balance)
      .eq('topup_balance', row.topup_balance)
      .select('user_id')
    if (putErr) return false
    if (put && put.length > 0) return true
  }
  return false
}

/**
 * Deduct credits — BACKWARD COMPATIBLE.
 * Accepts the old (admin, userId, amount) signature so existing API routes keep working.
 * Also supports new extended signature with action tracking.
 */
export async function deductCredits(
  adminOrUserId: SupabaseClient | string,
  userIdOrAmount: string | number,
  amountOrAction?: number | string,
  videoId?: string,
  description?: string,
  _attempt = 0,
): Promise<boolean> {
  // Bound the CAS-race retry so a persistent failure can never loop forever
  // (audit #3: previously unbounded recursion → hung requests / DB exhaustion).
  const MAX_ATTEMPTS = 5
  // Detect old vs new call signature
  let userId: string
  let amount: number
  let action: string

  if (typeof adminOrUserId === 'string') {
    // New signature: deductCredits(userId, amount, action, videoId?, description?)
    userId = adminOrUserId
    amount = userIdOrAmount as number
    action = (amountOrAction as string) || 'unknown'
  } else {
    // Old signature: deductCredits(admin, userId, amount)
    userId = userIdOrAmount as string
    amount = amountOrAction as number
    action = 'legacy'
  }

  const admin = createAdminClient()

  // Check admin/beta bypass
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin, is_beta, subscription_status, card_on_file')
    .eq('id', userId)
    .single()

  // Same spend rule as checkCredits, enforced HERE too because several routes
  // deduct without checking first (audit H15). Negative amounts are refunds
  // (a few legacy routes refund by deducting -N) and must always go through.
  if (amount > 0) {
    const blocked = spendBlockReason(profile)
    if (blocked) {
      console.log(`[credits] Spend blocked (${blocked}) for user ${userId}: ${action} (${amount} credits)`)
      return false
    }
  }

  if (profile?.is_admin || profile?.is_beta) {
    // Log admin bypass for audit trail
    const { error: auditErr } = await admin.from('credit_transactions').insert({
      user_id: userId,
      amount: 0,
      balance_after: 0,
      action: `admin_bypass:${action}`,
      video_id: videoId || null,
      description: `Admin/beta bypass: ${action} (${amount} credits would have been charged)`,
    })
    if (auditErr) console.warn(`[credits] Admin audit log failed:`, auditErr.message)
    console.log(`[credits] Admin/beta bypass for user ${userId}: ${action} (${amount} credits)`)
    return true
  }

  // Atomic deduction using conditional update — prevents race conditions
  // Only deducts if balance >= amount at the moment of update
  let { data: balanceRow } = await admin
    .from('credit_balances')
    .select('balance, topup_balance, cycle_credits_used')
    .eq('user_id', userId)
    .single()

  // No wallet row yet (new/pre-migration account) — create one at the tier
  // grant, then read it back. NEVER fall through to the dead legacy column
  // (audit #7). Guard against an infinite create→read loop.
  if (!balanceRow && _attempt === 0) {
    const { data: prof } = await admin.from('profiles').select('subscription_status').eq('id', userId).single()
    await ensureCreditBalance(userId, prof?.subscription_status || 'free')
    const reread = await admin
      .from('credit_balances')
      .select('balance, topup_balance, cycle_credits_used')
      .eq('user_id', userId)
      .single()
    balanceRow = reread.data
  }

  if (balanceRow) {
    const total = balanceRow.balance + balanceRow.topup_balance
    if (total < amount) {
      console.log(`[credits] Insufficient: need ${amount}, have ${total} (user ${userId})`)
      // Trial user out of free credits for this action → start their plan
      // (audit H15; works from every product, not only video).
      if (profile?.subscription_status === 'trial') {
        await endTrialIfDepleted(userId, { attemptedCost: amount })
      }
      return false
    }

    // Deduct from monthly first, then topup
    const monthlyDeduct = Math.min(amount, balanceRow.balance)
    const topupDeduct = amount - monthlyDeduct
    const newMonthly = Math.max(0, balanceRow.balance - monthlyDeduct)
    const newTopup = Math.max(0, balanceRow.topup_balance - topupDeduct)
    const newTotal = newMonthly + newTopup

    // Atomic update: use .eq on both user_id AND current balance to prevent race condition
    // If another request already deducted, the balance won't match and update returns 0 rows
    const { data: updated, error: updateErr } = await admin
      .from('credit_balances')
      .update({
        balance: newMonthly,
        topup_balance: newTopup,
        cycle_credits_used: (balanceRow.cycle_credits_used || 0) + amount,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('balance', balanceRow.balance)
      .eq('topup_balance', balanceRow.topup_balance)
      .select('user_id')

    if (updateErr) {
      // Hard failure (RLS, constraint, network) — do NOT retry; abort.
      console.error(`[credits] deductCredits hard error for user ${userId}:`, updateErr.message)
      return false
    }
    if (!updated || updated.length === 0) {
      // Zero rows = CAS race (balance changed between read and write). Retry
      // with a fresh read, up to MAX_ATTEMPTS.
      if (_attempt + 1 >= MAX_ATTEMPTS) {
        console.error(`[credits] deductCredits gave up after ${MAX_ATTEMPTS} contended attempts for user ${userId}`)
        return false
      }
      console.warn(`[credits] CAS race for user ${userId}, retry ${_attempt + 1}/${MAX_ATTEMPTS}`)
      return deductCredits(adminOrUserId, userIdOrAmount, amountOrAction, videoId, description, _attempt + 1)
    }

    // The ledger row is what every refund is checked against (video-billing.ts):
    // a charge with no ledger row can never be refunded. So if this write fails,
    // the deduction is put back and the charge is refused (audit 2026-10-09 —
    // it used to be unchecked: money taken, nothing on record).
    const { error: ledgerErr } = await admin.from('credit_transactions').insert({
      user_id: userId,
      amount: -amount,
      balance_after: newTotal,
      action,
      video_id: videoId || null,
      description: description || `${action}: -${amount} credits`,
    })
    if (ledgerErr) {
      console.error(`[credits] ledger write failed for user ${userId} (${action}, ${amount}) — putting the credits back:`, ledgerErr.message)
      const restored = await restoreDeduction(admin, userId, monthlyDeduct, topupDeduct, amount)
      const { alertOps } = await import('./ops-alert')
      await alertOps({
        source: 'credits', stage: 'ledger-write',
        message: restored
          ? `A charge of ${amount} credits (${action}) could not be written to the ledger, so it was put back and refused.`
          : `A charge of ${amount} credits (${action}) could not be written to the ledger AND could not be put back — the customer is short ${amount} credits. Add them back by hand.`,
        detail: ledgerErr.message, userId, videoId: videoId || null,
      })
      return false
    }

    console.log(`[credits] Deducted ${amount} from user ${userId}: ${total} -> ${newTotal}`)
    // Free-trial-then-auto-bill: once what's left can't pay for even the
    // cheapest action, end the Stripe trial so the saved card is charged and
    // the chosen plan begins. Done here so EVERY product triggers it, not just
    // video (audit H15). Best-effort — endTrialIfDepleted never throws.
    if (amount > 0 && newTotal < MIN_ACTION_COST && profile?.subscription_status === 'trial') {
      await endTrialIfDepleted(userId)
    }
    return true
  }

  // No wallet row even after ensureCreditBalance — treat as no credits.
  // We deliberately do NOT fall back to profiles.credits_remaining (dead store).
  console.error(`[credits] deductCredits: no credit_balances row for user ${userId} after ensure — denying`)
  return false
}

// ============================================================
// Grant & top-up functions
// ============================================================

// A monthly cycle is considered renewable once cycle_start is older than this.
// Guards grantMonthlyCredits against re-granting mid-cycle (webhook retries,
// duplicate events, the old checkCredits self-heal) which previously wiped
// spent credits and refilled the balance for free.
const CYCLE_RENEW_MS = 25 * 24 * 60 * 60 * 1000 // ~25 days

/**
 * Grant a fresh monthly allotment. PER-CYCLE IDEMPOTENT: only performs a full
 * reset (balance = tier credits, cycle_used = 0, new cycle_start) when this is
 * genuinely a NEW cycle — i.e. there is no row yet, or the existing cycle_start
 * is older than CYCLE_RENEW_MS. A duplicate/retried call within the same cycle
 * is a no-op, so it can never silently refill mid-cycle.
 *
 * `forceNewCycle` (review B11): a completed CHECKOUT is always a fresh paid
 * subscription — without this, a user who cancelled and re-subscribed within
 * ~25 days paid full price and received ZERO credits (the same-cycle guard
 * swallowed the grant). Callers set it only when real money just moved.
 *
 * Top-up balance is always preserved — via a compare-and-set on topup_balance
 * (review B13): the old blind upsert wrote back a STALE topup value, silently
 * destroying a credit-pack purchase that landed between the read and the write
 * (webhook grant racing a renewal grant is a realistic overlap).
 */
export async function grantMonthlyCredits(
  userId: string,
  subscriptionStatus: string,
  opts?: { forceNewCycle?: boolean },
  _attempt = 0,
): Promise<void> {
  const MAX_ATTEMPTS = 4
  const admin = createAdminClient()
  const tier = getUserTier(subscriptionStatus)
  const credits = TIER_CREDITS[tier]

  const { data: existing } = await admin
    .from('credit_balances')
    .select('topup_balance, cycle_start, cycle_credits_granted')
    .eq('user_id', userId)
    .single()

  const topup = existing?.topup_balance ?? 0

  if (existing && !opts?.forceNewCycle) {
    const startMs = existing.cycle_start ? new Date(existing.cycle_start).getTime() : 0
    const sameCycle = startMs > 0 && (Date.now() - startMs) < CYCLE_RENEW_MS
    const alreadyGranted = (existing.cycle_credits_granted ?? 0) >= credits
    // Same billing cycle AND already granted at least this tier's amount → no-op.
    if (sameCycle && alreadyGranted) {
      return
    }
  }

  if (existing) {
    // CAS on topup_balance: zero rows = a concurrent top-up landed → re-read
    // and retry so the fresh grant can't clobber purchased credits.
    const { data: updated, error: casErr } = await admin
      .from('credit_balances')
      .update({
        balance: credits,
        cycle_start: new Date().toISOString(),
        cycle_credits_granted: credits,
        cycle_credits_used: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('topup_balance', topup)
      .select('user_id')
    if (casErr) {
      console.error(`[credits] grantMonthlyCredits hard error for ${userId}:`, casErr.message)
      return
    }
    if (!updated || updated.length === 0) {
      if (_attempt + 1 >= MAX_ATTEMPTS) {
        console.error(`[credits] grantMonthlyCredits gave up after ${MAX_ATTEMPTS} contended attempts for ${userId}`)
        return
      }
      console.warn(`[credits] grantMonthlyCredits CAS race for ${userId}, retry ${_attempt + 1}/${MAX_ATTEMPTS}`)
      return grantMonthlyCredits(userId, subscriptionStatus, opts, _attempt + 1)
    }
  } else {
    await admin
      .from('credit_balances')
      .upsert({
        user_id: userId,
        balance: credits,
        topup_balance: topup,
        cycle_start: new Date().toISOString(),
        cycle_credits_granted: credits,
        cycle_credits_used: 0,
        updated_at: new Date().toISOString(),
      })
  }

  await admin.from('credit_transactions').insert({
    user_id: userId,
    amount: credits,
    balance_after: credits + topup,
    action: 'monthly_grant',
    description: `${tier} plan: +${credits.toLocaleString()} monthly credits`,
  })
}

/**
 * Apply a plan UPGRADE without a free full refill. Adds only the positive delta
 * between the new tier's allotment and the old one to the current monthly
 * balance (so a user who already spent this cycle keeps their spend). Downgrades
 * are a no-op on the current cycle (the lower allotment takes effect next cycle).
 */
export async function applyTierChange(userId: string, newSubscriptionStatus: string, _attempt = 0): Promise<void> {
  const MAX_ATTEMPTS = 4
  const admin = createAdminClient()
  const newTier = getUserTier(newSubscriptionStatus)
  const newCredits = TIER_CREDITS[newTier]

  const { data: existing } = await admin
    .from('credit_balances')
    .select('balance, topup_balance, cycle_credits_granted, cycle_credits_used, cycle_start')
    .eq('user_id', userId)
    .single()

  // No row yet → just create a fresh grant for the new tier.
  if (!existing) {
    await grantMonthlyCredits(userId, newSubscriptionStatus)
    return
  }

  const prevGranted = existing.cycle_credits_granted ?? 0
  const delta = newCredits - prevGranted
  if (delta <= 0) {
    // Downgrade or same tier: don't touch the current cycle's balance.
    return
  }

  const newBalance = (existing.balance ?? 0) + delta
  // CAS on the read balance (review B13): the old blind update could overwrite
  // a concurrent deduction — restoring credits the user had just spent. Zero
  // rows = the balance moved under us → re-read and retry.
  const { data: updated, error: casErr } = await admin
    .from('credit_balances')
    .update({
      balance: newBalance,
      cycle_credits_granted: newCredits,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('balance', existing.balance ?? 0)
    .select('user_id')
  if (casErr) {
    console.error(`[credits] applyTierChange hard error for ${userId}:`, casErr.message)
    return
  }
  if (!updated || updated.length === 0) {
    if (_attempt + 1 >= MAX_ATTEMPTS) {
      console.error(`[credits] applyTierChange gave up after ${MAX_ATTEMPTS} contended attempts for ${userId}`)
      return
    }
    console.warn(`[credits] applyTierChange CAS race for ${userId}, retry ${_attempt + 1}/${MAX_ATTEMPTS}`)
    return applyTierChange(userId, newSubscriptionStatus, _attempt + 1)
  }

  await admin.from('credit_transactions').insert({
    user_id: userId,
    amount: delta,
    balance_after: newBalance + (existing.topup_balance ?? 0),
    action: 'tier_upgrade',
    description: `Upgrade to ${newTier}: +${delta.toLocaleString()} credits (prorated delta)`,
  })
}

/**
 * Add top-up credits. ATOMIC via compare-and-set on topup_balance with bounded
 * retry (audit #6: the previous read-modify-write upsert lost concurrent
 * top-ups — Stripe webhook retries, admin grant + refund overlap — silently
 * destroying purchased credits). ensureCreditBalance guarantees a row exists.
 */
/**
 * Add top-up credits ATOMICALLY via the add_topup_atomic Postgres function:
 * the balance increment and the ledger row commit together, and an optional
 * idempotency key (e.g. a Stripe event id) makes duplicate deliveries a no-op
 * at the DB level (audit B5/H5 — replaces the non-atomic CAS + LIKE-scan).
 * `idempotencyKey` should be set for any money event that Stripe may re-deliver.
 */
export async function addTopupCredits(
  userId: string,
  amount: number,
  source: string,
  opts?: { idempotencyKey?: string; action?: string; videoId?: string },
): Promise<boolean> {
  if (!amount || amount <= 0) return false
  const admin = createAdminClient()

  // Make sure a wallet row exists so the RPC's UPDATE can match.
  const { data: prof } = await admin.from('profiles').select('subscription_status').eq('id', userId).single()
  await ensureCreditBalance(userId, prof?.subscription_status || 'free')

  const { data, error } = await admin.rpc('add_topup_atomic', {
    p_user_id: userId,
    p_amount: amount,
    p_action: opts?.action || 'topup_pack',
    p_description: `${source}: +${amount.toLocaleString()} credits`,
    p_video_id: opts?.videoId || null,
    p_idempotency_key: opts?.idempotencyKey || null,
  })
  if (error) {
    console.error(`[credits] addTopupCredits RPC error for user ${userId}:`, error.message)
    throw new Error(`addTopupCredits failed: ${error.message}`) // let Stripe webhook 500 + retry
  }
  if (data === false) {
    console.log(`[credits] addTopupCredits no-op (duplicate) for user ${userId} key=${opts?.idempotencyKey}`)
  }
  return data === true
}

/**
 * Idempotent video refund. Refunds `amount` to the user's top-up balance at
 * most ONCE per videoId, guarded by a marker in credit_transactions
 * (description contains "refund:video:{videoId}"). This prevents a double
 * refund when more than one failure handler fires for the same video — e.g.
 * the Inngest onFailure AND the Creatomate webhook in pipeline v2 (audit #12).
 */
export async function refundVideoCredits(userId: string, amount: number, videoId: string): Promise<void> {
  if (!amount || amount <= 0 || !videoId) return
  const admin = createAdminClient()

  // Per-CHARGE idempotency, not per-video-forever (review B4): videos are
  // retryable — each retry deducts again, so a once-per-video key silently
  // swallowed the SECOND legitimate refund and the user lost that charge.
  // Charge sequence = count of deduction ledger rows for this video. Two
  // concurrent failure handlers for the SAME charge compute the same seq →
  // same key → the atomic RPC applies exactly one refund. A later retry adds a
  // deduction row → seq+1 → a fresh key.
  let seq = 1
  try {
    const { count } = await admin
      .from('credit_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('video_id', videoId)
      .eq('action', 'video_generation')
    if (count && count > 1) seq = count
  } catch { /* default to charge #1 */ }

  const applied = await addTopupCredits(userId, amount, `refund:video:${videoId}`, {
    // The FIRST refund keeps action='refund_video' (guarded by the
    // UNIQUE(user_id, video_id) WHERE action='refund_video' index). Retry
    // refunds MUST use a different action or that index rejects the insert.
    action: seq === 1 ? 'refund_video' : 'refund_video_retry',
    videoId,
    idempotencyKey: seq === 1 ? `refund:video:${videoId}` : `refund:video:${videoId}:${seq}`,
  })
  if (!applied) {
    console.log(`[credits] Skipping duplicate refund for video ${videoId} charge #${seq} (already refunded)`)
  }
  // Zero the outstanding-charge marker either way (review B1): "status='failed'
  // AND deducted_cost>0" now always means charged-but-not-yet-refunded, which
  // is exactly what the fix-stuck-videos cron sweeps. A re-charge on retry
  // re-sets deducted_cost in generate-video.
  await admin.from('videos').update({ deducted_cost: 0 }).eq('id', videoId)
}

/**
 * Give back the credits for ONE charge of a one-off tool whose work failed
 * (audit H5: many tools charged first and kept the credits when the AI call or
 * upload failed). `chargeKey` must be unique per charge — the refund is
 * idempotent on it, so a double-fired failure path can't refund twice. Never
 * throws: a refund failure is logged loudly for manual follow-up.
 */
export async function refundCredits(
  userId: string,
  amount: number,
  action: string,
  chargeKey: string,
): Promise<boolean> {
  if (!amount || amount <= 0 || !chargeKey) return false
  try {
    return await addTopupCredits(userId, amount, `Refund — ${action} failed`, {
      action: 'refund_action',
      idempotencyKey: `refund:${action}:${chargeKey}`,
    })
  } catch (err) {
    console.error(`[credits] REFUND FAILED for user ${userId} (${action}, ${amount} credits, key ${chargeKey}) — needs manual credit:`, err instanceof Error ? err.message : err)
    return false
  }
}

/**
 * Take credits back after a Stripe refund or chargeback (audit H8). Takes from
 * the monthly balance first, then the top-up balance, and never below zero —
 * credits already spent can't be un-spent. Idempotent on `idempotencyKey`
 * (one key per Stripe refund / dispute), so a re-delivered webhook is a no-op
 * but each separate partial refund is still recorded.
 *
 * Uses the revoke_credits_atomic database function when it exists
 * (migration 20260926_revoke_credits_atomic.sql). Production does not run
 * migrations automatically, so if the function is missing we fall back to a
 * claim-then-compare-and-set path that is still idempotent on the key.
 * Throws on a hard failure so the Stripe webhook returns 500 and retries.
 */
export async function revokeCredits(
  userId: string,
  amount: number,
  idempotencyKey: string,
  description: string,
): Promise<boolean> {
  if (!amount || amount <= 0 || !idempotencyKey) return false
  const admin = createAdminClient()

  const { data, error } = await admin.rpc('revoke_credits_atomic', {
    p_user_id: userId,
    p_amount: Math.round(amount),
    p_description: description,
    p_idempotency_key: idempotencyKey,
  })
  if (!error) return data === true

  const missingFn = error.code === 'PGRST202' || error.code === '42883'
    || /could not find the function|does not exist/i.test(error.message || '')
  if (!missingFn) throw new Error(`revokeCredits failed: ${error.message}`)

  // Fallback (migration not applied yet). Claim the key first so a retry of
  // the same refund can never revoke twice.
  const { error: claimErr } = await admin
    .from('processed_stripe_events')
    .insert({ event_id: idempotencyKey, event_type: 'revoke' })
  if (claimErr) {
    if ((claimErr as { code?: string }).code === '23505') return false // already done
    throw new Error(`revokeCredits claim failed: ${claimErr.message}`)
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: row } = await admin
      .from('credit_balances')
      .select('balance, topup_balance')
      .eq('user_id', userId)
      .single()
    if (!row) return false
    const fromMonthly = Math.min(Math.round(amount), Math.max(0, row.balance))
    const fromTopup = Math.min(Math.round(amount) - fromMonthly, Math.max(0, row.topup_balance))
    const newMonthly = row.balance - fromMonthly
    const newTopup = row.topup_balance - fromTopup
    const { data: updated, error: updErr } = await admin
      .from('credit_balances')
      .update({ balance: newMonthly, topup_balance: newTopup, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('balance', row.balance)
      .eq('topup_balance', row.topup_balance)
      .select('user_id')
    if (updErr) {
      // Give the key back so Stripe's retry can try again.
      await admin.from('processed_stripe_events').delete().eq('event_id', idempotencyKey)
      throw new Error(`revokeCredits update failed: ${updErr.message}`)
    }
    if (updated && updated.length > 0) {
      await admin.from('credit_transactions').insert({
        user_id: userId,
        amount: -(fromMonthly + fromTopup),
        balance_after: newMonthly + newTopup,
        action: 'refund_revoke',
        description,
      })
      return true
    }
  }
  await admin.from('processed_stripe_events').delete().eq('event_id', idempotencyKey)
  throw new Error(`revokeCredits gave up after contended attempts for ${userId}`)
}

/**
 * Pure: how many credits a refund of `refundedCents` out of `paidCents`
 * should take back from a purchase that granted `credits`. Proportional, so a
 * partial refund never revokes a whole pack (audit L). Rounded up so a refund
 * of any size takes back at least a credit; capped at the full grant.
 */
export function proportionalCredits(credits: number, refundedCents: number, paidCents: number): number {
  if (!(credits > 0) || !(refundedCents > 0)) return 0
  if (!(paidCents > 0) || refundedCents >= paidCents) return credits
  return Math.min(credits, Math.ceil((credits * refundedCents) / paidCents))
}

export async function getUsageHistory(userId: string, limit: number = 50) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('credit_transactions')
    .select('amount, balance_after, action, description, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return data ?? []
}

// ============================================================
// Video cost calculator
// ============================================================

/** Surcharge per EXTRA uploaded file (beyond the first) on a multi-document
 *  project. Each extra file = one more extraction + the cross-doc combine pass,
 *  so multi-upload videos cost more to produce. Exposed so the UI can show the
 *  exact same number it charges (display = charge). */
export const MULTI_FILE_SURCHARGE = 150

export function calculateVideoCost(options: {
  outputType: 'video' | 'pptx' | 'pdf'
  detailLevel?: 'quick' | 'standard' | 'detailed'
  narrationStyle?: 'solo' | 'podcast'
  userId?: string | null
  /** Total uploaded documents on the project (1 = single file, no surcharge). */
  fileCount?: number
}): number {
  const { outputType, detailLevel = 'standard', narrationStyle = 'solo', userId, fileCount } = options
  // Grandfathered users (e.g. Aziz) pay the OLD pre-2x rates via costForUser.
  const cost = (action: CreditAction) => costForUser(action, userId)

  if (outputType === 'pptx') return cost('pptx')
  if (outputType === 'pdf') return cost('pdf')

  let total = 0
  switch (detailLevel) {
    case 'quick': total = cost('videoQuick'); break
    case 'detailed': total = cost('videoDetailed'); break
    default: total = cost('videoStandard'); break
  }

  if (narrationStyle === 'podcast') {
    total += cost('podcastAddon')
  }

  // Multi-upload surcharge: +150 per file beyond the first (extractions + combine).
  const extraFiles = Math.max(0, (fileCount ?? 1) - 1)
  total += extraFiles * MULTI_FILE_SURCHARGE

  return total
}

// Ensure a user has a credit balance row (call on signup or first login)
export async function ensureCreditBalance(userId: string, subscriptionStatus: string): Promise<void> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('credit_balances')
    .select('user_id')
    .eq('user_id', userId)
    .single()

  if (!data) {
    await grantMonthlyCredits(userId, subscriptionStatus)
  }
}

/**
 * Free-trial-then-auto-bill trigger. Call AFTER a successful credit deduction.
 * If the user's balance just hit zero AND they have a trialing Stripe
 * subscription (created at signup), end the trial NOW so Stripe charges the
 * saved card and the chosen plan begins. Fully guarded + best-effort: any
 * failure is logged and never blocks the user's action. Idempotent — only acts
 * while the subscription is still 'trialing'.
 */
/**
 * Pure decision: should we end the Stripe trial now? Extracted so the billing
 * logic is unit-testable without mocking Stripe/Supabase. End the trial ONLY
 * when ALL hold: the free credits have run out (what's left can't pay for the
 * cheapest action, OR can't pay for the action the user just tried), the user
 * is on the 'trial' status, they have a subscription id, and Stripe still
 * reports it 'trialing'.
 */
export function shouldEndTrial(input: {
  balanceTotal: number
  subscriptionStatus: string | null | undefined
  stripeSubscriptionId: string | null | undefined
  stripeSubStatus: string | null | undefined
  /** Cost of the action the user just tried and could not afford, if any. */
  attemptedCost?: number | null
}): boolean {
  const cannotAffordAnything = input.balanceTotal < MIN_ACTION_COST
  const cannotAffordAttempt = typeof input.attemptedCost === 'number'
    && input.attemptedCost > 0
    && input.balanceTotal < input.attemptedCost
  if (!cannotAffordAnything && !cannotAffordAttempt) return false
  if (input.subscriptionStatus !== 'trial') return false
  if (!input.stripeSubscriptionId) return false
  if (input.stripeSubStatus !== 'trialing') return false
  return true
}

export async function endTrialIfDepleted(userId: string, opts?: { attemptedCost?: number }): Promise<void> {
  try {
    const balance = await getBalance(userId)
    // Fast exit — they can still afford things (and did not just fail to).
    const attempted = opts?.attemptedCost ?? 0
    if (balance.total >= MIN_ACTION_COST && !(attempted > balance.total)) return

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_subscription_id, subscription_status')
      .eq('id', userId)
      .single()
    const subId = profile?.stripe_subscription_id
    if (!subId || profile?.subscription_status !== 'trial') return

    const { stripe } = await import('./stripe')
    const sub = await stripe.subscriptions.retrieve(subId)
    if (!shouldEndTrial({
      balanceTotal: balance.total,
      subscriptionStatus: profile?.subscription_status,
      stripeSubscriptionId: subId,
      stripeSubStatus: sub.status,
      attemptedCost: opts?.attemptedCost,
    })) return // already converted/canceled or otherwise ineligible — no-op

    // End the trial immediately → Stripe charges the saved card now. The
    // invoice.payment_succeeded / subscription.updated webhook then flips the
    // user to the paid tier and grants the plan's monthly credits.
    await stripe.subscriptions.update(subId, { trial_end: 'now' })
    console.log(`[credits] Trial ended on depletion for user ${userId} (sub ${subId}) — charging saved card`)
  } catch (err) {
    console.error(`[credits] endTrialIfDepleted failed for user ${userId}:`, err instanceof Error ? err.message : err)
  }
}
