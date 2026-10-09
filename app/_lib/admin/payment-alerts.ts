import { upsertErrorLog } from '../error-logger'
import { createAdminClient } from '../supabase/admin'

/**
 * PAYMENT PROBLEMS the owner should see on "What needs you".
 *
 * Stored in the existing `error_logs` table (the admin Logs page) — no new
 * table, so nothing to migrate. Three kinds land there, told apart by
 * `endpoint`:
 *   stripe-webhook                — a Stripe message failed its signature check
 *   stripe-webhook-handler        — our handler crashed on a Stripe event
 *                                    (already recorded by the webhook's catch)
 *   stripe-webhook:payment_failed — a customer's card was declined (recorded
 *                                    by the ONE call the webhook makes below)
 * One row per customer (repeat declines bump `count`), so the card stays short.
 */
export const PAYMENT_ERROR_ENDPOINTS = ['stripe-webhook', 'stripe-webhook-handler', 'stripe-webhook:payment_failed'] as const

/** Never throws — a logging problem must never break the Stripe webhook. */
export async function recordPaymentFailure(input: {
  customerId: string | null | undefined
  invoiceId?: string | null
  amountDueCents?: number | null
  attempt?: number | null
  email?: string | null
  reason?: string | null
}): Promise<void> {
  try {
    let userId: string | null = null
    let email = input.email || null
    if (input.customerId) {
      const { data } = await createAdminClient()
        .from('profiles').select('id, email').eq('stripe_customer_id', input.customerId).maybeSingle()
      userId = data?.id ?? null
      email = email || data?.email || null
    }
    const who = email || input.customerId || 'unknown customer'
    const amount = typeof input.amountDueCents === 'number' ? `$${(input.amountDueCents / 100).toFixed(2)}` : 'a bill'
    await upsertErrorLog({
      source: 'app',
      severity: 'warning',
      endpoint: 'stripe-webhook:payment_failed',
      message: `Card payment failed for ${who}`,
      detail: [
        `Amount: ${amount}`,
        input.attempt ? `Attempt: ${input.attempt}` : null,
        input.reason ? `Reason: ${input.reason}` : null,
        input.invoiceId ? `Invoice: ${input.invoiceId}` : null,
        input.customerId ? `Customer: ${input.customerId}` : null,
      ].filter(Boolean).join('\n'),
      userId,
    })
  } catch (e) {
    console.error('[payment-alerts] could not record payment failure:', e instanceof Error ? e.message : e)
  }
}
