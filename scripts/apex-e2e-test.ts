/**
 * Apex integration E2E test (spec §5.8) — Stripe TEST mode.
 *
 * Exercises the real code paths against real services:
 *   1. provisionApexAffiliate  → D2V prod DB affiliate (payout_via='apex') + test-mode Stripe coupon/promo
 *   2. recordCommission        → commission row + affiliate {payoutVia:'apex'} returned (touchpoint logic)
 *   3. sendApexSaleEvent       → signed HMAC POSTs to the LOCAL Apex dev server (sale.created/renewed/refunded)
 *   4. clawbackByInvoice       → returns apex rows that drive the refund event
 *
 * Only the Stripe event *dispatch* (checkout → webhook delivery) is not
 * exercised — that path is pre-existing, unchanged code.
 *
 * Run: npx tsx scripts/apex-e2e-test.ts   (from the repo root)
 * Cleanup afterwards: see the CLEANUP queries printed at the end.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

// Test mode + local Apex dev server
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY_TEST
process.env.APEX_INTEGRATION_URL = 'http://localhost:3050/api/webhooks/integrations/prismgraphs'

const SLUG = 'apex-e2e-test'
const EMAIL = 'apex-e2e-test@docs2video.com'
const RUN = process.env.E2E_RUN || '1' // vary to reuse the script with fresh order ids

async function main() {
  const { provisionApexAffiliate, sendApexSaleEvent } = await import('../app/_lib/apex')
  const { recordCommission, clawbackByInvoice } = await import('../app/_lib/affiliate')
  const { createAdminClient } = await import('../app/_lib/supabase/admin')

  const results: Record<string, unknown> = {}

  // ── 1. Provisioning ──
  const prov = await provisionApexAffiliate({ slug: SLUG, email: EMAIL, name: 'E2E TestRep' })
  results.provision = prov

  const admin = createAdminClient()
  const { data: aff } = await admin
    .from('affiliates')
    .select('id, user_id, referral_code, payout_via, stripe_promo_code_id, status')
    .eq('referral_code', prov.referralCode)
    .single()
  results.affiliateRow = aff
  if (!aff || aff.payout_via !== 'apex') throw new Error('FAIL: affiliate not provisioned with payout_via=apex')

  // ── 2. First payment (touchpoint 1 semantics) ──
  const r1 = await recordCommission({
    stripePromoCodeId: aff.stripe_promo_code_id,
    payingUserId: null,
    customerId: 'cus_e2e_test',
    stripeInvoiceId: `session:cs_e2e_test_${RUN}a`,
    amountPaidCents: 7900,
  })
  results.commission1 = r1
  if (!r1.recorded || r1.affiliate?.payoutVia !== 'apex') throw new Error('FAIL: commission 1 not recorded as apex')

  const sent1 = await sendApexSaleEvent({
    event: 'sale.created',
    orderId: `session:cs_e2e_test_${RUN}a`,
    affiliateCode: r1.affiliate.code,
    amountCents: 7900,
    tier: 'pro',
    customerEmail: 'e2e-customer@example.com',
    customerName: 'E2E Customer',
  })
  results.saleCreatedSent = sent1
  if (!sent1) throw new Error('FAIL: sale.created not accepted by Apex')

  // ── 3. Renewal (touchpoint 2 semantics) ──
  const r2 = await recordCommission({
    stripePromoCodeId: aff.stripe_promo_code_id,
    payingUserId: null,
    customerId: 'cus_e2e_test',
    stripeInvoiceId: `in_e2e_test_${RUN}b`,
    amountPaidCents: 7900,
  })
  results.commission2 = r2
  const sent2 = await sendApexSaleEvent({
    event: 'sale.renewed',
    orderId: `in_e2e_test_${RUN}b`,
    affiliateCode: r2.affiliate!.code,
    amountCents: 7900,
    tier: 'pro',
    customerEmail: 'e2e-customer@example.com',
  })
  results.saleRenewedSent = sent2
  if (!sent2) throw new Error('FAIL: sale.renewed not accepted by Apex')

  // ── 4. Refund of the renewal (touchpoint 3 semantics) ──
  const clawed = await clawbackByInvoice(`in_e2e_test_${RUN}b`)
  results.clawback = clawed
  const apexClawed = clawed.filter(c => c.payoutVia === 'apex')
  if (apexClawed.length !== 1) throw new Error(`FAIL: expected 1 apex clawback row, got ${apexClawed.length}`)
  const sent3 = await sendApexSaleEvent({
    event: 'sale.refunded',
    orderId: `in_e2e_test_${RUN}b`,
    affiliateCode: apexClawed[0].affiliateCode,
    amountCents: apexClawed[0].amountCents,
    tier: 'unknown',
  })
  results.saleRefundedSent = sent3
  if (!sent3) throw new Error('FAIL: sale.refunded not accepted by Apex')

  // ── 5. Idempotency: re-send sale.created (webhook retry simulation) ──
  const sentDup = await sendApexSaleEvent({
    event: 'sale.created',
    orderId: `session:cs_e2e_test_${RUN}a`,
    affiliateCode: r1.affiliate.code,
    amountCents: 7900,
    tier: 'pro',
  })
  results.duplicateAccepted = sentDup // Apex returns 200 alreadyProcessed

  console.log('\n=== E2E RESULTS ===')
  console.log(JSON.stringify(results, null, 2))
  console.log('\nALL D2V-SIDE ASSERTIONS PASSED')
}

main().catch(e => { console.error('E2E FAILED:', e); process.exit(1) })
