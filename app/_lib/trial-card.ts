import type { SupabaseClient } from '@supabase/supabase-js'
import { alertOps } from './ops-alert'

// =============================================================================
// ONE CARD, ONE FREE TRIAL (audit 2026-10-09).
//
// Saving a card starts a free trial with free credits. The same card could be
// saved on account after account, each getting its own free trial. Stripe gives
// every card a `fingerprint` that is the same for the same card number on any
// customer, so the first account to start a trial with a card "claims" that
// fingerprint, and another account presenting the same card is refused.
//
// Table: trial_card_fingerprints (supabase/migrations/20261009_trial_card_fingerprints.sql)
// — fingerprint is the PRIMARY KEY, so two accounts racing with the same card
// can't both win. Service-role only (RLS on, no policies).
// =============================================================================

export type TrialCardClaim = 'ok' | 'used_elsewhere' | 'error'

export const CARD_ALREADY_USED_MESSAGE =
  'This card has already been used for a free trial on another account. Please use a different card — or pick a paid plan to start right away.'

export const CARD_CHECK_FAILED_MESSAGE =
  'We could not finish checking your card just now. Please try again in a minute.'

/**
 * Claim `fingerprint` for `userId`'s trial.
 *  'ok'             — first use, or this same account again (a retry)
 *  'used_elsewhere' — another account already started a trial with this card
 *  'error'          — couldn't check (caller refuses: never a free pass)
 */
export async function claimTrialCard(admin: SupabaseClient, fingerprint: string | null | undefined, userId: string): Promise<TrialCardClaim> {
  if (!fingerprint) return 'error'
  const { error } = await admin.from('trial_card_fingerprints').insert({ fingerprint, user_id: userId })
  if (!error) return 'ok'
  // The table not existing yet (migration not run in prod) must not stop
  // every new trial: let the trial through and email the owner to run it.
  const code = (error as { code?: string }).code
  if (code === 'PGRST205' || code === '42P01') {
    await alertOps({ source: 'confirm-card', message: 'Run supabase/migrations/20261009_trial_card_fingerprints.sql in production — one-card-one-trial check is off until then.', userId }).catch(() => false)
    return 'ok'
  }
  if (code !== '23505') {
    console.error('[trial-card] claim failed:', error.message)
    return 'error'
  }
  // Already claimed — by whom?
  const { data, error: readErr } = await admin
    .from('trial_card_fingerprints')
    .select('user_id')
    .eq('fingerprint', fingerprint)
    .maybeSingle()
  if (readErr || !data) return 'error'
  return (data as { user_id: string }).user_id === userId ? 'ok' : 'used_elsewhere'
}
