// =============================================================================
// THE DAILY CAP ON FREE READING/WRITING FOR ACCOUNTS WITH NO CARD.
//
// Since the "light start" a new account can use steps 1–3 before adding a
// card. Those steps never charge, but reading a document and writing a story
// use AI. This puts a daily ceiling on that for cardless accounts only — every
// account with a card (or a paid plan, or admin/beta) is untouched.
//
// It never lets anyone SPEND: making a real video still goes through
// checkCredits/deductCredits, which refuse a cardless account outright
// (spendBlockReason → 'card_required').
// =============================================================================

import { NextResponse } from 'next/server'
import { createAdminClient } from './supabase/admin'
import { spendBlockReason } from './credits'
import { checkRateLimit } from './rate-limit'
import {
  CARDLESS_PREP_CAP_MESSAGE, CARDLESS_PREP_PER_DAY, CARDLESS_PREP_WINDOW_SECS, cardlessPrepKey,
} from './light-start'

/** True when this account is a free/trial account with no card on file. */
export async function isCardless(userId: string): Promise<boolean> {
  const { data: profile } = await createAdminClient()
    .from('profiles')
    .select('is_admin, is_beta, subscription_status, card_on_file')
    .eq('id', userId)
    .maybeSingle()
  return spendBlockReason(profile) === 'card_required'
}

/**
 * Count one free reading/writing action for a cardless account.
 * Returns a ready-made "too many today" answer, or null to carry on.
 * Accounts with a card are never counted.
 */
export async function cardlessPrepGate(userId: string, alreadyKnownCardless?: boolean): Promise<NextResponse | null> {
  const cardless = alreadyKnownCardless ?? await isCardless(userId)
  if (!cardless) return null
  const { allowed } = await checkRateLimit(cardlessPrepKey(userId, new Date()), CARDLESS_PREP_PER_DAY, CARDLESS_PREP_WINDOW_SECS)
  if (allowed) return null
  return NextResponse.json({ error: CARDLESS_PREP_CAP_MESSAGE, code: 'cardless_prep_cap' }, { status: 429 })
}
