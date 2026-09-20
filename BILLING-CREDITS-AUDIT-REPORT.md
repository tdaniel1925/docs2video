All verdicts confirmed against source. Here is the final report.

---

# Billing & Credit Audit — Final Report (Docs2Video + Flyer, shared wallet)

**Scope:** `C:/dev/1 - PrismGraphs`, read-only. Payments verified as **Stripe only** — no other processor present (`pricing.ts`, `webhooks/stripe/route.ts`). Balance model is **hybrid per-user**: authoritative integers in `credit_balances` (monthly `balance` + purchased `topup_balance`), with `credit_transactions` as an append-only audit ledger (not summed to derive balance). `profiles.credits_remaining` is a dead legacy column the code refuses to read (`credits.ts:376`). Single cost source of truth: `CREDIT_COSTS` map, read via `getCreditCost`/`costForUser` (`credits.ts:14-84`).

---

## 1. MAP — money-touching routes → kind → brand(s)

| File:line | Route / fn | Kind | Brand(s) |
|---|---|---|---|
| credits.ts:148 / 199 / 243 | getBalance / checkCredits / deductCredits | check / check / debit | shared |
| credits.ts:408 / 493 / 567 | grantMonthlyCredits / applyTierChange / addTopupCredits | grant | shared |
| credits.ts:605 | refundVideoCredits (idempotent, `refund:video:{id}`) | refund | shared |
| credits.ts:666 / 79 | calculateVideoCost / costForUser (grandfathered) | cost calc | Docs2Video |
| credits.ts:740 | endTrialIfDepleted | subscription | shared |
| generate-video/route.ts:357 | POST /generate-video (gates on `deducted`, refunds on fail) | debit | Docs2Video |
| **generate-slides/route.ts:25-108** | POST /generate-slides | **NO CHARGE** | Docs2Video |
| generate-presentation/route.ts:127 | POST /generate-presentation | debit (return ignored) | Docs2Video |
| generate-commercial/route.ts:51 | POST /generate-commercial | debit + refund | Docs2Video |
| generate-pptx/route.ts:64 | POST /generate-pptx | debit (no refund on fail) | Docs2Video |
| generate-pdf/route.ts:63 | POST /generate-pdf | debit (no refund on fail) | Docs2Video |
| generate-business-card/route.ts:69 | POST /generate-business-card | debit (no refund on fail) | Flyer/D2V |
| brand-kit/route.ts:129 | POST /brand-kit | debit (no refund on empty) | Docs2Video |
| generate-headshot/route.ts:115 | POST /generate-headshot | debit + partial refund | Docs2Video |
| deck-builder/route.ts:83 / 155 | POST /deck-builder | check-before / deduct-after | Docs2Video |
| generate-deck/route.ts:62 | POST /generate-deck (correct up-front gate) | debit | Docs2Video |
| social-media/post/route.ts:68 / 100 | POST /social-media/post | debit / negative-refund | AI Social |
| flyer-art:111 / flyer-edit:91 | POST /flyer-art, /flyer-edit | debit ('flyer' unit) | Flyer |
| presentation-export-video:47 / reedit-presentation:87 | export / re-edit | debit | Docs2Video |
| v1/videos:138 · v1/presentations:98 · v1/commercials:21 | API v1 (passthrough to real debit) | debit | API v1 |
| credits/balance:21 · v1/credits:10 · mcp get_credits | read wallet | check | shared / MCP |
| webhooks/stripe/route.ts:227/324/366 | subscription provisioning + credit grants | grant/subscription | shared |

---

## 2. RANKED FINDINGS (confirmed verdicts only, worst-first)

### P0 — LOSES-REVENUE: `/generate-slides` produces a full slide video with **no balance check and no debit**
`app/api/generate-slides/route.ts:25-108`. The route authenticates (line 27), inserts a `videos` row (71), health-checks the VPS (84), and fires the render (94) — **zero** checkCredits/deductCredits/calculateVideoCost anywhere. No `x-internal-service` gate (unlike generate-presentation). Any authenticated user gets unlimited free slide videos. The *paid* slide path is `generate-video/route.ts:357`; this standalone route bypasses it.
**Fix:** add `checkCredits` + gated `deductCredits(user.id, calculateVideoCost(..., user.id), 'video_generation', videoId)` before line 94, and refund via `refundVideoCredits` in the VPS-trigger catch (102). If orphaned, gate behind `x-internal-service`.

### P0 — LOSES-REVENUE: Starter Stripe webhooks 500 and retry forever
`supabase/legacy/supabase-fix-subscription-status-check.sql:24-38`. The committed `subscription_status` CHECK omits `'starter'`, yet `'starter'` is a real tier written raw to that column by all three subscription paths (`route.ts:227/324/366`). A Starter UPDATE hits Postgres 23514 → handler 500s → idempotency claim released (route.ts:659) → Stripe retries forever → **paid Starter customer never provisioned, gets no credits**. This file (2026-06-26) is the latest CHECK-touching migration. *Conditional on it being the last such migration run in prod.*
**Fix:** `ALTER … DROP CONSTRAINT … ADD CONSTRAINT … CHECK (... 'starter' ...)`. Verify against live prod before assuming applied.

### P1 — LOSES-REVENUE: `/generate-presentation` ignores the deduct result
`app/api/generate-presentation/route.ts:127`. Non-atomic `checkCredits` at 123, then `await deductCredits(...)` at 127 with the boolean **discarded**. deductCredits returns false on insufficient balance, hard DB error, and CAS-contention give-up (credits.ts:319/349/356) — yet control falls into generation (136) and ships a full-price (700 interactive / deck) artifact for free. Two concurrent requests both pass 123; the CAS loser still gets the product. Sibling routes gate correctly (generate-video:357, generate-deck:62).
**Fix:** `const deducted = await deductCredits(...); if (!deducted) return 402`.

### P1 — OVERCHARGES-CUSTOMER: `/generate-pptx` charges 800 then never refunds on failure
`route.ts:64` debit inside try; catch (305-316) sets status=failed, returns 500, **no refund**. Any throw ("No script/scenes" 79, per-slide 208, generatePptx, storage upload 272) keeps the 800-credit charge.
**Fix:** in the catch, `await refundVideoCredits(user.id, CREDIT_COSTS.pptx, videoId)`.

### P1 — OVERCHARGES-CUSTOMER: `/generate-pdf` charges 600 then never refunds on failure
`route.ts:63` debit; catch (288-299) no refund. Identical shape to pptx.
**Fix:** refund in catch (same pattern).

### P1 — OVERCHARGES-CUSTOMER: `/generate-business-card` charges 200 before gen, no refund on image failure
`route.ts:69` debit before any generation; failure returns 500 at 187 (front) and 265 (back), neither refunds; Gemini calls at 164/242 are unguarded (a throw 500s with charge kept).
**Fix:** wrap gen in try/catch; refund via `addTopupCredits(user.id, COST, 'refund:card:'+id, {action:'refund_card', videoId:null})` on any non-delivery (mirror headshot's NULL-video_id pattern).

### P1 — OVERCHARGES-CUSTOMER: `/brand-kit` charges 400, can return zero images with no refund
`route.ts:129` debit; the generate loop swallows every per-image failure (catch 310-312 logs only) and returns `{images}` at 318 even when empty. Same in refine (500 at 371) and generate-assets (693). No refund call in the file.
**Fix:** if `images.length===0`, refund the 400 and return an error instead of 200-empty.

### P2 — LOSES-REVENUE: `/deck-builder` deducts *after* success and ships on deduct failure
`route.ts:83` check, then `deductCredits` at 155; line 156 only console.errors on false and execution continues to return `{downloadUrl}` at 175. A balance race (N requests passing the same non-atomic check) or a CAS/deduct failure yields a free deck — fail-open.
**Fix:** deduct up front like its sibling generate-deck (62-69); or at minimum fail closed (do not return downloadUrl when deduct returns false).

### P2 — LOSES-REVENUE: `/social-media/post` refund is an unguarded negative deduct → retry double-refunds
`route.ts:100` refunds via `deductCredits(user.id, -totalCost, ...)`; credits.ts:319 check never trips on negatives and the CAS math correctly *adds* credits — but there is **no idempotency key**. If the catch runs twice (retry/re-invoke) the user is credited twice. Contrast the guarded `refundVideoCredits` (credits.ts:626-632, UNIQUE-index de-dupe).
**Fix:** route this refund through `addTopupCredits` with an `idempotencyKey` (e.g. `refund:social_post:{postAttemptId}`).

### P2 — OVERCHARGES-CUSTOMER (PARTIAL): `/generate-headshot` outer catch keeps 400 on throw
`route.ts:115` debit; the `images.length===0` branch (166-180) refunds correctly (NULL video_id + string idempotency key). But the **outer catch (194-197) returns 500 with no refund**, reachable if the storage loop or creations insert throws. `generateVariation` swallows its own errors (83-86), so the common all-fail case is caught by the refunding branch — hence PARTIAL.
**Fix:** refund in the outer catch behind an `alreadyRefunded` flag.

### P2 — LOSES-REVENUE (PARTIAL): subscription refund/chargeback doesn't downgrade or revoke credits
`webhooks/stripe/route.ts:584-647`. The refund/dispute handler only claws back affiliate commission (594) and revokes credits **only** when `metadata.type==='credit_pack'` (626-641). A refund on a *subscription* invoice matches neither branch → status and monthly credits untouched → refunded account keeps generating at paid tier. Mitigated because disputes usually also fire `customer.subscription.deleted` (439-442, clears status), so only a standalone refund-without-cancel leaks.
**Fix:** on subscription-mode refund/dispute, resolve the subscription and clear `subscription_status` + revoke that cycle's monthly grant.

---

## 3. One line per bug class

- **Missing/misordered charge in generation routes:** **BROKEN** — generate-slides is entirely free (`generate-slides/route.ts:25-108`); pptx/pdf/business-card/brand-kit charge-then-keep on failure; deck-builder is deduct-after fail-open (`deck-builder/route.ts:155`).
- **Credit-deduction result honoring:** **BROKEN** — generate-presentation discards the deduct boolean (`generate-presentation/route.ts:127`); generate-video/deck gate correctly.
- **Stripe webhook provisioning:** **BROKEN** — Starter tier violates the `subscription_status` CHECK (`supabase/legacy/supabase-fix-subscription-status-check.sql:24-38`).
- **Subscription refund/chargeback handling:** **PARTIAL** — no downgrade on standalone refund (`webhooks/stripe/route.ts:584-647`).
- **Refund idempotency:** **PARTIAL** — video refunds are guarded (`credits.ts:626`); social-media/post negative refund is not (`social-media/post/route.ts:100`).
- **Promo-code enforcement (WELCOME50):** **SAFE** — eligibility correctly delegated to Stripe's promotion_code restrictions (`stripe/checkout/route.ts:92-102`); no mis-charging path in code.
- **Cost source of truth:** **PARTIAL (DRIFT)** — canonical map is honored by most routes, but several hardcode magic numbers (see §5 drift note).

---

## 4. "Reconcile now" — where app state can disagree, and SELECT-only checks (proposed, NOT executed)

**A. Paid-but-unprovisioned Starter customers (P0).** Stripe shows an active Starter subscription; app never wrote status/credits because the webhook 500'd.
```sql
-- Accounts with a Stripe subscription id but a status that never became a paid tier
SELECT id, email, subscription_status, stripe_subscription_id
FROM profiles
WHERE stripe_subscription_id IS NOT NULL
  AND (subscription_status IS NULL OR subscription_status IN ('free','trial'));
```
Cross-reference each `stripe_subscription_id` against Stripe (dashboard/API) for a live Starter sub. Also confirm they have a `credit_balances` row at the Starter grant.

**B. Free product shipped, no ledger debit (generate-slides / presentation race / deck-builder).** Delivered artifact with no matching negative `credit_transactions` row.
```sql
-- Completed videos with no debit ledger row (slide videos never charged)
SELECT v.id, v.user_id, v.title, v.created_at
FROM videos v
LEFT JOIN credit_transactions t
  ON t.video_id = v.id AND t.amount < 0
WHERE v.status = 'complete'
  AND t.id IS NULL
ORDER BY v.created_at DESC;
```

**C. Charged-but-failed with no refund (pptx/pdf/business-card/brand-kit).** Debit exists, product failed, no offsetting positive refund row.
```sql
SELECT v.id, v.user_id, t.amount AS charged, t.action
FROM videos v
JOIN credit_transactions t
  ON t.video_id = v.id AND t.amount < 0
LEFT JOIN credit_transactions r
  ON r.video_id = v.id AND r.amount > 0
WHERE v.status = 'failed'
  AND r.id IS NULL
  AND t.action IN ('pptx','pdf','business-card','brand-kit');
```

**D. Double refunds (social-media/post).** Two positive refund rows for one charge.
```sql
SELECT user_id, COUNT(*) AS refund_rows, SUM(amount) AS refunded
FROM credit_transactions
WHERE action = 'social_post_refund'
GROUP BY user_id, description
HAVING COUNT(*) > 1;
```

**E. Refunded-but-still-active subscriptions (P2).** Stripe refund/dispute with app still at paid tier.
```sql
SELECT id, email, subscription_status, stripe_subscription_id
FROM profiles
WHERE subscription_status IN ('starter','pro','professional','business','enterprise','active','unlimited','agency');
```
Cross-reference each against Stripe for a `charge.refunded`/dispute with no matching `subscription.deleted`.

**Thin-data flags:** items A and E cannot be closed from the repo alone — they require reconciling against the **live Stripe** subscription/charge objects, which are not in the codebase. Do not assume SAFE without that cross-check. The `credit_balances` vs `credit_transactions` split means a "balance is correct" claim also needs a per-user replay of the ledger, not just a row read.

---

## 5. Top fixes

**Most protect REVENUE**
1. **Gate or delete `/generate-slides`** (`generate-slides/route.ts:94`) — charge + refund-on-fail, or `x-internal-service` gate. Closes unlimited free videos.
2. **Fix the Starter CHECK constraint** (`supabase/legacy/supabase-fix-subscription-status-check.sql:24-38`) — every Starter sale is currently unprovisioned revenue.
3. **Honor the deduct result in `/generate-presentation`** (`route.ts:127`) — `if (!deducted) return 402`, ending free presentations under races/deduct failures. (Sibling: make deck-builder deduct up front, `route.ts:155`.)

**Most protect the CUSTOMER**
1. **Refund on failure in `/generate-pptx` and `/generate-pdf`** (catches at 305-316 / 288-299) — stop keeping 800/600 credits for undelivered files.
2. **Refund on failure/empty in `/generate-business-card` and `/brand-kit`** (`route.ts:69`, `route.ts:129`) — stop keeping 200/400 credits when zero images ship.
3. **Add an idempotency key to the `/social-media/post` refund** (`route.ts:100`) — prevent retry double-refunds (protects both sides; here it protects ledger integrity for the customer's history).

**Drift note (DRIFT, not billed-wrong but off-map):** several routes hardcode credit numbers instead of `CREDIT_COSTS`: `social-generate:41` (50), `social-campaign:133` (posts.length), `generate-ads:180` (results.length), `generate-brand-deck:163` (1), `generate-email-signature:360` (1), and the flat `checkCredits(…, 1)` gates in extract / extract-text / extract-url / generate-from-idea. These won't move when the map changes — fold them into `CREDIT_COSTS` to keep one source of truth.