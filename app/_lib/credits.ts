import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Credit costs per action type.
 */
export const CREDIT_COSTS = {
  video: 3,
  infographic: 1,
  logo: 2,
  'logo-refine': 1,
  'business-card': 1,
  flyer: 1,
  template: 2,
  'template-refine': 1,
} as const

export type CreditAction = keyof typeof CREDIT_COSTS

/**
 * Get the credit cost for a given action.
 */
export function getCreditCost(action: CreditAction): number {
  return CREDIT_COSTS[action]
}

/**
 * Deduct credits from a user's account.
 * Returns true on success, false if insufficient credits.
 */
export async function deductCredits(
  admin: SupabaseClient,
  userId: string,
  amount: number
): Promise<boolean> {
  const { data: profile } = await admin
    .from('profiles')
    .select('credits_remaining')
    .eq('id', userId)
    .single()

  if (!profile) return false

  const credits = profile.credits_remaining ?? 0

  if (credits < amount) {
    console.log(`[credits] Insufficient credits for user ${userId}: need ${amount}, have ${credits}`)
    return false
  }

  const newCredits = credits - amount

  await admin
    .from('profiles')
    .update({ credits_remaining: newCredits })
    .eq('id', userId)

  console.log(`[credits] Deducted ${amount} credits from user ${userId}: ${credits} -> ${newCredits}`)
  return true
}
