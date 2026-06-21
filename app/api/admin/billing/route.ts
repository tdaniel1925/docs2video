import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { isAdminRequest } from '../../../_lib/admin'
import { getStripe } from '../../../_lib/stripe'
import { tierFromPriceId } from '../../../_lib/stripe'
import type Stripe from 'stripe'

export const runtime = 'nodejs'
export const maxDuration = 30

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return (await isAdminRequest(user)) ? user : null
}

/**
 * GET /api/admin/billing
 * Admin Billing & Sales: live customer + subscription list from Stripe with
 * MRR and status, joined to the user's profile email. Read-only.
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const stripe = getStripe()
    // Pull all non-terminal subscriptions (active, trialing, past_due, paused).
    const subs = await stripe.subscriptions.list({ status: 'all', limit: 100, expand: ['data.customer'] })

    const db = createAdminClient()
    // Map stripe_customer_id -> profile for email/name + app subscription_status.
    const { data: profiles } = await db
      .from('profiles')
      .select('id, email, full_name, subscription_status, stripe_customer_id')
      .not('stripe_customer_id', 'is', null)
    const byCustomer = new Map((profiles ?? []).map(p => [p.stripe_customer_id as string, p]))

    let mrr = 0
    const rows = subs.data
      .filter(s => s.status !== 'canceled' && s.status !== 'incomplete_expired')
      .map((s) => {
        const item = s.items.data[0]
        const amount = (item?.price?.unit_amount ?? 0) // cents/month (monthly plans)
        const interval = item?.price?.recurring?.interval
        const monthly = interval === 'year' ? Math.round(amount / 12) : amount
        if (s.status === 'active' || s.status === 'trialing') mrr += monthly
        const cust = typeof s.customer === 'string' ? null : (s.customer as Stripe.Customer)
        const profile = byCustomer.get(typeof s.customer === 'string' ? s.customer : s.customer.id)
        return {
          subscriptionId: s.id,
          customerId: typeof s.customer === 'string' ? s.customer : s.customer.id,
          email: profile?.email || cust?.email || '—',
          name: profile?.full_name || cust?.name || '',
          tier: item?.price?.id ? (tierFromPriceId(item.price.id) ?? 'unknown') : 'unknown',
          status: s.status,
          pauseCollection: !!s.pause_collection,
          cancelAtPeriodEnd: s.cancel_at_period_end,
          monthlyAmount: monthly,
          // current_period_end lives on the item in newer Stripe API versions;
          // fall back to the subscription-level field for older versions.
          currentPeriodEnd: (item as any)?.current_period_end ?? (s as any).current_period_end ?? 0,
        }
      })
      .sort((a, b) => b.monthlyAmount - a.monthlyAmount)

    return NextResponse.json({
      mrr,
      activeCount: rows.filter(r => r.status === 'active' || r.status === 'trialing').length,
      pastDueCount: rows.filter(r => r.status === 'past_due' || r.status === 'unpaid').length,
      pausedCount: rows.filter(r => r.pauseCollection).length,
      subscriptions: rows,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load billing'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/admin/billing  { subscriptionId, action }
 * action: 'cancel' (at period end) | 'cancel_now' | 'pause' | 'resume'
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
    console.log(`[admin/billing] ${admin.email} ${action} ${subscriptionId} -> ${result.status}`)
    return NextResponse.json({ success: true, status: result.status })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Action failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
