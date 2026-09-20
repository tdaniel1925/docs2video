# Billing & Credit System Audit — Docs2Video + Text2Art

You are auditing the COMPLETE billing and credit system for BOTH brands that share this
one codebase: **Docs2Video** (video/deck/presentation, subscription tiers) and **Text2Art**
(flyer/design image generation). Payments are **Stripe ONLY** — there is NO Paddle or any
other processor; if you find a reference to another processor, flag it as dead/wrong.

Your job: find every place money moves or credits change hands, and prove where a customer
could be **over-charged, under-charged, double-charged, charged for a failure, refunded
wrongly, or given free product** — plus any place the app's idea of a subscription/credit
balance can DRIFT from Stripe's. Read the ACTUAL code and, where safe, the ACTUAL data
(read-only). Cite file:line for every finding. This is a READ-ONLY audit — propose fixes,
change nothing. NEVER run destructive SQL against live Supabase; SELECT-only if you query.

## Ground truth to establish first (don't assume)

- The pricing tiers + limits: `app/_lib/pricing.ts` (5 tiers Free→Enterprise). The credit
  costs per action: find the single source (`credits.ts` / `pricing.ts`) — confirm there
  is ONE, not several drifting copies. Note that some accounts are GRANDFATHERED at old
  rates (e.g. costForUser reads per-user) and Text2Art (flyer) has its own per-action cost.
- Stripe config + webhook: `app/_lib/stripe.ts`, the webhook route, the Apex integration
  products (`d2v-starter/pro/business/enterprise`) that map 1:1 to tiers.
- The credit ledger: which table(s) hold balance, grants, debits, refunds; how a balance is
  computed (running sum vs a stored integer), and whether it's per-user or per-brand.

## The bug classes to hunt (each = real money)

1. CHARGED-FOR-A-FAILURE. A video/commercial/design that FAILS after credits were debited
   — is the debit refunded on every failure path (render error, VPS down, TTS fail, image
   gen fail, timeout, user cancel)? Trace each generate route: is the debit BEFORE or AFTER
   success? If before, is there a refund on EVERY throw/catch, including the ones that
   return early? (Prior bug in this repo: a non-video refund passed a string job-key into a
   uuid param and the refund was silently swallowed — check for that pattern.)

2. DOUBLE-CHARGE / DOUBLE-GRANT. Can one action debit twice (retry, double-click, a preview
   that bills then the final that bills again, an idempotency gap)? Can one Stripe event
   grant credits twice (webhook with no idempotency key, replay, checkout.session.completed
   AND invoice.paid both granting)? Check webhook idempotency + the credit-pack grant gate
   (prior bug: gated on `pack:{sessionId}` — confirm it still holds).

3. FREE PRODUCT / MISSING DEBIT. Any generate path that produces a deliverable WITHOUT
   debiting credits or checking balance first — e.g. a preview that renders a full video,
   an edit/regenerate/re-render/fix-a-scene that's free when it shouldn't be, an API/MCP
   route that bypasses the balance check, a demo/try route that a real user can hit, admin
   routes reachable by non-admins. Text2Art: does EVERY design generation (flyer-art,
   business-card, deck, edit) debit, or can some slip free?

4. BALANCE CHECK BYPASS / NEGATIVE BALANCE. Is balance checked BEFORE the expensive work
   starts (not after)? Can a user with 0 credits still trigger a render? Can concurrent
   requests each pass the check then all debit (race → negative balance)? Is the check
   server-side (never trusting a client-sent cost/quantity)?

5. SUB STATUS DRIFT (app flag vs live Stripe). The app stores subscription_status /
   tier / plan. Where can it disagree with Stripe? On: cancellation, downgrade/upgrade
   mid-cycle, past_due/dunning, payment failure, refund, chargeback, trial expiry,
   Enterprise/comp provisioning. (Prior bug: a subscription_status CHECK constraint
   REJECTED 'enterprise'/'past_due', breaking dunning + Enterprise provisioning — confirm
   the allowed values now cover every status Stripe/Apex can set.) Is there a webhook for
   EVERY relevant Stripe event, and does each update the right columns?

6. TIER LIMITS + OVERAGE. Videos/mo caps per tier — is the counter enforced, reset on the
   right cycle boundary (calendar vs billing anniversary), and does the Free trial cap (2)
   actually block the 3rd? Extra-video overage ($5 paid / $10 free) — is it charged, once,
   at the right price for the tier? Can a downgrade leave someone with more than the new
   tier allows and still generate?

7. REFUND / DISCOUNT / PROMO correctness. WELCOME50 (50% first month) — applies once, only
   to first month, can't stack or be re-applied? Refund flows — do they refund the right
   amount and reverse credits? Admin "Dismiss"/comp handling — does it grant the right
   delta without double-granting? change_plan credit delta — correct on both upgrade and
   downgrade?

8. CROSS-BRAND LEAKAGE. Docs2Video and Text2Art share the codebase + likely the credit
   pool. Confirm: is it ONE shared balance or per-brand? Can a Text2Art user consume
   Docs2Video-priced credits or vice versa in a way that mis-prices? Do the two brands'
   costs read from the same source, and is that intended?

9. IDOR / AUTH on money endpoints. Can user A trigger a debit/refund/checkout/credit-grant
   on user B's account? Are all billing/credit/admin routes owner-checked and
   admin-gated? (This repo has had IDOR bugs — check every billing/credit/webhook/admin
   route.)

10. LEDGER INTEGRITY. Does every debit/grant/refund write an audit row (admin_audit_log /
    credit ledger)? Can balance be derived and RECONCILED against the ledger? Is there a
    reconcile cron, and does it actually run + catch drift? Any place a balance is mutated
    WITHOUT a ledger row (silent adjustment)?

## Method

- Enumerate EVERY route/function that: checks balance, debits, grants, refunds, creates a
  Stripe checkout/subscription, or handles a Stripe/Apex webhook. Build the list first.
- For each generate path (video, slides, presentation, commercial, flyer/design,
  business-card, deck, editorial/V3, MCP, v1 API), trace: balance check → debit → do work
  → on-success / on-EVERY-failure. Mark where the order is wrong or a failure path skips
  the refund.
- For the webhook, list every Stripe event handled and every DB column it writes; flag
  events NOT handled that should be, and any non-idempotent grant.
- Where you can, do a read-only live check (Stripe test mode or a SELECT on the ledger) to
  confirm balance == sum(ledger) for a sample user, and app tier == Stripe tier. Say
  clearly when a finding is code-only vs confirmed against live data.
- Anti-false-green: a refund function that EXISTS is not proof it's CALLED on the failure
  path — show the call site. A balance check that exists is not proof it runs BEFORE the
  spend — show the order.

## Deliverable

1. A MAP: every money-touching route/function (file:line) → what it does (check/debit/
   grant/refund/checkout/webhook) → brand(s) it serves.
2. RANKED findings, worst first, each tagged: **LOSES REVENUE** (free product, missing
   debit, un-refunded... wait, that's customer-favor) vs **OVERCHARGES CUSTOMER** (double
   debit, charge-on-failure, wrong overage) vs **DRIFT/INTEGRITY** (status mismatch, ledger
   gap) vs **SECURITY** (IDOR/auth). For each: the exact code path, why it's wrong, the
   minimal fix, and whether it's confirmed in code only or against live data.
3. One clear line per bug class: "SAFE / BROKEN / PARTIAL, because …" with file:line.
4. A short "reconcile now" section: any user whose app balance/tier currently disagrees
   with the ledger or Stripe (if you were able to check live), and the SQL/steps to fix it
   (proposed, NOT executed).
5. The 3 fixes that most protect revenue, and the 3 that most protect the customer.
