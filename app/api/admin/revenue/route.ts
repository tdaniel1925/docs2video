import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { requireAdmin } from '../../../_lib/admin'
import { getStripe, listAllStripe } from '../../../_lib/stripe'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const admin = createAdminClient()

  try {
    const stripe = getStripe()

    // Get recent charges (last 30 days)
    const now = Math.floor(Date.now() / 1000)
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60)

    // Paginated (review P3): a single limit:100 page silently under-reported
    // revenue/MRR past 100 charges/subscriptions.
    const [chargeList, subList, btList] = await Promise.all([
      listAllStripe((p) => stripe.charges.list({ created: { gte: thirtyDaysAgo }, ...p } as any)),
      listAllStripe((p) => stripe.subscriptions.list({ status: 'active', ...p } as any)),
      listAllStripe((p) => stripe.balanceTransactions.list({ created: { gte: thirtyDaysAgo }, type: 'charge', ...p } as any)),
    ])
    const charges = { data: chargeList as any[] }
    const subscriptions = { data: subList as any[] }
    const balanceTransactions = { data: btList as any[] }

    // Calculate MRR from active subscriptions
    const mrr = subscriptions.data.reduce((sum, sub) => {
      const amount = sub.items.data[0]?.price?.unit_amount || 0
      const interval = sub.items.data[0]?.price?.recurring?.interval
      if (interval === 'year') return sum + Math.round(amount / 12)
      return sum + amount // monthly
    }, 0)

    // Revenue by day (last 30 days)
    const dailyRevenue: Record<string, number> = {}
    for (const charge of charges.data) {
      if (charge.status === 'succeeded') {
        const day = new Date(charge.created * 1000).toISOString().slice(0, 10)
        dailyRevenue[day] = (dailyRevenue[day] || 0) + charge.amount
      }
    }

    // Subscription breakdown by tier
    const tierBreakdown: Record<string, number> = {}
    for (const sub of subscriptions.data) {
      const tier = sub.metadata?.tier || 'unknown'
      tierBreakdown[tier] = (tierBreakdown[tier] || 0) + 1
    }

    // Total revenue (30 days)
    const totalRevenue30d = charges.data
      .filter(c => c.status === 'succeeded')
      .reduce((sum, c) => sum + c.amount, 0)

    // Recent payments
    const recentPayments = charges.data
      .filter(c => c.status === 'succeeded')
      .slice(0, 20)
      .map(c => ({
        id: c.id,
        amount: c.amount,
        currency: c.currency,
        customer: c.customer,
        description: c.description || c.metadata?.type || 'Payment',
        date: new Date(c.created * 1000).toISOString(),
        email: c.receipt_email || c.billing_details?.email || '',
      }))

    // Net revenue (after Stripe fees)
    const netRevenue30d = balanceTransactions.data
      .reduce((sum, bt) => sum + bt.net, 0)

    // Get profiles with subscriptions for churn calculation
    const { count: activeSubscribers } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .not('subscription_status', 'is', null)
      .neq('subscription_status', 'past_due')

    const { count: totalProfiles } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })

    return NextResponse.json({
      summary: {
        mrr: mrr, // in cents
        totalRevenue30d, // in cents
        netRevenue30d, // in cents (after Stripe fees)
        activeSubscriptions: subscriptions.data.length,
        activeSubscribers: activeSubscribers || 0,
        totalUsers: totalProfiles || 0,
        conversionRate: totalProfiles ? Math.round((activeSubscribers || 0) / totalProfiles * 100) : 0,
      },
      tierBreakdown,
      dailyRevenue: Object.entries(dailyRevenue)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, amount]) => ({ date, amount })),
      recentPayments,
    })
  } catch (err) {
    console.error('[admin/revenue] Error:', err)
    return NextResponse.json({ error: 'Failed to load revenue data' }, { status: 500 })
  }
}
