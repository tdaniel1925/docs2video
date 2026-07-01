import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { requireAdmin } from '../../../_lib/admin'
import { getStripe, tierFromPriceId } from '../../../_lib/stripe'
export const maxDuration = 30

export async function GET(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    const [profileRes, videosRes, quotesRes, emailsRes, referralsRes, balanceRes] = await Promise.all([
      admin.from('profiles').select('*').eq('id', id).single(),
      admin.from('videos').select('*').eq('user_id', id).order('created_at', { ascending: false }),
      admin.from('quotes').select('*').eq('user_id', id).order('created_at', { ascending: false }),
      admin.from('email_connections').select('*').eq('user_id', id).order('created_at', { ascending: false }),
      admin.from('profiles').select('id, email, full_name').eq('referred_by', id),
      admin.from('credit_balances').select('balance, topup_balance').eq('user_id', id).maybeSingle(),
    ])

    if (!profileRes.data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Show the REAL spendable balance (credit_balances = monthly + topup), not the
    // dead legacy profiles.credits_remaining column — same overlay /api/admin/data
    // already does for the user list. Without this the detail page showed a stale
    // value (e.g. 10) while the wallet had thousands.
    const realCredits = (balanceRes.data?.balance ?? 0) + (balanceRes.data?.topup_balance ?? 0)

    // LIVE Stripe truth — so the admin can see whether the subscription_status
    // flag actually matches a real paying subscription (the Angela case: flagged
    // 'pro' but no Stripe sub). Best-effort; never fails the request.
    let stripeStatus: {
      hasCustomer: boolean; subscription: string | null; plan: string | null;
      currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; lastPaymentAt: string | null; mismatch: boolean
    } = { hasCustomer: false, subscription: null, plan: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, lastPaymentAt: null, mismatch: false }
    const custId = profileRes.data.stripe_customer_id as string | undefined
    if (custId) {
      try {
        const stripe = getStripe()
        const subs = await stripe.subscriptions.list({ customer: custId, status: 'all', limit: 5 })
        const active = subs.data.find(s => s.status === 'active' || s.status === 'trialing' || s.status === 'past_due')
        const flag = (profileRes.data.subscription_status as string | null) || null
        const paidFlag = ['pro', 'professional', 'business', 'enterprise', 'agency'].includes((flag || '').toLowerCase())
        let plan: string | null = null
        let periodEndUnix = 0
        if (active) {
          const item = active.items.data[0]
          const priceId = item?.price?.id
          plan = (priceId ? tierFromPriceId(priceId) : null) || (active.metadata?.tier as string) || null
          // current_period_end lives on the item in newer Stripe API versions;
          // fall back to the subscription-level field for older versions.
          periodEndUnix = (item as any)?.current_period_end ?? (active as any).current_period_end ?? 0
        }
        // Recent successful charge (last payment).
        const charges = await stripe.charges.list({ customer: custId, limit: 1 }).catch(() => null)
        const lastPaid = charges?.data.find(c => c.status === 'succeeded')
        stripeStatus = {
          hasCustomer: true,
          subscription: active ? active.status : null,
          plan,
          currentPeriodEnd: periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null,
          cancelAtPeriodEnd: !!active?.cancel_at_period_end,
          lastPaymentAt: lastPaid ? new Date(lastPaid.created * 1000).toISOString() : null,
          // Mismatch = flagged paid but Stripe has no active sub (or vice-versa).
          mismatch: paidFlag !== !!active,
        }
      } catch (e) {
        console.warn('[admin/user-detail] Stripe lookup failed (non-fatal):', e instanceof Error ? e.message : e)
      }
    }

    return NextResponse.json({
      stripe: stripeStatus,
      profile: { ...profileRes.data, credits_remaining: realCredits },
      videos: videosRes.data ?? [],
      quotes: quotesRes.data ?? [],
      emailConnections: emailsRes.data ?? [],
      referrals: referralsRes.data ?? [],
    })
  } catch (err) {
    console.error('[admin/user-detail] Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
