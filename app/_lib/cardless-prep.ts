// =============================================================================
// THE DAILY CAPS ON FREE AI STEPS.
//
// Two counters, both per UTC day, both in the shared rate_limits table:
//   1. Accounts with NO CARD: 30 free reading/writing steps a day (since the
//      "light start" a new account can use steps 1–3 before adding a card).
//   2. EVERY account (audit 2026-10-09): a generous ceiling of 300 free AI
//      steps a day, so no single account can run the free helpers all day at
//      our cost. Admin and beta accounts are not counted.
//
// FAIL CLOSED (audit 2026-10-09, like the free preview): if the profile or a
// counter can't be read, the step is refused with a plain "resting" message
// and Trent is told — an outage must never mean "unlimited free AI".
//
// It never lets anyone SPEND: making a real video still goes through
// checkCredits/deductCredits, which refuse a cardless account outright
// (spendBlockReason → 'card_required').
// =============================================================================

import { NextResponse } from 'next/server'
import { createAdminClient } from './supabase/admin'
import { spendBlockReason } from './credits'
import { hitRateLimitStrict } from './rate-limit'
import {
  CARDLESS_PREP_CAP_MESSAGE, CARDLESS_PREP_PER_DAY, CARDLESS_PREP_WINDOW_SECS, cardlessPrepKey,
  AI_STEPS_PER_DAY, aiDailyKey, AI_DAILY_CAP_MESSAGE, AI_CAP_UNAVAILABLE_MESSAGE,
} from './light-start'

type AccountKind = 'exempt' | 'cardless' | 'normal' | 'unknown'

async function accountKind(userId: string): Promise<AccountKind> {
  try {
    const { data: profile, error } = await createAdminClient()
      .from('profiles')
      .select('is_admin, is_beta, subscription_status, card_on_file')
      .eq('id', userId)
      .maybeSingle()
    if (error || !profile) return 'unknown'
    if (profile.is_admin === true || profile.is_beta === true) return 'exempt'
    return spendBlockReason(profile) === 'card_required' ? 'cardless' : 'normal'
  } catch {
    return 'unknown'
  }
}

/**
 * True when this account is a free/trial account with no card on file.
 * An account we can't read counts as cardless (the stricter answer).
 */
export async function isCardless(userId: string): Promise<boolean> {
  const kind = await accountKind(userId)
  return kind === 'cardless' || kind === 'unknown'
}

function resting(userId: string, why: string): NextResponse {
  // Lazy import: keeps this module light for the many routes that use it.
  void import('./ops-alert').then(({ alertOps }) =>
    alertOps({ source: 'ai-daily-cap', stage: 'counter', message: `The free-AI daily cap could not be checked, so free AI steps are being refused: ${why}`, userId }),
  ).catch(() => {})
  return NextResponse.json({ error: AI_CAP_UNAVAILABLE_MESSAGE, code: 'ai_cap_unavailable' }, { status: 503 })
}

/**
 * Count one free AI step. Returns a ready-made answer to send back (too many
 * today / can't check right now), or null to carry on.
 * `alreadyKnownCardless`: the caller already knows (from checkCredits).
 */
export async function cardlessPrepGate(userId: string, alreadyKnownCardless?: boolean): Promise<NextResponse | null> {
  const kind: AccountKind = alreadyKnownCardless ? 'cardless' : await accountKind(userId)
  if (kind === 'exempt') return null
  if (kind === 'unknown') return resting(userId, 'profile unreadable')

  const now = new Date()
  if (kind === 'cardless') {
    const r = await hitRateLimitStrict(cardlessPrepKey(userId, now), CARDLESS_PREP_PER_DAY, CARDLESS_PREP_WINDOW_SECS)
    if (r === 'error') return resting(userId, 'cardless counter failed')
    if (r === 'over') return NextResponse.json({ error: CARDLESS_PREP_CAP_MESSAGE, code: 'cardless_prep_cap' }, { status: 429 })
  }

  const all = await hitRateLimitStrict(aiDailyKey(userId, now), AI_STEPS_PER_DAY, CARDLESS_PREP_WINDOW_SECS)
  if (all === 'error') return resting(userId, 'daily counter failed')
  if (all === 'over') return NextResponse.json({ error: AI_DAILY_CAP_MESSAGE, code: 'ai_daily_cap' }, { status: 429 })
  return null
}

/** The same gate under the name the newer routes use: every free AI step. */
export const aiDailyGate = cardlessPrepGate
