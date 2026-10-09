import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { requireAdmin } from '../../../_lib/admin'
import { getStripe, listAllStripe } from '../../../_lib/stripe'
import { loadMoneySnapshot } from '../../../_lib/admin/money-server'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * GET /api/admin/revenue — Revenue page. MRR, plan mix and conversion come
 * from the ONE shared money calculation (same as Dashboard and Billing).
 * Charges are split: Docs2Video customers (anyone with a Docs2Video account)
 * vs other products on the shared Stripe account. Read only.
 */
export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const stripe = getStripe()
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 86400
    const [snap, chargeList, btList, profilesRes] = await Promise.all([
      loadMoneySnapshot(),
      listAllStripe((p) => stripe.charges.list({ created: { gte: thirtyDaysAgo }, ...p } as any)) as Promise<any[]>,
      listAllStripe((p) => stripe.balanceTransactions.list({ created: { gte: thirtyDaysAgo }, type: 'charge', ...p } as any)) as Promise<any[]>,
      createAdminClient().from('profiles').select('stripe_customer_id').not('stripe_customer_id', 'is', null).limit(10000),
    ])
    const ourCustomers = new Set((profilesRes.data ?? []).map((p) => p.stripe_customer_id as string))
    const ok = chargeList.filter((c) => c.status === 'succeeded' && !c.refunded)
    const ours = ok.filter((c) => c.customer && ourCustomers.has(typeof c.customer === 'string' ? c.customer : c.customer.id))
    const ourChargeIds = new Set(ours.map((c) => c.id))
    const otherCents = ok.filter((c) => !ourChargeIds.has(c.id)).reduce((s, c) => s + c.amount, 0)

    const dailyRevenue: Record<string, number> = {}
    for (const c of ours) {
      const day = new Date(c.created * 1000).toISOString().slice(0, 10)
      dailyRevenue[day] = (dailyRevenue[day] || 0) + c.amount
    }
    const d = snap.summary.docs2video
    return NextResponse.json({
      summary: {
        mrr: d.mrrCents,
        totalRevenue30d: ours.reduce((s, c) => s + c.amount, 0),
        netRevenue30d: btList.filter((bt) => ourChargeIds.has(typeof bt.source === 'string' ? bt.source : bt.source?.id)).reduce((s, bt) => s + bt.net, 0),
        otherProducts30d: otherCents,
        paying: d.paying,
        trialing: d.trialing,
        pastDue: d.pastDue,
        paused: d.paused,
        cancelling: d.cancelling,
        conversionRate: snap.conversion.ratePct,
        conversionPaying: snap.conversion.paying,
        conversionEligible: snap.conversion.eligible,
      },
      byPlan: d.byPlan,
      other: snap.summary.other,
      dailyRevenue: Object.entries(dailyRevenue).sort((a, b) => a[0].localeCompare(b[0])).map(([date, amount]) => ({ date, amount })),
      recentPayments: ours.slice(0, 20).map((c) => ({
        id: c.id,
        amount: c.amount,
        currency: c.currency,
        description: c.description || c.metadata?.type || 'Payment',
        date: new Date(c.created * 1000).toISOString(),
        email: c.receipt_email || c.billing_details?.email || '',
      })),
    })
  } catch (err) {
    console.error('[admin/revenue] Error:', err)
    return NextResponse.json({ error: 'Failed to load revenue data' }, { status: 500 })
  }
}
