import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { requireAdmin } from '../../../_lib/admin'
import { getStripe } from '../../../_lib/stripe'
import { logAdminAction } from '../../../_lib/audit'
import { loadMoneySnapshot } from '../../../_lib/admin/money-server'
import type Stripe from 'stripe'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * GET /api/admin/billing[?fresh=1]
 * Admin Billing & Sales: every live subscription on the Stripe account, from
 * the ONE shared money calculation (same numbers as the Dashboard and
 * Revenue). Docs2Video subscriptions first; other products on the shared
 * Stripe account are marked `kind: 'other'` and never counted in MRR. Read-only.
 */
export async function GET(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const fresh = new URL(request.url).searchParams.get('fresh') === '1'
    const snap = await loadMoneySnapshot({ fresh })
    const d = snap.summary.docs2video
    return NextResponse.json({
      summary: snap.summary,
      conversion: snap.conversion,
      // Kept for older readers of this route.
      mrr: d.mrrCents,
      activeCount: d.paying,
      pastDueCount: d.pastDue,
      pausedCount: d.paused,
      subscriptions: snap.rows.map((r) => ({
        subscriptionId: r.id,
        customerId: r.customerId,
        userId: r.userId,
        email: r.email,
        name: r.name,
        tier: r.planName,
        kind: r.kind,
        status: r.status,
        pauseCollection: r.paused,
        cancelAtPeriodEnd: r.cancelAtPeriodEnd,
        monthlyAmount: r.monthlyCents,
        currentPeriodEnd: r.currentPeriodEnd,
      })).sort((a, b) => Number(a.kind === 'other') - Number(b.kind === 'other')),
      at: snap.at,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load billing'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/admin/billing  { subscriptionId, action }
 * action: 'cancel' (at period end) | 'cancel_now' | 'pause' | 'resume'
 * Every action is written to the admin audit log.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { subscriptionId, action } = (await request.json().catch(() => ({}))) as {
    subscriptionId?: string; action?: string
  }
  if (!subscriptionId || !action) {
    return NextResponse.json({ error: 'subscriptionId and action required' }, { status: 400 })
  }

  try {
    const stripe = getStripe()
    let result: Stripe.Subscription
    switch (action) {
      case 'cancel': // cancel at period end (customer keeps access until then)
        result = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })
        break
      case 'cancel_now': // immediate cancel
        result = await stripe.subscriptions.cancel(subscriptionId)
        break
      case 'pause': // pause collection — keeps the sub but stops billing
        result = await stripe.subscriptions.update(subscriptionId, { pause_collection: { behavior: 'void' } })
        break
      case 'resume':
        result = await stripe.subscriptions.update(subscriptionId, {
          pause_collection: '' as any, // clear pause
          cancel_at_period_end: false,
        })
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
    const customerId = typeof result.customer === 'string' ? result.customer : result.customer?.id
    const { data: owner } = customerId
      ? await createAdminClient().from('profiles').select('id').eq('stripe_customer_id', customerId).maybeSingle()
      : { data: null }
    await logAdminAction(admin.id, `billing_${action}`, owner?.id ?? undefined, { subscriptionId, customerId, status: result.status })
    console.log(`[admin/billing] ${admin.email} ${action} ${subscriptionId} -> ${result.status}`)
    return NextResponse.json({ success: true, status: result.status })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Action failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
