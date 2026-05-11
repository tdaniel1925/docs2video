import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Deduct credits from a user's account.
 * Deducts from monthly credits (credits_remaining) first,
 * then falls back to pack_credits if monthly are exhausted.
 * Returns true on success, false if insufficient credits.
 */
export async function deductCredits(
  admin: SupabaseClient,
  userId: string,
  amount: number
): Promise<boolean> {
  const { data: profile } = await admin
    .from('profiles')
    .select('credits_remaining, pack_credits')
    .eq('id', userId)
    .single()

  if (!profile) return false

  const monthly = profile.credits_remaining ?? 0
  const packs = profile.pack_credits ?? 0
  const totalAvailable = monthly + packs

  if (totalAvailable < amount) {
    console.log(`[credits] Insufficient credits for user ${userId}: need ${amount}, have ${monthly} monthly + ${packs} pack = ${totalAvailable}`)
    return false
  }

  let newMonthly = monthly
  let newPacks = packs
  let remaining = amount

  // Deduct from monthly first
  if (newMonthly >= remaining) {
    newMonthly -= remaining
    remaining = 0
  } else {
    remaining -= newMonthly
    newMonthly = 0
  }

  // Deduct remainder from pack credits
  if (remaining > 0) {
    newPacks -= remaining
    remaining = 0
  }

  await admin
    .from('profiles')
    .update({ credits_remaining: newMonthly, pack_credits: newPacks })
    .eq('id', userId)

  console.log(`[credits] Deducted ${amount} credits from user ${userId}: monthly ${monthly}->${newMonthly}, packs ${packs}->${newPacks}`)
  return true
}
