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
  // Deck builder (flagship product #2)
  deck: 600,
  // New granular video actions
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
  // azi / phil@valorfs.com — first paying customer (pre-2x pricing)
  // TODO: replace with the real profiles.id (see note returned to operator).
])

/** Cost for an action, honoring grandfathered users (old rates). */
export function costForUser(action: CreditAction, userId?: string | null): number {
  if (userId && GRANDFATHERED_USER_IDS.has(userId)) {
    return OLD_CREDIT_COSTS[action] ?? CREDIT_COSTS[action]
  }
  return CREDIT_COSTS[action]
}

export type CreditAction = keyof typeof CREDIT_COSTS

// Monthly credit grants per tier
export const TIER_CREDITS: Record<PlanTier, number> = {
  free: 1000,
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
export const TIER_APPROX_VIDEOS: Record<PlanTier, { standard: number; quick: number }> = {
  free: { standard: 2, quick: 4 },
  starter: { standard: 10, quick: 20 },
  pro: { standard: 50, quick: 100 },
  business: { standard: 150, quick: 300 },
  enterprise: { standard: 400, quick: 800 },
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
    .select('subscription_status, is_admin, is_beta')
    .eq('id', userId)
    .single()

  // Admin/beta bypass — unlimited credits
  if (profile?.is_admin || profile?.is_beta) {
    return { allowed: true, remaining: 999999, shortfall: 0 }
  }

  // Block past_due users — payment failed, must resolve before generating
  if (profile?.subscription_status === 'past_due') {
    return { allowed: false, remaining: 0, shortfall: needed }
  }

  // getBalance() self-heals via ensureCreditBalance: a first-time user gets
  // exactly one credit_balances row at their tier grant. This is now the ONLY
  // place a first grant happens — checkCredits no longer mutates the wallet
  // (no mid-cycle re-grant), so it's a pure "can they afford this" check.
  const balance = await getBalance(userId)

  const allowed = balance.total >= needed
  return {
    allowed,
    remaining: balance.total,
    shortfall: allowed ? 0 : needed - balance.total,
  }
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
    .select('is_admin, is_beta')
    .eq('id', userId)
    .single()

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

    await admin.from('credit_transactions').insert({
      user_id: userId,
      amount: -amount,
      balance_after: newTotal,
      action,
      video_id: videoId || null,
      description: description || `${action}: -${amount} credits`,
    })

    console.log(`[credits] Deducted ${amount} from user ${userId}: ${total} -> ${newTotal}`)
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
 * Top-up balance is always preserved.
 */
export async function grantMonthlyCredits(userId: string, subscriptionStatus: string): Promise<void> {
  const admin = createAdminClient()
  const tier = getUserTier(subscriptionStatus)
  const credits = TIER_CREDITS[tier]

  const { data: existing } = await admin
    .from('credit_balances')
    .select('topup_balance, cycle_start, cycle_credits_granted')
    .eq('user_id', userId)
    .single()

  const topup = existing?.topup_balance ?? 0

  if (existing) {
    const startMs = existing.cycle_start ? new Date(existing.cycle_start).getTime() : 0
    const sameCycle = startMs > 0 && (Date.now() - startMs) < CYCLE_RENEW_MS
    const alreadyGranted = (existing.cycle_credits_granted ?? 0) >= credits
    // Same billing cycle AND already granted at least this tier's amount → no-op.
    if (sameCycle && alreadyGranted) {
      return
    }
  }

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
export async function applyTierChange(userId: string, newSubscriptionStatus: string): Promise<void> {
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
  await admin
    .from('credit_balances')
    .update({
      balance: newBalance,
      cycle_credits_granted: newCredits,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

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
  // ATOMIC + idempotent (audit H4): the refund row uses action='refund_video',
  // which has a UNIQUE(user_id, video_id) index, and the idempotency key gates
  // duplicate inserts. Two concurrent failure handlers for the same video → one
  // refund. (Was a check-then-act SELECT→addTopup race that double-refunded.)
  const applied = await addTopupCredits(userId, amount, `refund:video:${videoId}`, {
    action: 'refund_video',
    videoId,
    idempotencyKey: `refund:video:${videoId}`,
  })
  if (!applied) {
    console.log(`[credits] Skipping duplicate refund for video ${videoId} (already refunded)`)
  }
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

export function calculateVideoCost(options: {
  outputType: 'video' | 'pptx' | 'pdf'
  detailLevel?: 'quick' | 'standard' | 'detailed'
  narrationStyle?: 'solo' | 'podcast'
}): number {
  const { outputType, detailLevel = 'standard', narrationStyle = 'solo' } = options

  if (outputType === 'pptx') return CREDIT_COSTS.pptx
  if (outputType === 'pdf') return CREDIT_COSTS.pdf

  let cost = 0
  switch (detailLevel) {
    case 'quick': cost = CREDIT_COSTS.videoQuick; break
    case 'detailed': cost = CREDIT_COSTS.videoDetailed; break
    default: cost = CREDIT_COSTS.videoStandard; break
  }

  if (narrationStyle === 'podcast') {
    cost += CREDIT_COSTS.podcastAddon
  }

  return cost
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
