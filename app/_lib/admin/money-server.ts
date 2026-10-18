import type Stripe from 'stripe'
import { getStripe, listAllStripe, SUBSCRIPTION_PRICES } from '../stripe'
import { createAdminClient } from '../supabase/admin'
import { describePrice, monthlyCents, summarizeMoney, conversion, type MoneySub, type MoneySummary } from './money'

/**
 * The server half of the ONE admin money calculation (money.ts is the pure
 * half). Reads live Stripe — READ ONLY — once, and Dashboard / Billing /
 * Revenue all use the result. Kept for 60 seconds per server instance so the
 * three pages opened one after another don't each page through Stripe.
 */

export interface MoneyRow extends MoneySub {
  email: string
  name: string
  userId: string | null
  /** Unix seconds. */
  currentPeriodEnd: number
}

export interface MoneySnapshot {
  summary: MoneySummary
  rows: MoneyRow[]
  conversion: { eligible: number; paying: number; ratePct: number }
  /** Stripe customer ids with a PAYING Docs2Video subscription. */
  payingCustomerIds: string[]
  at: string
}

let cache: { at: number; snap: MoneySnapshot } | null = null

export function testEmails(): string[] {
  return [process.env.TEST_EMAIL, process.env.E2E_TEST_EMAIL].filter((x): x is string => !!x)
}

async function productNames(stripe: Stripe): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  try {
    const prices = await listAllStripe((p) => stripe.prices.list({ expand: ['data.product'], ...p } as any), {}, 5)
    for (const pr of prices as any[]) {
      const prod = pr.product
      if (prod && typeof prod === 'object' && prod.name) out.set(pr.id, prod.name)
    }
  } catch (e) {
    console.warn('[admin/money] could not read product names (non-fatal):', e instanceof Error ? e.message : e)
  }
  return out
}

export async function loadMoneySnapshot(opts: { fresh?: boolean } = {}): Promise<MoneySnapshot> {
  if (!opts.fresh && cache && Date.now() - cache.at < 60_000) return cache.snap
  const stripe = getStripe()
  const [subs, names] = await Promise.all([
    listAllStripe((p) => stripe.subscriptions.list({ status: 'all', expand: ['data.customer'], ...p } as any)) as Promise<any[]>,
    productNames(stripe),
  ])

  const db = createAdminClient()
  const { data: profiles } = await db
    .from('profiles')
    .select('id, email, full_name, subscription_status, is_admin, stripe_customer_id')
    .limit(10000)
  const byCustomer = new Map((profiles ?? []).filter((p) => p.stripe_customer_id).map((p) => [p.stripe_customer_id as string, p]))

  const ctx = { tierPrices: SUBSCRIPTION_PRICES as Record<string, string | undefined>, addonPriceId: process.env.STRIPE_PRICE_ADDON_SOCIAL || null, productNames: names }
  const rows: MoneyRow[] = []
  for (const s of subs) {
    if (s.status === 'canceled' || s.status === 'incomplete_expired') continue
    const item = s.items?.data?.[0]
    const price = item?.price
    const cents = monthlyCents(price?.unit_amount, price?.recurring?.interval, item?.quantity ?? 1, price?.recurring?.interval_count ?? 1)
    const info = describePrice(price?.id, cents, ctx)
    const customerId = typeof s.customer === 'string' ? s.customer : s.customer?.id
    const cust = typeof s.customer === 'string' ? null : (s.customer as Stripe.Customer)
    const profile = byCustomer.get(customerId)
    rows.push({
      id: s.id,
      customerId,
      status: s.status,
      paused: !!s.pause_collection,
      cancelAtPeriodEnd: !!s.cancel_at_period_end,
      priceId: price?.id ?? null,
      monthlyCents: cents,
      planName: info.name,
      kind: info.kind,
      email: profile?.email || cust?.email || '—',
      name: profile?.full_name || cust?.name || '',
      userId: profile?.id ?? null,
      currentPeriodEnd: item?.current_period_end ?? s.current_period_end ?? 0,
    })
  }
  rows.sort((a, b) => b.monthlyCents - a.monthlyCents)

  const summary = summarizeMoney(rows)
  const payingCustomerIds = [...new Set(rows.filter((r) => r.kind !== 'other' && r.status === 'active' && !r.paused).map((r) => r.customerId))]
  const conv = conversion(profiles ?? [], new Set(payingCustomerIds), testEmails())
  const snap: MoneySnapshot = { summary, rows, conversion: conv, payingCustomerIds, at: new Date().toISOString() }
  cache = { at: Date.now(), snap }
  return snap
}
