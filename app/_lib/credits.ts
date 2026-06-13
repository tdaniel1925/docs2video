import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from './supabase/admin'
import { getUserTier, type PlanTier } from './pricing'

// ============================================================
// Credit costs per action (inflated numbers — big feels generous)
// ============================================================
export const CREDIT_COSTS = {
  // Legacy actions (keep for backward compat)
  video: 500,
  infographic: 150,
  logo: 200,
  'logo-refine': 50,
  'business-card': 100,
  flyer: 100,
  template: 200,
  'template-refine': 50,
  // Deck builder (flagship product #2)
  deck: 300,
  // New granular video actions
  videoQuick: 250,
  videoStandard: 500,
  videoDetailed: 750,
  podcastAddon: 200,
  pptx: 400,
  pdf: 300,
  stylePreview: 50,
  scriptRegen: 25,
  aiChatEdit: 25,
  videoIllustrated: 750,  // 3 frames per scene = 3x image generation
} as const

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
  let balance = await getBalance(userId)

  // If user's cycle grant is less than their tier expects, they missed their initial grant — fix it now
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

  if (profile) {
    const tier = getUserTier(profile.subscription_status || 'free')
    const expectedCredits = TIER_CREDITS[tier]
    if (balance.cycleGranted < expectedCredits) {
      console.log(`[credits] Auto-granting credits for user ${userId}: has ${balance.cycleGranted} granted, tier ${tier} expects ${expectedCredits}`)
      await grantMonthlyCredits(userId, profile.subscription_status || 'free')
      balance = await getBalance(userId)
    }
  }

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
): Promise<boolean> {
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
  const { data: balanceRow } = await admin
    .from('credit_balances')
    .select('balance, topup_balance, cycle_credits_used')
    .eq('user_id', userId)
    .single()

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

    if (updateErr || !updated || updated.length === 0) {
      // Race condition detected — balance changed between read and write
      console.warn(`[credits] Race condition detected for user ${userId}, retrying...`)
      // Retry once with fresh balance
      return deductCredits(adminOrUserId, userIdOrAmount, amountOrAction, videoId, description)
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

  // Fallback: use legacy profiles.credits_remaining
  const { data: legacyProfile } = await admin
    .from('profiles')
    .select('credits_remaining')
    .eq('id', userId)
    .single()

  const credits = legacyProfile?.credits_remaining ?? 0
  if (credits < amount) {
    console.log(`[credits] Insufficient (legacy): need ${amount}, have ${credits} (user ${userId})`)
    return false
  }

  await admin
    .from('profiles')
    .update({ credits_remaining: credits - amount })
    .eq('id', userId)

  console.log(`[credits] Deducted ${amount} (legacy) from user ${userId}: ${credits} -> ${credits - amount}`)
  return true
}

// ============================================================
// Grant & top-up functions
// ============================================================

export async function grantMonthlyCredits(userId: string, subscriptionStatus: string): Promise<void> {
  const admin = createAdminClient()
  const tier = getUserTier(subscriptionStatus)
  const credits = TIER_CREDITS[tier]

  const { data: existing } = await admin
    .from('credit_balances')
    .select('topup_balance')
    .eq('user_id', userId)
    .single()

  const topup = existing?.topup_balance ?? 0

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

export async function addTopupCredits(userId: string, amount: number, source: string): Promise<void> {
  const admin = createAdminClient()
  const balance = await getBalance(userId)

  const newTopup = balance.topup + amount
  const newTotal = balance.monthly + newTopup

  await admin
    .from('credit_balances')
    .upsert({
      user_id: userId,
      balance: balance.monthly,
      topup_balance: newTopup,
      cycle_credits_granted: balance.cycleGranted,
      cycle_credits_used: balance.cycleUsed,
      updated_at: new Date().toISOString(),
    })

  await admin.from('credit_transactions').insert({
    user_id: userId,
    amount,
    balance_after: newTotal,
    action: 'topup_pack',
    description: `${source}: +${amount.toLocaleString()} credits`,
  })
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
