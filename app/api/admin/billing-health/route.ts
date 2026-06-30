import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { isAdminRequest } from '../../../_lib/admin'
import { getStripe, tierFromPriceId } from '../../../_lib/stripe'
import { logAdminAction } from '../../../_lib/audit'

export const runtime = 'nodejs'
export const maxDuration = 60

// Action names written to admin_audit_log so we can suppress acknowledged
// comps without a schema migration (prod doesn't auto-run migrations).
const DISMISS = 'billing_health_dismiss'
const UNDISMISS = 'billing_health_undismiss'

// Latest dismiss/undismiss per user — a user is "dismissed" if their most
// recent event is a dismiss. Returns a Set of currently-dismissed user ids.
async function dismissedUserIds(admin: ReturnType<typeof createAdminClient>): Promise<Set<string>> {
  const { data } = await admin
    .from('admin_audit_log')
    .select('action, target_user_id, created_at')
    .in('action', [DISMISS, UNDISMISS])
    .order('created_at', { ascending: false })
    .limit(2000)
  const seen = new Set<string>()
  const dismissed = new Set<string>()
  for (const row of data ?? []) {
    const uid = row.target_user_id as string | null
    if (!uid || seen.has(uid)) continue
    seen.add(uid) // first (most-recent) wins
    if (row.action === DISMISS) dismissed.add(uid)
  }
  return dismissed
}

// Plan flags that should correspond to a real, paying Stripe subscription.
const PAID_FLAGS = ['pro', 'professional', 'business', 'enterprise', 'agency']
// Stripe statuses that count as "actively has a subscription".
const ACTIVE_STATUSES = ['active', 'trialing', 'past_due']

type DriftKind =
  | 'flagged_paid_no_stripe_sub'   // profile says paid, Stripe has no active sub → loss / freebie
  | 'has_stripe_sub_not_flagged'   // Stripe billing them, profile flag missing/free → they're paying but locked out
  | 'tier_mismatch'                // both exist but plan names disagree
  | 'past_due'                     // Stripe sub is past_due → dunning

interface DriftRow {
  userId: string
  email: string
  name: string | null
  flag: string | null          // profiles.subscription_status
  stripeStatus: string | null  // active | trialing | past_due | null
  stripePlan: string | null    // tier derived from Stripe price
  monthlyCents: number
  kind: DriftKind
  detail: string
  dismissed: boolean   // admin acknowledged this as a known-good comp
}

/**
 * Billing-health drift report. Cross-references every profile's
 * subscription_status flag against the LIVE Stripe truth and surfaces the
 * accounts where they disagree — the exact class of bug that hid the Angela
 * case (flagged 'pro' with no Stripe sub). Read-only; never mutates.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdminRequest(user))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const admin = createAdminClient()
  try {
    const stripe = getStripe()

    // 1. Pull every profile that EITHER has a paid flag OR a Stripe customer id
    //    — those are the only ones that can drift. (Pure-free, no-customer
    //    accounts can't be wrong.)
    const [profilesRes, dismissed] = await Promise.all([
      admin.from('profiles').select('id, email, full_name, subscription_status, stripe_customer_id'),
      dismissedUserIds(admin),
    ])
    const { data: profiles, error: pErr } = profilesRes
    if (pErr) throw pErr

    const candidates = (profiles ?? []).filter(p => {
      const flag = (p.subscription_status || '').toLowerCase()
      return PAID_FLAGS.includes(flag) || !!p.stripe_customer_id
    })

    // 2. Build a customer → active-subscription map in as few Stripe calls as
    //    possible. We list ALL active/trialing/past_due subs (paginated) and
    //    index by customer — far cheaper than one call per profile.
    const subsByCustomer = new Map<string, { status: string; plan: string | null; monthlyCents: number }>()
    for (const status of ['active', 'trialing', 'past_due'] as const) {
      let startingAfter: string | undefined
      // Paginate defensively (cap at 10 pages = 1,000 subs).
      for (let page = 0; page < 10; page++) {
        const res = await stripe.subscriptions.list({ status, limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) })
        for (const sub of res.data) {
          const custId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
          if (!custId) continue
          const price = sub.items.data[0]?.price
          const priceId = price?.id
          const plan = (priceId ? tierFromPriceId(priceId) : null) || (sub.metadata?.tier as string) || null
          const amount = price?.unit_amount || 0
          const interval = price?.recurring?.interval
          const monthlyCents = interval === 'year' ? Math.round(amount / 12) : amount
          // Prefer the "most active" record if a customer somehow has several.
          const existing = subsByCustomer.get(custId)
          if (!existing || (existing.status === 'past_due' && status !== 'past_due')) {
            subsByCustomer.set(custId, { status, plan, monthlyCents })
          }
        }
        if (!res.has_more) break
        startingAfter = res.data[res.data.length - 1]?.id
      }
    }

    // 3. Diff each candidate.
    const drift: DriftRow[] = []
    for (const p of candidates) {
      const flag = (p.subscription_status || '').toLowerCase() || null
      const flaggedPaid = !!flag && PAID_FLAGS.includes(flag)
      const sub = p.stripe_customer_id ? subsByCustomer.get(p.stripe_customer_id) : undefined
      const hasActiveSub = !!sub && ACTIVE_STATUSES.includes(sub.status)

      const base = {
        userId: p.id,
        email: p.email || '(no email)',
        name: p.full_name || null,
        flag,
        stripeStatus: sub?.status ?? null,
        stripePlan: sub?.plan ?? null,
        monthlyCents: sub?.monthlyCents ?? 0,
        dismissed: dismissed.has(p.id),
      }

      if (sub?.status === 'past_due') {
        drift.push({ ...base, kind: 'past_due', detail: 'Stripe subscription is past_due — payment failed, dunning in progress.' })
        continue
      }
      if (flaggedPaid && !hasActiveSub) {
        drift.push({ ...base, kind: 'flagged_paid_no_stripe_sub', detail: `Flagged "${flag}" but no active Stripe subscription — getting paid features for free, or the sub was canceled.` })
        continue
      }
      if (!flaggedPaid && hasActiveSub) {
        drift.push({ ...base, kind: 'has_stripe_sub_not_flagged', detail: `Paying via Stripe (${sub!.plan ?? 'unknown plan'}) but the app flag is "${flag ?? 'free'}" — they're being billed but may be locked out of paid features.` })
        continue
      }
      if (flaggedPaid && hasActiveSub && sub!.plan && flag !== sub!.plan.toLowerCase()) {
        drift.push({ ...base, kind: 'tier_mismatch', detail: `App says "${flag}" but Stripe plan is "${sub!.plan}".` })
        continue
      }
    }

    // Order: revenue-impacting first (people paying but locked out), then
    // freebies, then dunning, then cosmetic tier mismatches.
    const order: Record<DriftKind, number> = { has_stripe_sub_not_flagged: 0, flagged_paid_no_stripe_sub: 1, past_due: 2, tier_mismatch: 3 }
    drift.sort((a, b) => order[a.kind] - order[b.kind])

    // Counts reflect only ACTIVE (non-dismissed) drift — the signal the admin
    // needs to act on. Dismissed comps are acknowledged-good and excluded.
    const active = drift.filter(d => !d.dismissed)
    const counts = {
      flagged_paid_no_stripe_sub: active.filter(d => d.kind === 'flagged_paid_no_stripe_sub').length,
      has_stripe_sub_not_flagged: active.filter(d => d.kind === 'has_stripe_sub_not_flagged').length,
      past_due: active.filter(d => d.kind === 'past_due').length,
      tier_mismatch: active.filter(d => d.kind === 'tier_mismatch').length,
    }

    return NextResponse.json({
      checkedProfiles: candidates.length,
      activeStripeSubs: subsByCustomer.size,
      driftCount: active.length,
      dismissedCount: drift.length - active.length,
      counts,
      drift, // includes dismissed rows; the UI hides them behind a toggle
    })
  } catch (err) {
    console.error('[admin/billing-health] Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

// Dismiss (acknowledge a known-good comp) or un-dismiss a flagged account.
// Recorded in admin_audit_log so no schema migration is required.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdminRequest(user))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  const { userId, dismiss, reason } = await request.json() as { userId: string; dismiss: boolean; reason?: string }
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  try {
    await logAdminAction(user.id, dismiss ? DISMISS : UNDISMISS, userId, reason ? { reason } : undefined)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/billing-health] dismiss error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
