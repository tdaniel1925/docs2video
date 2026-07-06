import { getStripe } from './stripe'
import { createAdminClient } from './supabase/admin'

/**
 * Affiliate program v1 — recurring (lifetime) commission, manual payouts,
 * Stripe promo-code tracking. Self-serve enrollment.
 *
 * Money flow: each affiliate gets a unique Stripe promotion code that gives the
 * BUYER a small discount and attributes the sale. On every payment by a
 * referred customer (first + recurring, forever), we record a commission row
 * against the actual amount paid. Payouts are manual (admin exports a CSV).
 */

export const DEFAULT_COMMISSION_RATE = 20 // percent
export const BUYER_DISCOUNT_PCT = 15 // percent off, applied via the promo code

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars

/** Deterministic-ish readable code seeded from a name + random tail. */
export function generateReferralCode(seed: string): string {
  const base = (seed || 'AFF').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 5) || 'AFF'
  let tail = ''
  // Avoid Math.random in workflow scripts, but this is a normal route — fine here.
  for (let i = 0; i < 4; i++) tail += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  return `${base}${tail}`
}

interface EnrollResult {
  affiliateId: string
  referralCode: string
  promoCode: string
}

/**
 * Self-serve enrollment. Idempotent: if the user already has an affiliate row,
 * returns it. Creates a Stripe coupon (buyer discount) + promotion code and
 * stores their ids on the affiliate row.
 */
export async function enrollAffiliate(userId: string, displayName?: string): Promise<EnrollResult> {
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('affiliates')
    .select('id, referral_code, promo_code, stripe_promo_code_id')
    .eq('user_id', userId)
    .single()
  if (existing?.stripe_promo_code_id) {
    return { affiliateId: existing.id, referralCode: existing.referral_code, promoCode: existing.promo_code || existing.referral_code }
  }

  const stripe = getStripe()

  // Generate a unique code (retry on collision).
  let code = ''
  for (let attempt = 0; attempt < 6; attempt++) {
    code = generateReferralCode(displayName || '')
    const { data: clash } = await admin.from('affiliates').select('id').eq('referral_code', code).limit(1)
    if (!clash || clash.length === 0) break
  }

  // One coupon per affiliate gives the buyer the standing discount. forever =
  // recurring discount; tracking (the commission) is what's lifetime.
  const coupon = await stripe.coupons.create({
    percent_off: BUYER_DISCOUNT_PCT,
    duration: 'forever',
    name: `Affiliate ${code}`,
    metadata: { affiliate_user_id: userId, affiliate_code: code },
  })
  const promo = await stripe.promotionCodes.create({
    promotion: { type: 'coupon', coupon: coupon.id },
    code,
    metadata: { affiliate_user_id: userId, affiliate_code: code },
  })

  if (existing?.id) {
    await admin.from('affiliates').update({
      referral_code: code,
      promo_code: code,
      stripe_coupon_id: coupon.id,
      stripe_promo_code_id: promo.id,
    }).eq('id', existing.id)
    return { affiliateId: existing.id, referralCode: code, promoCode: code }
  }

  const { data: created, error } = await admin.from('affiliates').insert({
    user_id: userId,
    referral_code: code,
    promo_code: code,
    commission_rate: DEFAULT_COMMISSION_RATE,
    stripe_coupon_id: coupon.id,
    stripe_promo_code_id: promo.id,
    status: 'active',
  }).select('id').single()
  if (error || !created) throw new Error(`Failed to create affiliate: ${error?.message}`)

  return { affiliateId: created.id, referralCode: code, promoCode: code }
}

/** Resolve a Stripe promotion-code id (from a paid invoice/session) to its affiliate. */
export async function getAffiliateByStripePromoId(stripePromoCodeId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('affiliates')
    .select('id, user_id, commission_rate, status, referral_code, payout_via')
    .eq('stripe_promo_code_id', stripePromoCodeId)
    .single()
  return data || null
}

/** Resolve a Stripe coupon id (fallback when the promo-code id isn't present). */
export async function getAffiliateByCouponId(stripeCouponId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('affiliates')
    .select('id, user_id, commission_rate, status, referral_code, payout_via')
    .eq('stripe_coupon_id', stripeCouponId)
    .single()
  return data || null
}

export async function getAffiliateByCode(code: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('affiliates')
    .select('id, user_id, commission_rate, status, stripe_promo_code_id')
    .eq('referral_code', code.toUpperCase())
    .single()
  return data || null
}

/**
 * Record one commission for a payment by a referred customer. Idempotent on
 * stripeInvoiceId. NON-FATAL: callers (the Stripe webhook) must never let a
 * commission failure break subscription provisioning — log and move on.
 *
 * Self-referral guard: if the paying user IS the affiliate, skip silently.
 */
export async function recordCommission(opts: {
  stripePromoCodeId?: string | null
  stripeCouponId?: string | null
  payingUserId?: string | null
  customerId?: string | null
  stripeInvoiceId: string
  amountPaidCents: number
}): Promise<{
  recorded: boolean
  reason?: string
  /** Set when recorded — lets the webhook forward Apex-payable sales upstream. */
  affiliate?: { id: string; code: string; payoutVia: string }
}> {
  try {
    if (!opts.amountPaidCents || opts.amountPaidCents <= 0) return { recorded: false, reason: 'zero amount' }
    // Resolve the affiliate by promo-code id first; fall back to the coupon id
    // (each affiliate has a unique coupon) so attribution never depends on the
    // exact discount payload shape Stripe returns.
    let affiliate = opts.stripePromoCodeId ? await getAffiliateByStripePromoId(opts.stripePromoCodeId) : null
    if (!affiliate && opts.stripeCouponId) affiliate = await getAffiliateByCouponId(opts.stripeCouponId)
    if (!affiliate) return { recorded: false, reason: 'no affiliate for promo/coupon' }
    if (affiliate.status !== 'active') return { recorded: false, reason: `affiliate ${affiliate.status}` }
    if (opts.payingUserId && opts.payingUserId === affiliate.user_id) {
      return { recorded: false, reason: 'self-referral' }
    }

    const admin = createAdminClient()
    const rate = Number(affiliate.commission_rate) || DEFAULT_COMMISSION_RATE
    const commissionCents = Math.round(opts.amountPaidCents * (rate / 100))

    // Find/create the referral row linking affiliate → referred user.
    let referralId: string | null = null
    if (opts.payingUserId) {
      const { data: ref } = await admin
        .from('referrals')
        .select('id')
        .eq('affiliate_id', affiliate.id)
        .eq('referred_user_id', opts.payingUserId)
        .single()
      if (ref) {
        referralId = ref.id
        await admin.from('referrals').update({
          status: 'paid',
          conversion_at: new Date().toISOString(),
        }).eq('id', ref.id)
      } else {
        const { data: newRef } = await admin.from('referrals').insert({
          affiliate_id: affiliate.id,
          referred_user_id: opts.payingUserId,
          status: 'paid',
          conversion_at: new Date().toISOString(),
        }).select('id').single()
        referralId = newRef?.id ?? null
      }
    }

    // Idempotent insert — unique(stripe_invoice_id) blocks webhook retries.
    const { error } = await admin.from('affiliate_commissions').insert({
      affiliate_id: affiliate.id,
      referral_id: referralId,
      referred_user_id: opts.payingUserId ?? null,
      stripe_invoice_id: opts.stripeInvoiceId,
      amount_cents: opts.amountPaidCents,
      commission_cents: commissionCents,
      rate,
      status: 'pending',
    })
    if (error) {
      // Duplicate key = already recorded (retry). Anything else: log, non-fatal.
      if (error.code === '23505') return { recorded: false, reason: 'duplicate' }
      console.error('[affiliate] recordCommission insert error:', error.message)
      return { recorded: false, reason: error.message }
    }

    // Rollups (total_earned etc.) are recomputed on read in the dashboard, so
    // no extra write is needed here.
    return {
      recorded: true,
      affiliate: {
        id: affiliate.id,
        code: (affiliate as { referral_code?: string }).referral_code ?? '',
        payoutVia: (affiliate as { payout_via?: string }).payout_via ?? 'direct',
      },
    }
  } catch (e) {
    console.error('[affiliate] recordCommission error:', e)
    return { recorded: false, reason: 'exception' }
  }
}

/**
 * Mark all commissions tied to an invoice as clawed back (refund/chargeback).
 * Returns the affected rows joined with their affiliate's code/payout_via so
 * the webhook can forward refunds for Apex-payable affiliates.
 */
export async function clawbackByInvoice(stripeInvoiceId: string): Promise<
  { amountCents: number; affiliateCode: string; payoutVia: string }[]
> {
  try {
    const admin = createAdminClient()
    const { data } = await admin.from('affiliate_commissions')
      .update({ status: 'clawed_back' })
      .eq('stripe_invoice_id', stripeInvoiceId)
      .neq('status', 'paid') // don't claw back money already sent
      .select('amount_cents, affiliates ( referral_code, payout_via )')
    return (data ?? []).map(r => {
      const aff = r.affiliates as unknown as { referral_code?: string; payout_via?: string } | null
      return {
        amountCents: r.amount_cents || 0,
        affiliateCode: aff?.referral_code ?? '',
        payoutVia: aff?.payout_via ?? 'direct',
      }
    })
  } catch (e) {
    console.error('[affiliate] clawbackByInvoice error:', e)
    return []
  }
}

/** Save where/how an affiliate wants to be paid. */
export async function setPayoutInfo(userId: string, payoutEmail: string, payoutMethod?: string): Promise<boolean> {
  const admin = createAdminClient()
  const update: Record<string, unknown> = { payout_email: payoutEmail }
  if (payoutMethod !== undefined) update.payout_method = payoutMethod
  const { error } = await admin.from('affiliates').update(update).eq('user_id', userId)
  if (error) {
    console.error('[affiliate] setPayoutInfo error:', error.message)
    return false
  }
  return true
}

/** Aggregate stats for the affiliate dashboard. */
export async function getAffiliateStats(userId: string) {
  const admin = createAdminClient()
  const { data: aff } = await admin
    .from('affiliates')
    .select('id, referral_code, promo_code, commission_rate, status, stripe_promo_code_id, payout_email, payout_method')
    .eq('user_id', userId)
    .single()
  if (!aff) return null

  const [{ count: clicks }, { data: referrals }, { data: commissions }] = await Promise.all([
    admin.from('affiliate_clicks').select('*', { count: 'exact', head: true }).eq('affiliate_id', aff.id),
    admin.from('referrals').select('status').eq('affiliate_id', aff.id),
    admin.from('affiliate_commissions').select('commission_cents, status').eq('affiliate_id', aff.id),
  ])

  const signups = (referrals ?? []).filter(r => r.status === 'signed_up' || r.status === 'converted' || r.status === 'paid').length
  const paying = (referrals ?? []).filter(r => r.status === 'paid').length
  const sum = (s: string) => (commissions ?? []).filter(c => c.status === s).reduce((a, c) => a + (c.commission_cents || 0), 0)
  const earnedPending = sum('pending') + sum('approved')
  const earnedPaid = sum('paid')

  return {
    affiliate: aff,
    clicks: clicks ?? 0,
    signups,
    paying,
    pendingCents: earnedPending,
    paidCents: earnedPaid,
    lifetimeCents: earnedPending + earnedPaid,
  }
}
