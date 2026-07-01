import { NextResponse } from 'next/server'
import { getStripe, tierFromPriceId } from '../../../_lib/stripe'
import { createAdminClient } from '../../../_lib/supabase/admin'
import type Stripe from 'stripe'
import { logError } from '../../../_lib/error-logger'
import { grantMonthlyCredits, addTopupCredits, applyTierChange } from '../../../_lib/credits'
import { recordCommission, clawbackByInvoice } from '../../../_lib/affiliate'
import { subscriptionIdFromInvoice, priceIdFromInvoice, isSocialAddonSubscription } from '../../../_lib/stripe-invoice'

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

  // Idempotency (audit B5): atomically claim the event via a dedicated table
  // with event_id PRIMARY KEY. INSERT ... if it conflicts, we've already
  // processed this delivery → stop. This replaces the old non-atomic LIKE-scan
  // over credit_transactions.description that let concurrent retries through.
  const eventId = event.id
  const { error: claimErr } = await supabase
    .from('processed_stripe_events')
    .insert({ event_id: eventId, event_type: event.type })
  if (claimErr) {
    // Unique-violation = duplicate delivery (expected). Any other error: fail so
    // Stripe retries rather than silently dropping a paid event.
    if ((claimErr as any).code === '23505') {
      console.log(`[webhook] Skipping duplicate event ${eventId} (already claimed)`)
      return NextResponse.json({ received: true, duplicate: true })
    }
    console.error(`[webhook] Could not claim event ${eventId}:`, claimErr.message)
    return NextResponse.json({ error: 'idempotency claim failed' }, { status: 500 })
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

        // (Removed: legacy 'project_payment' branch — per-project billing was
        // replaced by user-level credits; the `projects` table never existed in
        // prod, so this only ever errored. No checkout sets project_payment now.)

        if (session.metadata?.type === 'credit_pack') {
          const credits = parseInt(session.metadata.credits || '0', 10)
          // Checkout sets `pack`; older code read `pack_name` (audit L6). Accept
          // either so the ledger description names the actual pack.
          const packName = session.metadata.pack_name || session.metadata.pack || 'credit_pack'
          // Sanity ceiling must sit ABOVE the largest real pack (Studio = 18,000).
          // The old 10,000 cap silently rejected Studio purchases — customer
          // paid and received zero credits.
          if (!Number.isFinite(credits) || credits > 100000) {
            console.error(`[webhook] Rejected credit_pack with implausible credits value: ${session.metadata.credits}`)
            break
          }
          if (credits > 0) {
            // Gate the grant on a per-SESSION key (distinct from the top-level
            // event claim) so it's idempotent independently of that claim. This
            // (a) survives a hard process kill — the reconcile-credit-packs cron
            // can later grant with the SAME pack:{sessionId} key as a no-op-or-
            // heal, and (b) lets the two paths never double-grant. The atomic
            // RPC commits balance + ledger + this key in one transaction.
            await addTopupCredits(userId, credits, packName, { idempotencyKey: `pack:${session.id}` })
            console.log(`[webhook] Credit pack purchased: ${credits} credits for user ${userId}`)
          }
          break
        }

        // AI Social add-on ($50/mo) — flip the entitlement flag. Posting only;
        // generation still uses the user's normal credits.
        if (session.metadata?.type === 'social_addon') {
          await supabase.from('profiles').update({ social_addon_active: true }).eq('id', userId)
          console.log(`[webhook] Social add-on activated for user ${userId}`)
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
          // forceNewCycle (review B11): a completed checkout = real money just
          // moved. Without it, cancel-then-resubscribe within ~25 days hit the
          // same-cycle guard and the paying customer received ZERO credits.
          await grantMonthlyCredits(userId, tier, { forceNewCycle: true })
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
        // The $50 AI-Social add-on is a SEPARATE subscription (review B3).
        // Without this guard its price id (absent from SUBSCRIPTION_PRICES)
        // fell through the `?? 'pro'` fallback below and silently upgraded the
        // MAIN plan — a free user buying the add-on became Pro with a full
        // credit grant. Activation is handled by checkout.session.completed.
        if (isSocialAddonSubscription(subscription)) {
          console.log(`[webhook] Ignoring social_addon subscription.created for customer ${subscription.customer}`)
          break
        }
        const userId = subscription.metadata?.supabase_user_id
        const customerId = subscription.customer as string
        const priceId = subscription.items.data[0]?.price?.id
        // Fail-loud on an unknown price id (audit M1): fall back to the metadata
        // tier, then 'pro' — never silently to 'free' (which would deny a paying
        // customer their credits).
        const tier = (priceId ? tierFromPriceId(priceId) : null)
          ?? (subscription.metadata?.tier ?? 'pro')

        // Free-trial-then-auto-bill: a subscription created in 'trialing' state is
        // our signup trial — the user must STAY on the trial allotment (free 2,000
        // credits) and NOT be upgraded until the first charge actually succeeds.
        // Only store the IDs; the tier flips when trialing → active (charge ok).
        const updateData: Record<string, unknown> = subscription.status === 'trialing'
          ? { subscription_status: 'trial', stripe_customer_id: customerId, stripe_subscription_id: subscription.id }
          : { subscription_status: tier, stripe_customer_id: customerId, stripe_subscription_id: subscription.id }

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

        // Add-on lifecycle must never touch the MAIN plan (review B3): the tier
        // fallback below would upgrade it, and past_due would block the whole
        // account over a failed $50 add-on. Deactivate the add-on when it
        // lapses; full deletion is handled by subscription.deleted.
        if (isSocialAddonSubscription(subscription)) {
          if (['past_due', 'unpaid', 'canceled'].includes(subscription.status)) {
            await supabase.from('profiles').update({ social_addon_active: false }).eq('stripe_customer_id', customerId)
            console.log(`[webhook] Social add-on ${subscription.status} → deactivated for customer ${customerId}`)
          }
          break
        }

        if (subscription.status === 'active') {
          // Unknown price id → keep metadata tier / 'pro', never silent 'free' (M1).
          const tier = (priceId ? tierFromPriceId(priceId) : null)
            ?? (subscription.metadata?.tier ?? 'pro')
          // Was this the trial converting to paid (first successful charge)?
          const { data: prevProfile } = await supabase.from('profiles')
            .select('id, subscription_status').eq('stripe_customer_id', customerId).single()
          const wasTrial = prevProfile?.subscription_status === 'trial'

          const { data: updatedProfile, error: updErr } = await supabase.from('profiles').update({
            subscription_status: tier,
            stripe_subscription_id: subscription.id,
          }).eq('stripe_customer_id', customerId).select('id').single()
          if (updErr) {
            console.error(`[webhook] Failed to update subscription for customer ${customerId}:`, updErr.message)
            return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
          }
          if (updatedProfile?.id) {
            try {
              if (wasTrial) {
                // Trial → paid: the user just paid for a fresh cycle, so grant the
                // FULL plan allotment (not a delta off their depleted trial
                // balance). forceNewCycle: their first charge just succeeded
                // (review B11 — the trial's cycle_start is <25 days old by
                // definition, so the same-cycle guard would swallow this grant).
                await grantMonthlyCredits(updatedProfile.id, tier, { forceNewCycle: true })
                console.log(`[webhook] Trial converted to paid ${tier} for ${updatedProfile.id} — full grant`)
              } else {
                // Normal upgrade/downgrade: add only the positive tier delta (audit #1).
                await applyTierChange(updatedProfile.id, tier)
              }
            } catch (e) {
              console.error(`[webhook] credit grant failed for ${updatedProfile.id} (non-fatal):`, e)
            }
          }
          console.log(`[webhook] Subscription updated to ${tier} for customer ${customerId}`)
        } else if (subscription.status === 'trialing') {
          // Still on the signup free trial — keep them on the trial allotment.
          // The tier + credits are applied only when it transitions to 'active'.
          await supabase.from('profiles').update({
            subscription_status: 'trial', stripe_subscription_id: subscription.id,
          }).eq('stripe_customer_id', customerId)
          console.log(`[webhook] Subscription trialing for customer ${customerId} (no charge yet)`)
        } else if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
          // Dunning (audit H2): keep the user BLOCKED. Setting status to null
          // here dropped them to the free tier, erasing the past_due block that
          // invoice.payment_failed set, so delinquents kept generating.
          const { error: pdErr } = await supabase.from('profiles').update({
            subscription_status: 'past_due',
          }).eq('stripe_customer_id', customerId)
          if (pdErr) {
            console.error(`[webhook] Failed to set past_due for customer ${customerId}:`, pdErr.message)
            return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
          }
          console.log(`[webhook] Subscription ${subscription.status} → past_due for customer ${customerId}`)
        } else if (subscription.status === 'canceled') {
          // Truly canceled → clear to free tier.
          const { error: statusErr } = await supabase.from('profiles').update({
            subscription_status: null,
            stripe_subscription_id: null,
          }).eq('stripe_customer_id', customerId)
          if (statusErr) {
            console.error(`[webhook] Failed to clear canceled subscription for customer ${customerId}:`, statusErr.message)
            return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
          }
          console.log(`[webhook] Subscription canceled for customer ${customerId}`)
        }
        break
      }

      /* ─── Subscription cancelled/deleted ─── */
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        // The AI Social add-on is a SEPARATE subscription — cancelling it must
        // only flip the add-on flag, NOT wipe the user's main plan.
        if (subscription.metadata?.type === 'social_addon') {
          await supabase.from('profiles').update({ social_addon_active: false }).eq('stripe_customer_id', customerId)
          console.log(`[webhook] Social add-on cancelled for customer ${customerId}`)
          break
        }

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
          // Add-on renewals must NOT grant main-plan credits (review B3): the
          // grant below keys off the profile flag, so a $50 add-on cycle would
          // hand out the full plan allotment every month.
          const cycleSubId = subscriptionIdFromInvoice(invoice)
          if (cycleSubId) {
            try {
              const cycleSub = await stripe.subscriptions.retrieve(cycleSubId)
              if (isSocialAddonSubscription(cycleSub)) {
                console.log(`[webhook] social_addon renewal for customer ${customerId} — no plan credits granted`)
                break
              }
            } catch { /* unknown sub → treat as a main-plan cycle below */ }
          }

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
            // Derive the tier from what they PAID for, not the profile flag
            // (review B12): during dunning the flag is 'past_due', which maps
            // to the FREE tier — a recovered payment was resetting a paying
            // customer's cycle to 2,000 credits.
            const paidPriceId = priceIdFromInvoice(invoice)
            const paidTier = (paidPriceId ? tierFromPriceId(paidPriceId) : null) ?? renewProfile.subscription_status
            await grantMonthlyCredits(renewProfile.id, paidTier)
            console.log(`[webhook] Monthly credits granted for user ${renewProfile.id} (${paidTier})`)
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

        // A failed $50 ADD-ON invoice must not block the whole account (review
        // B3): only deactivate the add-on; the main plan keeps its own dunning.
        const failedSubId = subscriptionIdFromInvoice(invoice)
        if (failedSubId) {
          try {
            const failedSub = await stripe.subscriptions.retrieve(failedSubId)
            if (isSocialAddonSubscription(failedSub)) {
              await supabase.from('profiles').update({ social_addon_active: false }).eq('stripe_customer_id', customerId)
              console.log(`[webhook] Social add-on payment failed → deactivated for customer ${customerId}`)
              break
            }
          } catch { /* unknown sub → treat as a main-plan failure below */ }
        }

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

      /* ─── Refund / chargeback — claw back commission AND revoke credits ─── */
      case 'charge.refunded':
      case 'charge.dispute.created':
      case 'charge.dispute.funds_withdrawn': {
        // For disputes the object is a Dispute (with .charge); for refunds it's
        // a Charge. Normalize to a charge id + payment intent.
        const obj = event.data.object as any
        const chargeId: string | null = event.type === 'charge.refunded' ? obj.id : (obj.charge as string | null)
        const invoiceId: string | null = obj.invoice ?? null

        if (invoiceId) {
          await clawbackByInvoice(invoiceId)
          console.log(`[webhook] Clawed back affiliate commission for ${invoiceId}`)
        }

        // Revoke credits if the underlying purchase was a credit pack (audit H1).
        try {
          const paymentIntentId: string | null =
            (event.type === 'charge.refunded' ? obj.payment_intent : null) ?? null
          // Resolve the checkout session for this charge to read its metadata.
          let session: Stripe.Checkout.Session | undefined
          if (paymentIntentId) {
            const list = await stripe.checkout.sessions.list({ payment_intent: paymentIntentId, limit: 1 })
            session = list.data[0]
          } else if (chargeId) {
            const ch = await stripe.charges.retrieve(chargeId)
            if (ch.payment_intent) {
              const list = await stripe.checkout.sessions.list({ payment_intent: ch.payment_intent as string, limit: 1 })
              session = list.data[0]
            }
          }
          if (session?.metadata?.type === 'credit_pack') {
            const userId = session.metadata.supabase_user_id
            const credits = parseInt(session.metadata.credits || '0', 10)
            if (userId && credits > 0) {
              const { error: revErr } = await supabase.rpc('revoke_topup_atomic', {
                p_user_id: userId,
                p_amount: credits,
                p_description: `refund/chargeback ${chargeId || ''}: -${credits} credits`,
                p_idempotency_key: `revoke:${chargeId || event.id}`,
              })
              if (revErr) {
                console.error(`[webhook] Credit revoke failed for ${chargeId}:`, revErr.message)
                return NextResponse.json({ error: 'revoke failed' }, { status: 500 })
              }
              console.log(`[webhook] Revoked ${credits} credits from user ${userId} (${event.type})`)
            }
          }
        } catch (e) {
          console.error(`[webhook] Credit revoke lookup failed for ${event.type} (non-fatal):`, e)
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
    // Release the idempotency claim so Stripe's retry actually re-runs the
    // handler (otherwise the claimed-but-unprocessed event would be skipped and
    // a paid customer would silently get nothing). Best-effort.
    await supabase.from('processed_stripe_events').delete().eq('event_id', eventId)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
