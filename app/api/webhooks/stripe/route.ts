import { NextResponse } from 'next/server'
import { getStripe, tierFromPriceId } from '../../../_lib/stripe'
import { createAdminClient } from '../../../_lib/supabase/admin'
import type Stripe from 'stripe'
import { logError } from '../../../_lib/error-logger'
import { grantMonthlyCredits, addTopupCredits, applyTierChange } from '../../../_lib/credits'
import { recordCommission, clawbackByInvoice } from '../../../_lib/affiliate'

/** Extract the Stripe promotion-code id from a session or invoice, if any. */
function promoIdFromDiscounts(obj: { discounts?: unknown; discount?: unknown }): string | null {
  // Checkout sessions expose `discounts: [{ promotion_code }]`; invoices expose
  // `discount: { promotion_code }` and/or `discounts: [...]`.
  const discounts = (obj as any).discounts
  if (Array.isArray(discounts)) {
    for (const d of discounts) {
      const pc = d?.promotion_code
      if (typeof pc === 'string') return pc
      if (pc?.id) return pc.id
    }
  }
  const single = (obj as any).discount?.promotion_code
  if (typeof single === 'string') return single
  if (single?.id) return single.id
  return null
}

/**
 * Extract the Stripe coupon id from a session or invoice discount, if any.
 * Used as a fallback when the promotion-code id isn't present — each affiliate
 * has a unique coupon, so this still resolves the affiliate reliably.
 */
function couponIdFromDiscounts(obj: { discounts?: unknown; discount?: unknown }): string | null {
  const pick = (c: unknown): string | null => {
    if (typeof c === 'string') return c
    if (c && typeof c === 'object' && 'id' in (c as any)) return (c as any).id
    return null
  }
  const discounts = (obj as any).discounts
  if (Array.isArray(discounts)) {
    for (const d of discounts) {
      // a discount may carry `coupon` directly, or nest it under promotion_code
      const c = pick(d?.coupon) || pick(d?.promotion_code?.coupon)
      if (c) return c
    }
  }
  const single = pick((obj as any).discount?.coupon) || pick((obj as any).discount?.promotion_code?.coupon)
  return single || null
}

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * POST /api/webhooks/stripe
 * Handles all Stripe webhook events for subscriptions and one-time payments.
 */
export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const stripe = getStripe()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[webhook] Signature verification failed:', message)
    logError('stripe-webhook', err, { detail: 'Signature verification failed' })
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Idempotency: check if we've already processed this event.
  // Matches both bare markers ("stripe_event:{id}") and credit-pack
  // descriptions ("{packName} (stripe_event:{id})").
  const eventId = event.id
  const { data: existingEvent } = await supabase
    .from('credit_transactions')
    .select('id')
    .like('description', `%stripe_event:${eventId}%`)
    .limit(1)

  if (existingEvent && existingEvent.length > 0) {
    console.log(`[webhook] Skipping duplicate event ${eventId} (already processed)`)
    return NextResponse.json({ received: true, duplicate: true })
  }

  try {
    switch (event.type) {
      /* ─── One-time project payment completed ─── */
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.supabase_user_id
        if (!userId) break

        // Store the stripe_customer_id on the profile if not yet saved
        if (session.customer) {
          const { error: custErr } = await supabase.from('profiles').update({
            stripe_customer_id: session.customer as string,
          }).eq('id', userId).is('stripe_customer_id', null)
          if (custErr) console.error(`[webhook] Failed to store customer ID for user ${userId}:`, custErr.message)
        }

        if (session.metadata?.type === 'project_payment') {
          console.log(`[webhook] Project payment completed for user ${userId}, type: ${session.metadata.project_type}`)
          if (session.metadata.project_id) {
            const { error: projErr } = await supabase.from('projects').update({
              payment_status: 'paid',
              stripe_session_id: session.id,
            }).eq('id', session.metadata.project_id)
            if (projErr) {
              console.error(`[webhook] Failed to mark project ${session.metadata.project_id} as paid:`, projErr.message)
              return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
            }
          }
          break
        }

        if (session.metadata?.type === 'credit_pack') {
          const credits = parseInt(session.metadata.credits || '0', 10)
          const packName = session.metadata.pack_name || 'credit_pack'
          // Sanity ceiling must sit ABOVE the largest real pack (Studio = 18,000).
          // The old 10,000 cap silently rejected Studio purchases — customer
          // paid and received zero credits.
          if (!Number.isFinite(credits) || credits > 100000) {
            console.error(`[webhook] Rejected credit_pack with implausible credits value: ${session.metadata.credits}`)
            break
          }
          if (credits > 0) {
            await addTopupCredits(userId, credits, `${packName} (stripe_event:${eventId})`)
            console.log(`[webhook] Credit pack purchased: ${credits} credits for user ${userId}`)
          }
          break
        }

        if (session.metadata?.type === 'subscription') {
          const tier = session.metadata.tier ?? 'pro'
          const subscriptionId = session.subscription as string
          const { error: subErr } = await supabase.from('profiles').update({
            subscription_status: tier,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscriptionId,
          }).eq('id', userId)
          if (subErr) {
            console.error(`[webhook] Failed to update subscription for user ${userId}:`, subErr.message)
            return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
          }
          await grantMonthlyCredits(userId, tier)
          console.log(`[webhook] User ${userId} subscribed to ${tier}`)

          // Affiliate: record the first-payment commission (non-fatal).
          // The webhook's session object doesn't include discounts, so
          // re-fetch with them expanded to read the promotion code reliably.
          try {
            const full = await stripe.checkout.sessions.retrieve(session.id, {
              expand: ['discounts', 'discounts.promotion_code', 'discounts.coupon'],
            })
            const promoId = promoIdFromDiscounts(full)
            const couponId = couponIdFromDiscounts(full)
            const amount = full.amount_total ?? session.amount_total
            if ((promoId || couponId) && amount) {
              const r = await recordCommission({
                stripePromoCodeId: promoId,
                stripeCouponId: couponId,
                payingUserId: userId,
                customerId: session.customer as string,
                stripeInvoiceId: `session:${session.id}`,
                amountPaidCents: amount,
              })
              if (!r.recorded && r.reason !== 'duplicate' && r.reason !== 'self-referral') {
                console.warn(`[webhook] AFFILIATE NOT CREDITED on first payment (session ${session.id}): ${r.reason} — promo=${promoId} coupon=${couponId}`)
              }
            } else if (full.total_details?.amount_discount) {
              // A discount was applied but we couldn't extract an id — flag for reconciliation.
              console.warn(`[webhook] AFFILIATE ATTRIBUTION MISS on first payment (session ${session.id}): discount of ${full.total_details.amount_discount} applied but no promo/coupon id found`)
            }
          } catch (e) {
            console.error('[webhook] affiliate first-payment commission failed (non-fatal):', e)
          }
        }
        break
      }

      /* ─── New subscription created ─── */
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.supabase_user_id
        const customerId = subscription.customer as string
        const priceId = subscription.items.data[0]?.price?.id
        const tier = priceId ? tierFromPriceId(priceId) : (subscription.metadata?.tier ?? 'pro')

        const updateData: Record<string, unknown> = {
          subscription_status: tier,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
        }

        const { error: createErr } = userId
          ? await supabase.from('profiles').update(updateData).eq('id', userId)
          : await supabase.from('profiles').update(updateData).eq('stripe_customer_id', customerId)
        if (createErr) {
          console.error(`[webhook] Failed to create subscription for customer ${customerId}:`, createErr.message)
          return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
        }

        console.log(`[webhook] Subscription created: ${tier} for customer ${customerId}`)
        break
      }

      /* ─── Subscription updated (upgrade/downgrade/status change) ─── */
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const priceId = subscription.items.data[0]?.price?.id

        if (subscription.status === 'active') {
          const tier = priceId ? tierFromPriceId(priceId) : 'pro'
          const { data: updatedProfile, error: updErr } = await supabase.from('profiles').update({
            subscription_status: tier,
            stripe_subscription_id: subscription.id,
          }).eq('stripe_customer_id', customerId).select('id').single()
          if (updErr) {
            console.error(`[webhook] Failed to update subscription for customer ${customerId}:`, updErr.message)
            return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
          }
          // Apply the credit delta for an upgrade here (audit #1). applyTierChange
          // adds only the positive tier delta — it does NOT do a free full refill,
          // and is a no-op for downgrades/same-tier. This replaces the old buggy
          // path where checkCredits later saw a tier mismatch and refilled fully.
          if (updatedProfile?.id) {
            try {
              await applyTierChange(updatedProfile.id, tier)
            } catch (e) {
              console.error(`[webhook] applyTierChange failed for ${updatedProfile.id} (non-fatal):`, e)
            }
          }
          console.log(`[webhook] Subscription updated to ${tier} for customer ${customerId}`)
        } else if (['canceled', 'unpaid', 'past_due'].includes(subscription.status)) {
          const { error: statusErr } = await supabase.from('profiles').update({
            subscription_status: null,
            stripe_subscription_id: null,
          }).eq('stripe_customer_id', customerId)
          if (statusErr) {
            console.error(`[webhook] Failed to update subscription status for customer ${customerId}:`, statusErr.message)
            return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
          }
          console.log(`[webhook] Subscription status ${subscription.status} for customer ${customerId}`)
        }
        break
      }

      /* ─── Subscription cancelled/deleted ─── */
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        const { error: delErr } = await supabase.from('profiles').update({
          subscription_status: null,
          stripe_subscription_id: null,
        }).eq('stripe_customer_id', customerId)
        if (delErr) {
          console.error(`[webhook] Failed to delete subscription for customer ${customerId}:`, delErr.message)
          return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
        }

        console.log(`[webhook] Subscription deleted for customer ${customerId}`)
        break
      }

      /* ─── Recurring payment succeeded ─── */
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        if (invoice.billing_reason === 'subscription_cycle') {
          const { data: renewProfile, error: fetchErr } = await supabase
            .from('profiles')
            .select('id, subscription_status')
            .eq('stripe_customer_id', customerId)
            .single()

          if (fetchErr) {
            console.error(`[webhook] Failed to fetch profile for credit grant, customer ${customerId}:`, fetchErr.message)
            return NextResponse.json({ error: 'DB fetch failed' }, { status: 500 })
          }

          if (renewProfile?.id && renewProfile.subscription_status) {
            // Write the idempotency marker BEFORE granting so a retry that
            // arrives after a crash sees it and skips. Belt-and-suspenders with
            // grantMonthlyCredits being per-cycle idempotent (audit #10).
            const { error: idempErr } = await supabase.from('credit_transactions').insert({
              user_id: renewProfile.id,
              amount: 0,
              balance_after: 0,
              action: 'monthly_grant_event',
              description: `stripe_event:${eventId}`,
            })
            if (idempErr) console.warn(`[webhook] Idempotency log failed:`, idempErr.message)
            await grantMonthlyCredits(renewProfile.id, renewProfile.subscription_status)
            console.log(`[webhook] Monthly credits granted for user ${renewProfile.id} (${renewProfile.subscription_status})`)
          }
          console.log(`[webhook] Recurring payment succeeded for customer ${customerId}, amount: ${invoice.amount_paid}`)

          // Affiliate: record the recurring (lifetime) commission (non-fatal).
          // Re-fetch the invoice with discounts expanded so the promotion code
          // resolves regardless of how Stripe shaped the webhook payload.
          try {
            let promoId: string | null = promoIdFromDiscounts(invoice)
            let couponId: string | null = couponIdFromDiscounts(invoice)
            if (!promoId && !couponId && invoice.id) {
              const full = await stripe.invoices.retrieve(invoice.id, {
                expand: ['discounts', 'discounts.promotion_code', 'discounts.coupon'],
              })
              promoId = promoIdFromDiscounts(full)
              couponId = couponIdFromDiscounts(full)
            }
            if ((promoId || couponId) && invoice.amount_paid && invoice.id) {
              const r = await recordCommission({
                stripePromoCodeId: promoId,
                stripeCouponId: couponId,
                payingUserId: renewProfile?.id ?? null,
                customerId,
                stripeInvoiceId: invoice.id,
                amountPaidCents: invoice.amount_paid,
              })
              if (!r.recorded && r.reason !== 'duplicate' && r.reason !== 'self-referral') {
                console.warn(`[webhook] AFFILIATE NOT CREDITED on recurring payment (invoice ${invoice.id}): ${r.reason} — promo=${promoId} coupon=${couponId}`)
              }
            }
          } catch (e) {
            console.error('[webhook] affiliate recurring commission failed (non-fatal):', e)
          }
        }
        break
      }

      /* ─── Payment failed — mark as past_due ─── */
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        console.error(`[webhook] Payment failed for customer ${customerId}, invoice ${invoice.id}`)

        // Mark user as past_due to restrict access until payment resolves
        const { error: pastDueErr } = await supabase.from('profiles').update({
          subscription_status: 'past_due',
        }).eq('stripe_customer_id', customerId)
        if (pastDueErr) {
          console.error(`[webhook] Failed to set past_due for customer ${customerId}:`, pastDueErr.message)
          return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
        }
        console.log(`[webhook] Set subscription_status to past_due for customer ${customerId}`)
        break
      }

      /* ─── Refund / chargeback — claw back affiliate commission ─── */
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const invoiceId = (charge as any).invoice as string | null
        if (invoiceId) {
          await clawbackByInvoice(invoiceId)
          console.log(`[webhook] Clawed back affiliate commission for refunded invoice ${invoiceId}`)
        }
        break
      }

      default:
        console.log(`[webhook] Unhandled event type: ${event.type}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown webhook handler error'
    console.error(`[webhook] Handler error for ${event.type}:`, message)
    logError('stripe-webhook-handler', err, { eventType: event.type, eventId: event.id })
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
