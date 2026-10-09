import { NextResponse } from 'next/server'
import { getStripe, tierFromPriceId } from '../../../_lib/stripe'
import { createAdminClient } from '../../../_lib/supabase/admin'
import type Stripe from 'stripe'
import { logError } from '../../../_lib/error-logger'
import { alertOps, stripeEventCustomer } from '../../../_lib/ops-alert'
import { recordPaymentFailure } from '../../../_lib/admin/payment-alerts'
import {
  grantMonthlyCredits, addTopupCredits, applyTierChange,
  revokeCredits, proportionalCredits, TIER_CREDITS,
} from '../../../_lib/credits'
import { recordCommission, clawbackByInvoice } from '../../../_lib/affiliate'
import { sendApexSaleEvent } from '../../../_lib/apex'
import { findAuthUserByEmail, isEmailConfirmed } from '../../../_lib/auth-user-lookup'
import { siteUrl } from '../../../_lib/site-url'
import { subscriptionIdFromInvoice, priceIdFromInvoice, isSocialAddonSubscription } from '../../../_lib/stripe-invoice'
import { getPlan, getUserTier } from '../../../_lib/pricing'
import {
  cancelSupersededSubscriptions, listLiveMainSubscriptions, subscriptionOnFile,
  invoiceIdForPayment, stripeId,
} from '../../../_lib/billing'

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
 *
 * ERROR RULE (audit H1): inside the handler, any failure that Stripe should
 * retry is THROWN, never returned. The single catch at the bottom releases the
 * "already processed" claim and answers 500, so Stripe's retry actually runs.
 * Several paths used to `return 500` directly — the claim stayed, the retry was
 * skipped as a duplicate, and a customer who paid got no plan or credits.
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
        let userId = session.metadata?.supabase_user_id

        // Apex Path-B on-site checkout. A buyer with NO Docs2Video account yet
        // is provisioned HERE, after payment (never at checkout-init), so
        // abandoned checkouts create nothing. A buyer who already has an
        // account arrives with supabase_user_id set.
        const apexEmail = session.metadata?.source === 'apex' ? session.metadata?.apex_email : undefined
        if (apexEmail) {
          const apexName = session.metadata?.apex_name ?? null
          const referralSource = session.metadata?.referral_source ?? null
          const hadAccountAtCheckout = !!userId
          // Send the "choose a password" email when this purchase made the
          // account, or matched one whose owner never confirmed the address.
          let needsPasswordSetup = false

          if (!userId) {
            const created = await supabase.auth.admin.createUser({
              email: apexEmail,
              email_confirm: true,
              user_metadata: { full_name: apexName, source: 'apex' },
            })
            if (created.data?.user) {
              userId = created.data.user.id
              needsPasswordSetup = true
            } else {
              // The address is already taken. Match on the SIGN-IN email Supabase
              // holds, not profiles.email: anyone can type any address into their
              // own profile, which would let a stranger's account receive this
              // buyer's paid plan.
              const existing = await findAuthUserByEmail(supabase, apexEmail)
              if (existing) {
                userId = existing.id
                // Unconfirmed = whoever signed up never proved they own this
                // inbox. The set-password email goes to that inbox, so the real
                // owner (the buyer) can still take the account over.
                if (!isEmailConfirmed(existing)) needsPasswordSetup = true
              }
            }
            if (!userId) {
              // They PAID and we have no account for them. This used to be
              // logged and swallowed with a 200 — Stripe never retried and the
              // customer was left with nothing. Throw so Stripe retries.
              throw new Error(`apex account provisioning failed for session ${session.id}: ${created.error?.message ?? 'no user returned'}`)
            }
          }

          await supabase.from('profiles').update({
            source: 'apex',
            ...(apexName ? { full_name: apexName } : {}),
            email: apexEmail,
          }).eq('id', userId)

          // Report the base-subscription sale to Apex (Path B) — directly, not
          // via the affiliate/promo path (Apex handles the rep comp on its side).
          // Sent for NEW and EXISTING users alike (existing users' sales used to
          // be skipped). orderId is the invoice id, and Apex dedupes on
          // event+orderId, so a webhook retry can't double-report.
          if (referralSource) {
            const invoiceRef = stripeId(session.invoice) ?? `session:${session.id}`
            await sendApexSaleEvent({
              event: 'sale.created',
              orderId: invoiceRef,
              affiliateCode: referralSource,
              amountCents: session.amount_total ?? 0,
              tier: session.metadata?.tier ?? 'pro',
              customerEmail: apexEmail,
              customerName: apexName,
            })
          }

          // Welcome / password-setup email — only for accounts made by this
          // purchase (or matched but never confirmed, see above).
          if (!hadAccountAtCheckout && needsPasswordSetup) {
            try {
              const link = await supabase.auth.admin.generateLink({
                type: 'recovery',
                email: apexEmail,
                options: { redirectTo: `${siteUrl()}/reset-password` },
              })
              if (link.error) console.error('[webhook] apex set-password link failed:', link.error.message)
              // Prefer our own /auth/confirm link: it checks the one-time token
              // on the server and opens the new-password page on ANY device.
              // (The old link went through /auth/callback, which needs a code
              // these server-made links never carry, so buyers landed on the
              // login page with no password.) The raw Supabase link — which
              // drops the buyer on /reset-password with the session in the
              // address — is only a fallback.
              const hashed = link.data?.properties?.hashed_token
              const actionLink = hashed
                ? `${siteUrl()}/auth/confirm?token_hash=${encodeURIComponent(hashed)}&type=recovery&next=/reset-password`
                : link.data?.properties?.action_link
              if (actionLink) {
                const { sendApexWelcomeEmail } = await import('../../../_lib/apex')
                await sendApexWelcomeEmail({ to: apexEmail, actionLink })
              }
            } catch (mailErr) {
              console.error('[webhook] apex welcome email failed (non-fatal):', mailErr)
            }
          }
        }

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
          // Only a PAID checkout starts a plan. An unpaid session must never
          // grant paid features or credits.
          if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
            console.warn(`[webhook] Subscription checkout ${session.id} completed with payment_status=${session.payment_status} — not granting until paid`)
            break
          }
          const tier = session.metadata.tier ?? 'pro'
          const subscriptionId = stripeId(session.subscription)
          const { data: before } = await supabase
            .from('profiles').select('stripe_customer_id').eq('id', userId).maybeSingle()
          const { error: subErr } = await supabase.from('profiles').update({
            subscription_status: tier,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscriptionId,
            // They just paid with a card. Without this, a subscriber who later
            // cancels drops to free with card_on_file=false and is blocked from
            // spending their remaining credits by the card-required rule.
            card_on_file: true,
          }).eq('id', userId)
          if (subErr) {
            throw new Error(`Failed to update subscription for user ${userId}: ${subErr.message}`)
          }
          // forceNewCycle (review B11): a completed checkout = real money just
          // moved. Without it, cancel-then-resubscribe within ~25 days hit the
          // same-cycle guard and the paying customer received ZERO credits.
          await grantMonthlyCredits(userId, tier, { forceNewCycle: true })
          console.log(`[webhook] User ${userId} subscribed to ${tier}`)

          // Never leave a second plan billing the card (audit C3): cancel the
          // card-on-file trial this checkout replaced, and any other live
          // main-plan subscription on this user's customers. Non-fatal — the
          // new, paid subscription stands either way.
          if (subscriptionId) {
            try {
              const cancelled = await cancelSupersededSubscriptions(
                stripe,
                [session.customer as string, before?.stripe_customer_id, session.metadata.previous_customer_id],
                subscriptionId,
              )
              const replaces = session.metadata.replaces_subscription
              if (replaces && replaces !== subscriptionId && !cancelled.includes(replaces)) {
                await stripe.subscriptions.cancel(replaces).catch((e: unknown) => {
                  // Already canceled is fine; anything else needs a human.
                  console.warn(`[webhook] could not cancel replaced subscription ${replaces}:`, e instanceof Error ? e.message : e)
                })
              }
            } catch (e) {
              console.error('[webhook] superseded-subscription cleanup failed (non-fatal):', e)
            }
          }

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
            // Key the commission to the session's REAL invoice when one exists
            // (subscription-mode sessions always have one). Refunds arrive with
            // the invoice id — a `session:` key would never match, so the
            // clawback (and the Apex sale.refunded forward) would silently miss
            // first payments. `session:` remains the fallback for payment-mode.
            const firstPaymentRef = stripeId(full.invoice) ?? `session:${session.id}`
            if ((promoId || couponId) && amount) {
              const r = await recordCommission({
                stripePromoCodeId: promoId,
                stripeCouponId: couponId,
                payingUserId: userId,
                customerId: session.customer as string,
                stripeInvoiceId: firstPaymentRef,
                amountPaidCents: amount,
              })
              if (!r.recorded && r.reason !== 'duplicate' && r.reason !== 'self-referral') {
                console.warn(`[webhook] AFFILIATE NOT CREDITED on first payment (session ${session.id}): ${r.reason} — promo=${promoId} coupon=${couponId}`)
              }
              // Apex rep sale → forward to the Apex comp plan (Path B).
              // Rides recordCommission's idempotency: only a freshly recorded
              // commission emits, so Stripe webhook retries can't double-send.
              // orderId MUST equal the id refunds will carry (the invoice id) so
              // Apex's external_ref lookup matches on sale.refunded.
              if (r.recorded && r.affiliate?.payoutVia === 'apex') {
                await sendApexSaleEvent({
                  event: 'sale.created',
                  orderId: firstPaymentRef,
                  affiliateCode: r.affiliate.code,
                  amountCents: amount,
                  tier,
                  customerEmail: full.customer_details?.email,
                  customerName: full.customer_details?.name,
                })
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

        // Not paid yet (incomplete) or never paid (incomplete_expired): grant
        // NOTHING. The plan starts when it turns active (subscription.updated)
        // or the checkout completes paid.
        if (subscription.status !== 'active' && subscription.status !== 'trialing') {
          console.log(`[webhook] subscription.created ${subscription.id} is ${subscription.status} — no plan change until it is paid`)
          break
        }

        const lookup = supabase.from('profiles').select('id, subscription_status')
        const { data: prof, error: profErr } = userId
          ? await lookup.eq('id', userId).maybeSingle()
          : await lookup.eq('stripe_customer_id', customerId).maybeSingle()
        if (profErr) throw new Error(`profile lookup failed for customer ${customerId}: ${profErr.message}`)
        if (!prof) {
          console.warn(`[webhook] subscription.created ${subscription.id}: no profile for customer ${customerId}`)
          break
        }

        const priceId = subscription.items.data[0]?.price?.id
        // Fail-loud on an unknown price id (audit M1): fall back to the metadata
        // tier, then 'pro' — never silently to 'free' (which would deny a paying
        // customer their credits).
        const tier = (priceId ? tierFromPriceId(priceId) : null)
          ?? (subscription.metadata?.tier ?? 'pro')

        let updateData: Record<string, unknown>
        if (subscription.status === 'trialing') {
          // Free-trial-then-auto-bill: a subscription created in 'trialing'
          // state is our signup trial — the user STAYS on the trial allotment
          // until the first charge actually succeeds. But a trial must never
          // downgrade someone who is already paying (audit C2).
          if (getUserTier(prof.subscription_status) !== 'free') {
            console.warn(`[webhook] trialing subscription ${subscription.id} created for PAYING user ${prof.id} (${prof.subscription_status}) — not changing their plan`)
            break
          }
          updateData = { subscription_status: 'trial', stripe_customer_id: customerId, stripe_subscription_id: subscription.id }
        } else {
          updateData = { subscription_status: tier, stripe_customer_id: customerId, stripe_subscription_id: subscription.id }
        }

        const { error: createErr } = await supabase.from('profiles').update(updateData).eq('id', prof.id)
        if (createErr) {
          throw new Error(`Failed to record new subscription for customer ${customerId}: ${createErr.message}`)
        }

        console.log(`[webhook] Subscription created: ${subscription.status === 'trialing' ? 'trial' : tier} for customer ${customerId}`)
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

        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('id, subscription_status, stripe_subscription_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()
        if (profErr) throw new Error(`profile lookup failed for customer ${customerId}: ${profErr.message}`)
        if (!prof) {
          console.warn(`[webhook] subscription.updated ${subscription.id}: no profile for customer ${customerId}`)
          break
        }

        // Only the subscription we have ON FILE may change the user's plan
        // (audit C3). An update to an old, replaced or duplicate subscription
        // (e.g. the trial that a paid plan just replaced) is ignored.
        const onFile = subscriptionOnFile(prof.stripe_subscription_id, subscription.id)
        if (onFile === 'other') {
          console.log(`[webhook] subscription.updated for ${subscription.id} (${subscription.status}) ignored — ${prof.stripe_subscription_id} is on file for user ${prof.id}`)
          break
        }

        if (subscription.status === 'active') {
          // Unknown price id → keep metadata tier / 'pro', never silent 'free' (M1).
          const tier = (priceId ? tierFromPriceId(priceId) : null)
            ?? (subscription.metadata?.tier ?? 'pro')

          // Trial → paid exactly ONCE (audit, Low): only the update that
          // actually flips 'trial' → tier wins the conditional write, so two
          // near-simultaneous events can't both hand out the full grant.
          const { data: converted, error: convErr } = await supabase.from('profiles').update({
            subscription_status: tier,
            stripe_subscription_id: subscription.id,
          }).eq('id', prof.id).eq('subscription_status', 'trial').select('id')
          if (convErr) throw new Error(`Failed to update subscription for customer ${customerId}: ${convErr.message}`)
          const wasTrial = !!converted && converted.length > 0

          if (!wasTrial) {
            const { error: updErr } = await supabase.from('profiles').update({
              subscription_status: tier,
              stripe_subscription_id: subscription.id,
            }).eq('id', prof.id)
            if (updErr) throw new Error(`Failed to update subscription for customer ${customerId}: ${updErr.message}`)
          }

          try {
            if (wasTrial) {
              // Trial → paid: the user just paid for a fresh cycle, so grant the
              // FULL plan allotment (not a delta off their depleted trial
              // balance). forceNewCycle: their first charge just succeeded
              // (review B11 — the trial's cycle_start is <25 days old by
              // definition, so the same-cycle guard would swallow this grant).
              await grantMonthlyCredits(prof.id, tier, { forceNewCycle: true })
              console.log(`[webhook] Trial converted to paid ${tier} for ${prof.id} — full grant`)
            } else {
              // Normal upgrade/downgrade: add only the positive tier delta (audit #1).
              await applyTierChange(prof.id, tier)
            }
          } catch (e) {
            console.error(`[webhook] credit grant failed for ${prof.id} (non-fatal):`, e)
          }
          console.log(`[webhook] Subscription updated to ${tier} for customer ${customerId}`)
        } else if (subscription.status === 'trialing') {
          // Still on the signup free trial — keep them on the trial allotment.
          // The tier + credits are applied only when it transitions to 'active'.
          // Never downgrade a paying user to 'trial'.
          if (getUserTier(prof.subscription_status) !== 'free') {
            console.warn(`[webhook] trialing update for ${subscription.id} ignored — user ${prof.id} is on ${prof.subscription_status}`)
            break
          }
          const { error: trErr } = await supabase.from('profiles').update({
            subscription_status: 'trial', stripe_subscription_id: subscription.id,
          }).eq('id', prof.id)
          if (trErr) throw new Error(`Failed to record trialing for customer ${customerId}: ${trErr.message}`)
          console.log(`[webhook] Subscription trialing for customer ${customerId} (no charge yet)`)
        } else if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
          // Dunning (audit H2): keep the user BLOCKED. Setting status to null
          // here dropped them to the free tier, erasing the past_due block that
          // invoice.payment_failed set, so delinquents kept generating.
          const { error: pdErr } = await supabase.from('profiles').update({
            subscription_status: 'past_due',
          }).eq('id', prof.id)
          if (pdErr) throw new Error(`Failed to set past_due for customer ${customerId}: ${pdErr.message}`)
          console.log(`[webhook] Subscription ${subscription.status} → past_due for customer ${customerId}`)
        } else if (subscription.status === 'canceled') {
          // Nothing on file (older accounts): only drop to free if no OTHER
          // live plan exists for this customer.
          if (onFile === 'none_on_file' && (await listLiveMainSubscriptions(stripe, customerId)).length > 0) {
            console.log(`[webhook] canceled ${subscription.id} ignored — customer ${customerId} has another live plan`)
            break
          }
          // Truly canceled → clear to free tier.
          const { error: statusErr } = await supabase.from('profiles').update({
            subscription_status: null,
            stripe_subscription_id: null,
          }).eq('id', prof.id)
          if (statusErr) throw new Error(`Failed to clear canceled subscription for customer ${customerId}: ${statusErr.message}`)
          console.log(`[webhook] Subscription canceled for customer ${customerId}`)
        } else {
          // incomplete / incomplete_expired / paused: not paid — never grant
          // paid features (audit, Medium). Leave the profile as it is.
          console.log(`[webhook] subscription ${subscription.id} is ${subscription.status} — no plan change`)
        }
        break
      }

      /* ─── Subscription cancelled/deleted ─── */
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        // The AI Social add-on is a SEPARATE subscription — cancelling it must
        // only flip the add-on flag, NOT wipe the user's main plan.
        if (isSocialAddonSubscription(subscription)) {
          await supabase.from('profiles').update({ social_addon_active: false }).eq('stripe_customer_id', customerId)
          console.log(`[webhook] Social add-on cancelled for customer ${customerId}`)
          break
        }

        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('id, stripe_subscription_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()
        if (profErr) throw new Error(`profile lookup failed for customer ${customerId}: ${profErr.message}`)
        if (!prof) {
          console.warn(`[webhook] subscription.deleted ${subscription.id}: no profile for customer ${customerId}`)
          break
        }

        // Only the subscription ON FILE may drop the user to free (audit C3).
        // Deleting an old/replaced/duplicate one — e.g. the trial a paid plan
        // replaced, or the extra plan "Switch plan" used to create — used to
        // wipe a paying customer's plan.
        const onFile = subscriptionOnFile(prof.stripe_subscription_id, subscription.id)
        if (onFile === 'other') {
          console.log(`[webhook] subscription.deleted for ${subscription.id} ignored — ${prof.stripe_subscription_id} is on file for user ${prof.id}`)
          break
        }
        if (onFile === 'none_on_file' && (await listLiveMainSubscriptions(stripe, customerId)).length > 0) {
          console.log(`[webhook] subscription.deleted ${subscription.id} ignored — customer ${customerId} has another live plan`)
          break
        }

        const { error: delErr } = await supabase.from('profiles').update({
          subscription_status: null,
          stripe_subscription_id: null,
        }).eq('id', prof.id)
        if (delErr) throw new Error(`Failed to clear deleted subscription for customer ${customerId}: ${delErr.message}`)

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

          // maybeSingle, not single: this Stripe account is shared with Jordyn,
          // PubCoZone and others, so a renewal here can belong to a customer
          // Docs2Video has never seen. single() turned "not ours" into an
          // error and a 500, and Stripe kept retrying a payment that was never
          // ours to grant. A renewal is months after checkout, so a real
          // Docs2Video customer always has stripe_customer_id on file by now.
          const { data: renewProfile, error: fetchErr } = await supabase
            .from('profiles')
            .select('id, subscription_status')
            .eq('stripe_customer_id', customerId)
            .maybeSingle()

          if (fetchErr) {
            throw new Error(`Failed to fetch profile for credit grant, customer ${customerId}: ${fetchErr.message}`)
          }
          if (!renewProfile) {
            console.log(`[webhook] renewal for customer ${customerId} ignored — not a Docs2Video customer (shared Stripe account)`)
            break
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
              // Apex rep renewal → monthly recurring order in the Apex comp plan.
              if (r.recorded && r.affiliate?.payoutVia === 'apex') {
                const renewedPriceId = priceIdFromInvoice(invoice)
                const renewedTier = (renewedPriceId ? tierFromPriceId(renewedPriceId) : null) ?? 'unknown'
                await sendApexSaleEvent({
                  event: 'sale.renewed',
                  orderId: invoice.id,
                  affiliateCode: r.affiliate.code,
                  amountCents: invoice.amount_paid,
                  tier: renewedTier,
                  customerEmail: invoice.customer_email,
                })
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
        // Admin "What needs you" card (admin helper; never throws). Only addition here.
        await recordPaymentFailure({ customerId, invoiceId: invoice.id, amountDueCents: invoice.amount_due, attempt: invoice.attempt_count, email: invoice.customer_email })

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

          // A failure on an old/replaced subscription must not block a user
          // whose plan on file is fine (audit C3).
          const { data: pf } = await supabase
            .from('profiles').select('stripe_subscription_id').eq('stripe_customer_id', customerId).maybeSingle()
          if (subscriptionOnFile(pf?.stripe_subscription_id, failedSubId) === 'other') {
            console.warn(`[webhook] payment failed on ${failedSubId}, which is not the plan on file (${pf?.stripe_subscription_id}) — not blocking the user`)
            break
          }
        }

        // Mark user as past_due to restrict access until payment resolves
        const { error: pastDueErr } = await supabase.from('profiles').update({
          subscription_status: 'past_due',
        }).eq('stripe_customer_id', customerId)
        if (pastDueErr) throw new Error(`Failed to set past_due for customer ${customerId}: ${pastDueErr.message}`)
        console.log(`[webhook] Set subscription_status to past_due for customer ${customerId}`)
        break
      }

      /* ─── Refund / chargeback — claw back commission AND revoke credits ─── */
      case 'charge.refunded':
      case 'charge.dispute.created':
      case 'charge.dispute.funds_withdrawn': {
        // For disputes the object is a Dispute (with .charge); for refunds it's
        // a Charge. Normalize to the charge.
        const isRefund = event.type === 'charge.refunded'
        const obj = event.data.object as any
        const chargeId: string | null = isRefund ? obj.id : stripeId(obj.charge)
        if (!chargeId) {
          console.warn(`[webhook] ${event.type} ${obj?.id} has no charge — nothing to reverse`)
          break
        }
        const charge: Stripe.Charge = isRefund ? (obj as Stripe.Charge) : await stripe.charges.retrieve(chargeId)
        const paymentIntentId = stripeId(charge.payment_intent) ?? stripeId(obj.payment_intent)

        // Current Stripe API versions no longer put `invoice` on the charge
        // (audit H8) — resolve it through invoice payments.
        const invoiceId = await invoiceIdForPayment(stripe, {
          legacyInvoice: obj.invoice ?? (charge as unknown as { invoice?: unknown }).invoice,
          paymentIntentId,
        })

        // One piece per refund / dispute. Each is revoked once (its own key),
        // so a second partial refund is recorded too and a re-delivered event
        // is a no-op.
        const pieces: { key: string; amount: number }[] = []
        if (isRefund) {
          const refunds = await stripe.refunds.list({ charge: chargeId, limit: 100 })
          for (const r of refunds.data) {
            if (r.status !== 'failed' && r.status !== 'canceled' && r.amount > 0) {
              pieces.push({ key: `refund:${r.id}`, amount: r.amount })
            }
          }
        } else {
          pieces.push({ key: `dispute:${obj.id}`, amount: obj.amount ?? charge.amount })
        }
        const fullyReversed = !isRefund || (charge.amount_refunded ?? 0) >= charge.amount

        // 1) Commission clawback — only when the whole payment came back. A
        //    partial refund keeps the commission (logged for review).
        if (invoiceId && fullyReversed) {
          const clawed = await clawbackByInvoice(invoiceId)
          console.log(`[webhook] Clawed back ${clawed.length} affiliate commission(s) for ${invoiceId}`)
          // Apex rep sale refunded → reverse the order/PV/GV on the Apex side.
          for (const c of clawed) {
            if (c.payoutVia === 'apex' && c.affiliateCode) {
              await sendApexSaleEvent({
                event: 'sale.refunded',
                orderId: invoiceId,
                affiliateCode: c.affiliateCode,
                amountCents: c.amountCents,
                tier: 'unknown', // Apex resolves the order by external_ref
              })
            }
          }
        } else if (invoiceId) {
          console.warn(`[webhook] partial refund on ${invoiceId} (${charge.amount_refunded}/${charge.amount}) — commission kept, review manually if needed`)
        }

        // 2) Credits. Charges fully revoked by the OLD handler used the key
        //    revoke:{chargeId}; don't take those credits a second time.
        const { data: legacyRevoke } = await supabase
          .from('processed_stripe_events').select('event_id').eq('event_id', `revoke:${chargeId}`).maybeSingle()
        if (legacyRevoke) {
          console.log(`[webhook] credits for charge ${chargeId} were already revoked by the old handler`)
          break
        }

        let handledAsPack = false
        if (paymentIntentId) {
          const list = await stripe.checkout.sessions.list({ payment_intent: paymentIntentId, limit: 1 })
          const session = list.data[0]
          if (session?.metadata?.type === 'credit_pack') {
            handledAsPack = true
            const userId = session.metadata.supabase_user_id
            const credits = parseInt(session.metadata.credits || '0', 10)
            if (userId && credits > 0) {
              for (const p of pieces) {
                // Partial refund → partial revoke, never the whole pack.
                const n = proportionalCredits(credits, p.amount, charge.amount)
                const applied = await revokeCredits(userId, n, `revoke:${p.key}`, `${event.type} ${p.key}: -${n} credits (credit pack)`)
                if (applied) console.log(`[webhook] Revoked ${n} pack credits from user ${userId} (${p.key})`)
              }
            }
          }
        }

        if (!handledAsPack && invoiceId) {
          // A subscription payment came back: take back that payment's share
          // of the plan's credits (what's left of them — spent credits can't
          // be un-spent). The plan itself ends through the normal cancel
          // events; a refund alone doesn't cancel a Stripe subscription.
          const invoice = await stripe.invoices.retrieve(invoiceId)
          const subId = subscriptionIdFromInvoice(invoice)
          if (subId) {
            const sub = await stripe.subscriptions.retrieve(subId).catch(() => null)
            if (sub && isSocialAddonSubscription(sub)) break // the add-on grants no credits
          }
          const paidPriceId = priceIdFromInvoice(invoice)
          const tier = paidPriceId ? tierFromPriceId(paidPriceId) : null
          const invCustomer = stripeId(invoice.customer)
          if (tier && invCustomer) {
            const { data: prof } = await supabase
              .from('profiles').select('id').eq('stripe_customer_id', invCustomer).maybeSingle()
            if (prof) {
              // A renewal/first invoice paid for a whole cycle; an upgrade
              // invoice only for part of one — measure it against the plan price.
              const wholeCycle = invoice.billing_reason === 'subscription_cycle' || invoice.billing_reason === 'subscription_create'
              const denominator = wholeCycle ? charge.amount : getPlan(tier).monthlyPrice
              for (const p of pieces) {
                const n = proportionalCredits(TIER_CREDITS[tier], p.amount, denominator)
                const applied = await revokeCredits(prof.id, n, `revoke:${p.key}`, `${event.type} ${p.key}: -${n} credits (${tier} plan payment)`)
                if (applied) console.log(`[webhook] Revoked ${n} plan credits from user ${prof.id} (${p.key})`)
              }
            } else {
              console.warn(`[webhook] ${event.type} on ${invoiceId}: no profile for customer ${invCustomer}`)
            }
          }
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
    // Email Trent, naming the customer (audit 2026-10-09) — a payment that
    // could not be applied must be findable without digging through logs.
    const who = stripeEventCustomer(event)
    await alertOps({
      source: 'stripe-webhook', stage: event.type,
      message: `A Stripe payment event could not be applied for ${who}: ${message}. Stripe will retry; if it keeps failing, apply it by hand.`,
      detail: `event ${event.id} (${event.type})`,
    })
    // Release the idempotency claim so Stripe's retry actually re-runs the
    // handler (otherwise the claimed-but-unprocessed event would be skipped and
    // a paid customer would silently get nothing). Best-effort.
    await supabase.from('processed_stripe_events').delete().eq('event_id', eventId)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
