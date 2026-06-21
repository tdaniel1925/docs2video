import { NextResponse } from 'next/server'
import { verifyCronAuth } from '../../../_lib/cron-auth'
import { getStripe } from '../../../_lib/stripe'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { addTopupCredits } from '../../../_lib/credits'
import { logError } from '../../../_lib/error-logger'
import type Stripe from 'stripe'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * GET /api/cron/reconcile-credit-packs (hourly)
 * Safety net for credit-pack purchases: if the Stripe webhook claimed an event
 * but the process was hard-killed (timeout/OOM) before the grant committed, the
 * customer paid but got 0 credits and Stripe's retry was dropped as a duplicate.
 * This scans recent PAID credit-pack checkout sessions and grants any whose
 * credits were never applied — idempotent via a distinct `pack:{sessionId}` key,
 * so a session already granted (or granted by a concurrent run) is a no-op.
 */
export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stripe = getStripe()
  const admin = createAdminClient()
  const sinceSec = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000) // last 24h

  let granted = 0
  let checked = 0
  const errors: string[] = []

  try {
    // Recent checkout sessions (platform account). Filter to paid credit packs.
    const sessions = await stripe.checkout.sessions.list({ created: { gte: sinceSec }, limit: 100 })

    for (const s of sessions.data as Stripe.Checkout.Session[]) {
      if (s.metadata?.type !== 'credit_pack') continue
      if (s.payment_status !== 'paid') continue
      const userId = s.metadata.supabase_user_id
      const credits = parseInt(s.metadata.credits || '0', 10)
      if (!userId || !Number.isFinite(credits) || credits <= 0 || credits > 100000) continue
      checked++

      const packName = s.metadata.pack_name || s.metadata.pack || 'credit_pack'
      try {
        // Distinct key per SESSION (not the event id), so this is independent of
        // the webhook's event claim. add_topup_atomic no-ops if already applied.
        const applied = await addTopupCredits(userId, credits, packName, {
          idempotencyKey: `pack:${s.id}`,
        })
        if (applied) {
          granted++
          console.log(`[reconcile-credit-packs] healed pack ${s.id}: +${credits} for ${userId}`)
        }
      } catch (e) {
        const m = e instanceof Error ? e.message : 'grant failed'
        errors.push(`${s.id}: ${m}`)
      }
    }

    return NextResponse.json({ ok: true, checked, granted, errors })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'reconcile failed'
    logError('reconcile-credit-packs', err, {})
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
