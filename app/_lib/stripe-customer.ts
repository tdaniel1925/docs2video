import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The ONE way to get a signed-in user's Stripe customer (inline billing,
 * 2026-10-14). Every in-app payment (plans, packs, add-on, saving a card) needs
 * the customer BEFORE the payment form opens, because the form is Stripe's
 * Payment Element inside our own page — there is no Stripe-hosted page that
 * would create one for us any more.
 *
 *  - Reuses profiles.stripe_customer_id when Stripe still knows it.
 *  - A stale id (deleted customer, or a test-mode id on a live key) is
 *    replaced instead of breaking checkout.
 *  - A new customer is only written if the slot is still empty, so two clicks
 *    racing can't leave the profile pointing at the loser's customer.
 *
 * The Stripe account is shared with other apps (Jordyn, Apex, VidWiz,
 * PubCoZone). Customers made here carry supabase_user_id metadata; the webhook
 * keeps ignoring customers it has never seen.
 */
export async function ensureStripeCustomer(
  admin: SupabaseClient,
  stripe: Stripe,
  user: { id: string; email?: string | null; name?: string | null },
): Promise<string> {
  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_customer_id, email, full_name')
    .eq('id', user.id)
    .maybeSingle()
  const existing = (profile?.stripe_customer_id as string | null | undefined) ?? null

  if (existing) {
    try {
      const c = await stripe.customers.retrieve(existing)
      if (!(c as { deleted?: boolean }).deleted) return existing
      console.warn(`[stripe-customer] customer ${existing} for user ${user.id} was deleted — making a new one`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (!/No such customer/i.test(msg)) throw err
      console.warn(`[stripe-customer] stale stripe_customer_id for user ${user.id} — making a new one`)
    }
    // Clear the dead id so the claim below can take the slot.
    await admin.from('profiles').update({ stripe_customer_id: null }).eq('id', user.id).eq('stripe_customer_id', existing)
  }

  const customer = await stripe.customers.create({
    email: (profile?.email as string | null) ?? user.email ?? undefined,
    name: (profile?.full_name as string | null) ?? user.name ?? undefined,
    metadata: { supabase_user_id: user.id },
  })
  const { data: claimed } = await admin
    .from('profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('id', user.id)
    .is('stripe_customer_id', null)
    .select('stripe_customer_id')
  if (claimed && claimed.length > 0) return customer.id

  // A parallel request won the slot — use theirs.
  const { data: again } = await admin.from('profiles').select('stripe_customer_id').eq('id', user.id).maybeSingle()
  return (again?.stripe_customer_id as string | null) || customer.id
}

/**
 * Where Stripe returns the buyer IF a payment method needs a trip to the
 * bank's own page (a few wallets and bank redirects do; cards and Apple/Google
 * Pay finish inside the app). It's our own Billing page, which picks the
 * session up and finishes there.
 */
export function inlineReturnUrl(origin: string): string {
  return `${origin}/settings?tab=billing&checkout={CHECKOUT_SESSION_ID}`
}

/** Fields every in-app Checkout Session shares. Never `payment_method_types`
 *  (Stripe picks the methods from the dashboard settings — cards, Apple Pay,
 *  Google Pay, Link …). `ui_mode: 'elements'` = Stripe's Payment Element in
 *  OUR page ("custom" before the 2026-04 "dahlia" API). */
export function inlineSessionBase(origin: string) {
  return {
    ui_mode: 'elements' as const,
    return_url: inlineReturnUrl(origin),
    // Cards the customer saved before (the trial card, an earlier purchase)
    // are offered in the form, so a returning buyer doesn't retype a card.
    saved_payment_method_options: { allow_redisplay_filters: ['always', 'limited', 'unspecified'] as Array<'always' | 'limited' | 'unspecified'> },
  }
}
