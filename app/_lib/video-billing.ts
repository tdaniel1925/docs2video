import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from './supabase/admin'
import { addTopupCredits, refundVideoCredits } from './credits'

// =============================================================================
// WHAT A VIDEO REALLY COST, READ FROM THE LEDGER.
//
// THE BUG THIS FIXES (audit C1). The stuck-video cron refunded whatever number
// sat in `videos.deducted_cost`. That column lives on a row the signed-in user
// can write to directly, so anyone could make a row with status 'failed' and
// deducted_cost 1,000,000 and the cron would "refund" it as real credits —
// again for every new row.
//
// The ledger (`credit_transactions`) is different: only the server writes it
// (users can read their own rows, nothing more). So a refund is now capped by
// what the ledger says was charged for that video and not yet given back.
// `deducted_cost` is only ever a HINT that a refund may be owed — never the
// amount.
// =============================================================================

/** Every status that means "this job is still running" — defined in the pure
 *  video-running module (so browser pages can import it) and re-exported here. */
export { IN_PROGRESS_STATUSES } from './video-running'

/** Ledger actions that TAKE credits for a video render. */
export const VIDEO_CHARGE_ACTIONS = ['video_generation', 'recharge_video'] as const
/** Ledger actions that GIVE BACK a video render charge. */
export const VIDEO_REFUND_ACTIONS = ['refund_video', 'refund_video_retry'] as const
/** Ledger actions that TAKE credits for building a presentation / slide deck. */
export const PRESENTATION_CHARGE_ACTIONS = ['presentation_interactive', 'presentation_deck'] as const
/** The one action used to give a presentation charge back. It has no unique
 *  index (unlike 'refund_video'), so a second failed attempt is refunded too. */
export const PRESENTATION_REFUND_ACTION = 'refund_presentation'
/** Ledger actions for the MP4 export of a presentation (its own job). */
export const EXPORT_CHARGE_ACTION = 'presentation_video_export'
export const EXPORT_REFUND_ACTION = 'refund_presentation_export'

export interface LedgerRow { action: string; amount: number | null; created_at?: string | null }

/**
 * Credits charged by `chargeActions` minus credits given back by
 * `refundActions`. Never below zero. Charges are stored as negative amounts,
 * refunds as positive ones; anything with the wrong sign is ignored rather
 * than trusted.
 */
export function ledgerOutstanding(
  rows: LedgerRow[] | null | undefined,
  chargeActions: readonly string[],
  refundActions: readonly string[],
): number {
  let charged = 0
  let refunded = 0
  for (const r of rows || []) {
    const amt = Number(r.amount) || 0
    if (chargeActions.includes(r.action) && amt < 0) charged += -amt
    else if (refundActions.includes(r.action) && amt > 0) refunded += amt
  }
  return Math.max(0, charged - refunded)
}

/** How much to refund: never more than the ledger says is owed, never more
 *  than the row claims, never negative. */
export function refundableAmount(claimed: number | null | undefined, outstanding: number): number {
  const c = Math.max(0, Number(claimed) || 0)
  return Math.max(0, Math.min(c, Math.max(0, outstanding)))
}

/** How many times this video was charged by one of `actions` — used as the
 *  attempt number in refund keys, so two handlers refunding the SAME attempt
 *  share one key (only one wins) while a later attempt gets a fresh key. */
export function chargeCount(rows: LedgerRow[] | null | undefined, actions: readonly string[]): number {
  return (rows || []).filter((r) => actions.includes(r.action) && (Number(r.amount) || 0) < 0).length
}

/** Read this video's ledger rows for this user (the owner is the only wallet
 *  that can ever be refunded). */
export async function readVideoLedger(admin: SupabaseClient, videoId: string, userId: string): Promise<LedgerRow[]> {
  const { data, error } = await admin
    .from('credit_transactions')
    .select('action, amount, created_at')
    .eq('video_id', videoId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`ledger read failed: ${error.message}`)
  return (data || []) as LedgerRow[]
}

/**
 * Give back one presentation build charge. Keyed per attempt, so:
 *  - two failure handlers for the SAME attempt → one refund (same key);
 *  - a second attempt that also fails → refunded too (new key).
 * The old path reused the video refund, whose once-per-video marker silently
 * dropped the second refund — and collided with the MP4 export's refund.
 */
export async function refundPresentationCharge(userId: string, videoId: string, amount: number): Promise<boolean> {
  if (!amount || amount <= 0) return false
  const admin = createAdminClient()
  const rows = await readVideoLedger(admin, videoId, userId)
  const owed = ledgerOutstanding(rows, PRESENTATION_CHARGE_ACTIONS, [PRESENTATION_REFUND_ACTION])
  const amt = refundableAmount(amount, owed)
  if (amt <= 0) {
    await admin.from('videos').update({ deducted_cost: 0 }).eq('id', videoId)
    return false
  }
  const attempt = Math.max(1, chargeCount(rows, PRESENTATION_CHARGE_ACTIONS))
  const applied = await addTopupCredits(userId, amt, `refund:presentation:${videoId}`, {
    action: PRESENTATION_REFUND_ACTION,
    videoId,
    idempotencyKey: `refund:presentation:${videoId}:${attempt}`,
  })
  await admin.from('videos').update({ deducted_cost: 0 }).eq('id', videoId)
  return applied
}

/**
 * Give back one MP4-export charge, keyed per export attempt (same reasoning as
 * above). Kept apart from the build refund so the two never share a key.
 */
export async function refundExportCharge(userId: string, videoId: string, amount: number): Promise<boolean> {
  if (!amount || amount <= 0) return false
  const admin = createAdminClient()
  const rows = await readVideoLedger(admin, videoId, userId)
  const owed = ledgerOutstanding(rows, [EXPORT_CHARGE_ACTION], [EXPORT_REFUND_ACTION])
  const amt = refundableAmount(amount, owed)
  if (amt <= 0) return false
  const attempt = Math.max(1, chargeCount(rows, [EXPORT_CHARGE_ACTION]))
  return addTopupCredits(userId, amt, `refund:export:${videoId}`, {
    action: EXPORT_REFUND_ACTION,
    videoId,
    idempotencyKey: `refund:export:${videoId}:${attempt}`,
  })
}

/**
 * Refund a failed video/presentation row — but only what the ledger proves was
 * charged and is still owed, capped by the row's own `deducted_cost`. A row the
 * user edited by hand (no real charge behind it) refunds nothing; its bogus
 * `deducted_cost` is simply cleared. Returns the credits actually refunded.
 */
export async function refundVerifiedCharge(
  admin: SupabaseClient,
  video: { id: string; user_id: string; deducted_cost: number | null },
): Promise<number> {
  let remaining = Math.max(0, Number(video.deducted_cost) || 0)
  if (remaining <= 0) return 0
  const rows = await readVideoLedger(admin, video.id, video.user_id)
  let refunded = 0

  const videoOwed = ledgerOutstanding(rows, VIDEO_CHARGE_ACTIONS, VIDEO_REFUND_ACTIONS)
  const vAmt = refundableAmount(remaining, videoOwed)
  if (vAmt > 0) {
    // Same helper (and so the same per-charge key) generate-video's own failure
    // path uses, so the cron and the route can never both refund one charge.
    await refundVideoCredits(video.user_id, vAmt, video.id)
    refunded += vAmt
    remaining -= vAmt
  }

  if (remaining > 0) {
    const presOwed = ledgerOutstanding(rows, PRESENTATION_CHARGE_ACTIONS, [PRESENTATION_REFUND_ACTION])
    const pAmt = refundableAmount(remaining, presOwed)
    if (pAmt > 0 && await refundPresentationCharge(video.user_id, video.id, pAmt)) refunded += pAmt
  }

  // Nothing (more) owed → clear the hint so the sweep stops looking at this row.
  await admin.from('videos').update({ deducted_cost: 0 }).eq('id', video.id)
  return refunded
}
