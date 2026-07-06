import { createHmac, timingSafeEqual } from 'crypto'
import { getStripe } from './stripe'
import { createAdminClient } from './supabase/admin'
import { withRetry } from './with-retry'
import { BUYER_DISCOUNT_PCT, DEFAULT_COMMISSION_RATE } from './affiliate'

/**
 * Apex (reachtheapex.net) integration — Path B.
 *
 * D2V keeps its own Stripe billing. For affiliates flagged payout_via='apex'
 * (Apex reps), each commission touchpoint in the Stripe webhook additionally
 * POSTs a signed event to Apex's integrations webhook, where it becomes a real
 * order that feeds PV/GV and the comp plan. D2V records the commission row for
 * audit but never pays it (suppressed in the admin payout export).
 *
 * Shared secret: APEX_WEBHOOK_SECRET signs BOTH directions (our outbound sale
 * events and Apex's inbound provisioning calls) with HMAC-SHA256 hex in the
 * x-webhook-signature header — same scheme Apex uses for jordyn/agentpulse.
 */

const APEX_URL =
  process.env.APEX_INTEGRATION_URL ||
  'https://reachtheapex.net/api/webhooks/integrations/prismgraphs'

function secret(): string | null {
  return process.env.APEX_WEBHOOK_SECRET || null
}

export function apexEnabled(): boolean {
  return !!secret()
}

export function signApexPayload(rawBody: string): string {
  return createHmac('sha256', secret() || '').update(rawBody).digest('hex')
}

/** Constant-time HMAC check for inbound Apex partner calls. */
export function verifyApexSignature(rawBody: string, signature: string | null): boolean {
  const s = secret()
  if (!s || !signature) return false
  const expected = createHmac('sha256', s).update(rawBody).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

export type ApexSaleEvent = 'sale.created' | 'sale.renewed' | 'sale.refunded'

/**
 * POST one sale event to Apex. Non-fatal: callers are inside the Stripe
 * webhook and must never fail provisioning over a partner notification.
 * Dedupe rides on the commission idempotency upstream (one event per
 * stripe_invoice_id) plus Apex's own (external_source, external_ref) unique
 * constraint — orderId must therefore be the stable invoice/session id.
 */
export async function sendApexSaleEvent(opts: {
  event: ApexSaleEvent
  orderId: string
  affiliateCode: string
  amountCents: number
  tier: string
  customerEmail?: string | null
  customerName?: string | null
}): Promise<boolean> {
  if (!apexEnabled()) return false
  try {
    const body = JSON.stringify({
      event: opts.event,
      event_id: `${opts.event}:${opts.orderId}`,
      timestamp: new Date().toISOString(),
      seller: { user_id: opts.affiliateCode.toLowerCase() }, // Apex distributor slug
      transaction: {
        order_id: opts.orderId,
        amount: Math.round(opts.amountCents) / 100,
        currency: 'usd',
      },
      product: {
        product_id: opts.tier.toLowerCase(),
        product_name: `Docs2Video ${opts.tier}`,
        quantity: 1,
      },
      customer: {
        email: opts.customerEmail || undefined,
        name: opts.customerName || undefined,
      },
    })
    await withRetry(async () => {
      const res = await fetch(APEX_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-signature': signApexPayload(body),
          'user-agent': 'docs2video-apex/1',
        },
        body,
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) {
        const err: Error & { status?: number } = new Error(`apex webhook ${res.status}`)
        err.status = res.status
        throw err
      }
    })
    console.log(`[apex] sent ${opts.event} for ${opts.orderId} (${opts.affiliateCode})`)
    return true
  } catch (e) {
    // Loud log for reconciliation — Apex's monthly settlement true-up catches
    // anything dropped here.
    console.error(`[apex] FAILED to send ${opts.event} for ${opts.orderId}:`, e)
    return false
  }
}

/** Normalize an Apex distributor slug into a D2V referral code. */
export function codeFromApexSlug(slug: string): string {
  return (slug || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32)
}

export interface ApexProvisionResult {
  referralCode: string
  link: string
  created: boolean
}

/**
 * Create (or return) the D2V affiliate for an Apex rep. Called by Apex lazily
 * the first time a rep requests their Docs2Video link.
 *
 * referral_code = the rep's Apex slug (uppercased) so docs2video.com/r/{slug}
 * just works. payout_via='apex' keeps the commission local-payout suppressed.
 * The rep gets a real auth user (by email) so the affiliate FK holds; they can
 * log in later via password reset if they ever want the D2V dashboard.
 */
export async function provisionApexAffiliate(opts: {
  slug: string
  email: string
  name?: string
}): Promise<ApexProvisionResult> {
  const code = codeFromApexSlug(opts.slug)
  if (code.length < 3) throw new Error(`invalid slug: ${opts.slug}`)
  const email = (opts.email || '').trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('invalid email')

  const admin = createAdminClient()
  const link = `https://docs2video.com/r/${code.toLowerCase()}`

  // Already provisioned? (code is the natural key for Apex reps)
  const { data: existing } = await admin
    .from('affiliates')
    .select('id, referral_code, payout_via')
    .eq('referral_code', code)
    .single()
  if (existing) {
    if (existing.payout_via !== 'apex') {
      // A regular affiliate already owns this code — never silently convert.
      throw new Error(`code ${code} belongs to an existing direct affiliate`)
    }
    return { referralCode: code, link, created: false }
  }

  // Find or create the auth user by email.
  let userId: string | null = null
  const { data: prof } = await admin.from('profiles').select('id').eq('email', email).single()
  if (prof) {
    userId = prof.id
  } else {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: opts.name || opts.slug, apex_rep: true },
    })
    if (error || !created?.user) throw new Error(`auth user create failed: ${error?.message}`)
    userId = created.user.id
  }

  // If this user already has an affiliate row (unique user_id), flag it apex
  // and leave their existing code alone — their old links keep working.
  const { data: byUser } = await admin
    .from('affiliates')
    .select('id, referral_code')
    .eq('user_id', userId)
    .single()
  if (byUser) {
    await admin.from('affiliates').update({ payout_via: 'apex' }).eq('id', byUser.id)
    return {
      referralCode: byUser.referral_code,
      link: `https://docs2video.com/r/${byUser.referral_code.toLowerCase()}`,
      created: false,
    }
  }

  // Stripe coupon + promotion code (mirrors enrollAffiliate, custom code).
  const stripe = getStripe()
  const coupon = await stripe.coupons.create({
    percent_off: BUYER_DISCOUNT_PCT,
    duration: 'forever',
    name: `Apex rep ${code}`,
    metadata: { affiliate_user_id: userId, affiliate_code: code, apex_slug: opts.slug },
  })
  let promoId: string
  try {
    const promo = await stripe.promotionCodes.create({
      promotion: { type: 'coupon', coupon: coupon.id },
      code,
      metadata: { affiliate_user_id: userId, affiliate_code: code, apex_slug: opts.slug },
    })
    promoId = promo.id
  } catch (e) {
    // Code taken in Stripe (e.g. old test promo) — suffix keeps checkout
    // attribution working; the /r/{slug} link still resolves via referral_code.
    const promo = await stripe.promotionCodes.create({
      promotion: { type: 'coupon', coupon: coupon.id },
      code: `${code}-APX`.slice(0, 32),
      metadata: { affiliate_user_id: userId, affiliate_code: code, apex_slug: opts.slug },
    })
    promoId = promo.id
  }

  const { error: insErr } = await admin.from('affiliates').insert({
    user_id: userId,
    referral_code: code,
    promo_code: code,
    commission_rate: DEFAULT_COMMISSION_RATE,
    stripe_coupon_id: coupon.id,
    stripe_promo_code_id: promoId,
    status: 'active',
    payout_via: 'apex',
  })
  if (insErr) throw new Error(`affiliate insert failed: ${insErr.message}`)

  return { referralCode: code, link, created: true }
}
