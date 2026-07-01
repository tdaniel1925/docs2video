# Docs2Video — Full Codebase Review
**Date:** 2026-07-01 · **Method:** 5 parallel deep-read reviews (architecture, security, money paths, render pipeline, quality/perf/testing), synthesized. All findings cite real code read during review. Severity: Critical / High / Medium / Low.

---

## 1. Architecture & Structure

### The system in words
1. **Wizard** (`app/(dashboard)/create/`): upload/paste/URL → extraction (heavy docs proxied to VPS `/extract-document`) → brand → **brief** (approvable AI framing, `/api/brief`) → theme (live stills via VPS `/preview-editorial`) → voice → `POST /api/generate-video` → polling on the `videos` row → player page.
2. **State machine** lives in `videos.status` (`draft → scripting → generating_audio → assembling → completed/failed/review_required`), advanced by **four different actors**: the Next.js route, the VPS (direct DB writes with the service key), the Lambda poller, and crons.
3. **Orchestrator** — `app/api/generate-video/route.ts` (1,156 lines, one POST): auth (3 schemes) → rate limit → credit deduction → compare-and-set claim → script gen (grounded by the approved brief) → insurance compliance gates → dispatch to **one of six render paths**.
4. **Renderers** — `vps/server.js` (2,167-line Express monolith in Docker on Hetzner: `/generate` classic, `/render-v3` cinematic/aurora/infographic, `/render-editorial` magazine, plus extract/convert/logo/selftest) and `app/_lib/v3-lambda.ts` (Remotion Lambda alternative). All VPS renders ACK immediately and work in the background; completion is written straight to the DB. No callback — a cron (`fix-stuck-videos`) reconciles by checking for the MP4.
5. **Consumption** — `/videos/[id]` (2,368-line client page) and public `/watch/[id]` (1,693 lines).

### Assessment
The seams that are clean: payload builders (`buildV3Payload`, `buildEditorialPayload`) as typed app→renderer contracts; `credits.ts` centralizing all money; DB-backed `app_settings` flags (engine/target flips without redeploy). The seams that are blurred: **six live-ish render paths plus two fossils**, render logic duplicated in TS (Lambda) and JS (VPS) and **already drifted** (Lambda hardcodes a "Modern Fintech" theme, ignores `payload.theme`, has no closing card/presenter/slide-panel data — the admin render-target toggle silently changes what videos *look like*, `v3-lambda.ts:202`), and a state machine with four writers and no owner. The branching is at the edge of manageable and will not survive another engine.

| # | Severity | Finding | Location | Fix |
|---|----------|---------|----------|-----|
| A1 | High | Lambda path is a drifted reimplementation of the VPS render (theme hardcoded, no infographic/aurora/closing/presenter/slide panel) | `app/_lib/v3-lambda.ts:48–275` vs `vps/server.js:976–1360` | One shared scene-composition module; renderers become dumb executors |
| A2 | High | `generate-video/route.ts` god-function: billing + compliance + prompt engineering + 4 dispatchers in one 1,050-line handler | `app/api/generate-video/route.ts` | Extract `prepareScenes()`, `applyComplianceGates()`, pipeline resolver lookup |
| A3 | High | `video-service/` is a stale duplicate render server (second `server.js`, 838 lines, last touched 2026-05-19) still in-tree — also carries the committed secret (S1) | `video-service/` | Delete (git history preserves it) |
| A4 | Medium | Slide prompts built unconditionally (~200 lines of Gemini prompt work) but only the legacy classic path reads them | `generate-video/route.ts:689–888` vs branches `:931–1049` | Move prompt building inside the classic branch |
| A5 | Medium | Dead subsystems wired into live code: Creatomate pipeline-v2 (flag OFF, imported by live cron), unreachable infographic heuristic (`return 'cinematic'` above dead code) | `app/_lib/creatomate.ts`, `v3-render.ts:52`, `inngest/render-video.ts` | Delete or quarantine under `_lib/experimental/` |
| A6 | Medium | Four actors write `videos` rows with an implicit, unversioned contract (exact class of the migration-drift bugs) | `vps/server.js:1349`, `v3-lambda.ts:271`, crons, routes | Single `videoLifecycle` module; VPS reports completion via one app endpoint |
| A7 | Medium | Re-render posts to classic `/assemble` — can't faithfully rebuild V3/editorial videos (degraded artifact) | `app/api/re-render/route.ts:102` | Route re-render through the same pipeline resolver |
| A8 | Medium | Three config surfaces for the VPS URL, incl. a hardcoded plaintext-HTTP IP fallback | `_lib/video-service.ts:8`, `generate-video/route.ts:33`, `env.ts` | Everything through `videoServiceUrl()`; hard-fail in prod instead of IP fallback |
| A9 | Medium | BUILD-STATE.md (the mandated source of truth per CLAUDE.md) is a month stale — predates V3/Lambda/editorial/aurora entirely | `BUILD-STATE.md:3` | Regenerate; drop the stats that rot |
| A10 | Low | 118 `app/api/` directories incl. an unlinked-but-reachable "tools" family (flyers, headshots, business cards…) | `app/api/generate-*` | Kill-or-keep decision per feature; unlinked ≠ gone |

**Genuinely good:** money-handling discipline (CAS claim against double-charge `route.ts:242`, `failAndRefund` on every post-deduction exit, `deducted_cost` persisted for exact cron refunds); ACK-timeout treated as "maybe-queued" instead of refund-then-free-video; the payload-builder seam; observability that grew in the right direction (honest `/health`, `/selftest`, frame-progress streaming, Lambda watchdog); comments that cite the audit item or incident that motivated each guard.

---

## 2. Bugs & Correctness (money paths + render pipeline)

### Critical
| # | Severity | Finding | Location | Fix |
|---|----------|---------|----------|-----|
| B1 | **Critical** | **VPS background render failures never refund — and the error message claims they did.** After the early ACK, a failed render writes `status:'failed'` + *"Your credits were refunded."* Nothing refunds; the cron only sweeps in-progress rows, never `'failed'` ones. Customers are charged for failures while being told otherwise. | `vps/server.js:1363, 1613, 2119`; `app/api/cron/fix-stuck-videos/route.ts:16,62` | Cron also sweeps `status='failed'` with `deducted_cost>0` and no refund ledger row (idempotent), or VPS posts a failure callback |
| B2 | **Critical** | **`/render-v3` uses a shared props file (`pub/v3.json`) and no `--props` flag.** Two concurrent renders clobber each other → **video A renders video B's content** (cross-tenant leak), and a silent `staticFile` fetch failure renders placeholder defaultProps as a "completed" video — the exact documented "Run the generator first" bug class, fixed for editorial but not v3. | `vps/server.js:1250–1252`; `remotion/src/Root.tsx:186–197` | Per-video `r3-${videoId}-props.json` + `--props=` (editorial's pattern) |
| B3 | **Critical** | **Social add-on webhook events hijack the main plan.** The `social_addon` guard is missing from `subscription.created/updated` and `invoice.payment_failed`. Addon price isn't in `SUBSCRIPTION_PRICES` → tier falls back `?? 'pro'` → a free user buying the $50 add-on becomes Pro with 25,000 credits, and `stripe_subscription_id` is overwritten with the addon sub. A failed $50 addon invoice flips the whole account `past_due`. | `app/api/webhooks/stripe/route.ts:200, 232, 397` (guard exists only at `:145, :311`) | Early-exit on `subscription.metadata?.type === 'social_addon'` in all handlers; resolve invoice's sub metadata in payment_failed |

### High
| # | Severity | Finding | Location | Fix |
|---|----------|---------|----------|-----|
| B4 | High | Refund idempotency key is `refund:video:{videoId}` — once per video **forever**. Videos are retryable; the second legitimate refund is silently swallowed as a duplicate. | `app/_lib/credits.ts:518–532` | Version the key per charge (include deduction ledger id) or clear the marker on re-charge |
| B5 | High | No ownership check on `videoId` in generate-video (claim doesn't verify `user_id`). One charge can be refunded into **two different wallets** (cron refunds `video.user_id`, `failAndRefund` refunds the requester). | `app/api/generate-video/route.ts:242–254, 338, 353` | Add `.eq('user_id', user.id)` to the claim |
| B6 | High | Migration drift landmine: `videos.prompt_versions` doesn't exist in prod, and it's bundled into the update that persists `script` + advances status → **the whole update 400s silently**; script never saved, row stuck at `'scripting'`, cron may refund while the render completes. | `generate-video/route.ts:525, 559`; unrun `supabase/migrations/20260523_add_prompt_versioning.sql` | Run the migration or drop the column from those updates; check the error |
| B7 | High | **New regression from today's commit `0028ee9`:** parallel TTS fan-out can trip ElevenLabs concurrency limits (429) → per-scene silent fallback to OpenAI `nova` → **one video with two alternating narrator voices**. Serial code never hit this. | `vps/server.js:1129–1143, 1476–1498`; `ttsToBuffer:938–952` | Bounded pool (3–4) for TTS; retry ElevenLabs with backoff before falling back |
| B8 | High | **Second regression from `0028ee9`:** one TTS rejection rejects `Promise.all` → cleanup runs → sibling Gemini/TTS promises finish *after* cleanup and leak assets into `remotion/public` forever (copied into every future bundle → disk growth + slower renders for everyone). | `vps/server.js:1129, 1476` | `Promise.allSettled` + cleanup after settle, or shared AbortSignal |
| B9 | High | No render queue on the VPS: each request spawns its own `--concurrency=12` Chrome fleet. Two concurrent renders = 24 tabs + STILL_POOL on a box that crashed at 16 tabs. | `vps/server.js` (all render endpoints) | In-process FIFO/semaphore (jobs are async-ACKed; queueing is invisible) |
| B10 | High | Lambda orchestration can outlive the Vercel function: `maxDuration=300` but serial asset gen + 12-min poll cap → 8-scene jobs killed mid-poll; refund fires while the MP4 quietly completes in S3. | `route.ts:37`; `v3-lambda.ts:147–181, 241` | Raise maxDuration / move off-request; parallelize Lambda asset gen like the VPS |

### Medium
| # | Severity | Finding | Location | Fix |
|---|----------|---------|----------|-----|
| B11 | Medium | Resubscribe within ~25 days grants **zero** credits (cycle guard) — pays full price, gets nothing | `credits.ts:387–395` | Force-grant on a new Stripe subscription id |
| B12 | Medium | Dunning recovery grants **free-tier** credits: tier derived from the `past_due` flag → paying customer reset to 2,000 credits | `webhooks/stripe/route.ts:334–359`; `pricing.ts:151–160` | Derive tier from the invoice line's price id |
| B13 | Medium | Non-atomic read-modify-write in `applyTierChange`/`grantMonthlyCredits` can clobber concurrent deductions or just-purchased pack credits | `credits.ts:379–407, 448–456` | Atomic RPCs (`SET balance = balance + delta`) like `add_topup_atomic` |
| B14 | Medium | Insurance "refund now, recharge on approval" is half-built: the only retry path is internal → privileged → deduction skipped. **Every approved held video renders free.** | `generate-video/route.ts:610–637`; `admin/retry-video/route.ts:65–73` | Build the recharge on approve |
| B15 | Medium | `admin change_plan` grants credits even if the flag write failed (error unchecked, value unvalidated vs the hand-maintained CHECK constraint) | `admin/user-action/route.ts:33–38` | Allowlist value; grant only after confirmed write |
| B16 | Medium | `reset_credits` writes no ledger row and doesn't reset `cycle_credits_granted` → follow-up `change_plan` grants nothing (Angela-bug recurrence path) | `user-action/route.ts:53–62` | Ledger the reset; zero `cycle_credits_granted` |
| B17 | Medium | Gemini/Lyria calls on the VPS have **no timeout** — one hung socket stalls the whole parallel asset phase indefinitely | `vps/server.js:983, 1015–1031, 1303, 1548` | `AbortSignal.timeout(60s)` via SDK httpOptions |
| B18 | Medium | mp3 duration parser is MPEG1-only; OpenAI fallback emits 24kHz MPEG2 → durations off ~2× on Lambda when fallback fires | `v3-lambda.ts:89–111` | Branch on the version bits |
| B19 | Medium | Temp-file leaks: `out/` per-video artifacts never cleaned; failed `/generate` leaks the whole workdir | `vps/server.js:1290–1593, 2114` | finally-cleanup + hourly `find -mmin +120 -delete` |
| B20 | Low | `industry` referenced but not destructured in `/render-v3` → latent ReferenceError (masked by best-effort try) | `vps/server.js:1064 vs 1110` | Add to destructure |
| B21 | Low | Banned users aren't actually blocked from generating (`'banned'` → free tier, only `past_due` is gated) | `credits.ts` checkCredits path | Explicit banned gate |
| B22 | Low | Refunded-then-completed race: slow VPS render can finish after the cron force-fails + refunds → user keeps video + refund | `fix-stuck-videos/route.ts:156–159` | Completed-after-refund reconciliation |

---

## 3. Security

| # | Severity | Finding | Location | Fix |
|---|----------|---------|----------|-----|
| S1 | **Critical** | **Hardcoded fallback API secret committed to the repo:** `API_SECRET = process.env.API_SECRET \|\| 'docs2video-assembly-secret-2026'`. Gates every privileged VPS endpoint; the box holds the Supabase service key. If the env var is ever unset, the render service falls open to a publicly-known value. | `vps/server.js:14`, `video-service/server.js:14`, `video-service/docker-compose.yml:16`, `video-service/setup.sh:22`, `app/api/admin/campaigns/[id]/generate/route.ts:17` | Remove fallbacks (fail closed at boot), **rotate the secret**, purge from history |
| S2 | High | VPS `authCheck` uses `!==` (non-constant-time) on the shared secret — timing side-channel. The app side already does this right (`safeEqual`). | `vps/server.js:39–45` | `crypto.timingSafeEqual` with length guard |
| S3 | High | Brand fetches not user-scoped in 7 routes, and **no committed RLS migration for `brands` exists** — combined with known prod migration drift, any user may be able to read any brand (contact info, logos) by id | `generate-video/route.ts:360`, `generate-deck:74`, `generate-ads:51`, `generate-flyer:122`, `generate-infographic:51`, `deck-builder:94`, `generate/route.ts:37` | Add `.eq('user_id', user.id)` defense-in-depth AND verify/commit `brands` RLS |
| S4 | Medium | Chatbot renders model output via `dangerouslySetInnerHTML` with no sanitizer — prompt-level tag allowlist is not a security boundary (XSS) | `app/_components/HelpChatWidget.tsx:161` | DOMPurify/sanitize-html before injection |
| S5 | Medium | VPS fetches caller-supplied URLs (musicUrl, logo, presenter.photo) with `redirect:'follow'` and no private-IP guard — SSRF from inside Hetzner if S1 is ever exploited. (App-side `brand-scraper.ts` does this correctly.) | `vps/server.js:429, 1192, 1211, 1293, 1547` | Port the `isPrivateIp` guard to the VPS |
| S6 | Medium | In-memory rate limiters on unauthenticated spend endpoints reset per serverless instance — the "10 demos/day global" cap is illusory; attacker can burn AI spend | `try-demo/route.ts:9–35`, `capture-lead`, `track-view` | Shared store (Supabase/Upstash) |
| S7 | Medium | Admin-check inconsistency: one route uses email-allowlist-only, several money routes use DB-flag-only — both diverge from `isAdminRequest` (a historically bitten bug) | `debug-videos/route.ts:10`; `admin/costs:36`, `admin/revenue:15`, `admin/credit-history:13` | Standardize on `isAdminRequest` everywhere |
| S8 | Low | Email templates interpolate user input unescaped (an `esc()` helper already exists elsewhere) | `app/_lib/email.ts` | Reuse `esc()` in `buildEmailTemplate` |
| S9 | Low | `watermarkText` reaches ffmpeg `drawtext` with only quote-escaping (`:`/`\`/`%` not neutralized); secret-gated, low reach | `vps/server.js:356` | `textfile=` or strict allowlist |

**Genuinely good:** Stripe webhook signature verification + atomic idempotency claim with release-on-error (`webhooks/stripe/route.ts:69, 84–96, 478`); Creatomate webhook re-fetches authoritative status instead of trusting the unsigned payload; API v1 keys SHA-256-hashed with `timingSafeEqual` and per-key rate limits; public `/watch` uses explicit column allowlists (a prior PII leak was fixed and documented); `brand-scraper.ts` has textbook SSRF defense; cron auth is constant-time and fails closed; upload routes derive storage paths from the authenticated user, never the body; profiles RLS UPDATE policy blocks self-granting `is_admin`.

---

## 4. Code Quality

| # | Severity | Finding | Location | Fix |
|---|----------|---------|----------|-----|
| Q1 | High | Design-system rule inverted in practice: **5,556 inline `style={{}}`** vs 2,862 `className=` — the project's own CLAUDE.md mandates globals.css classes | app-wide | ESLint `react/forbid-dom-props` warn + burn-down; new code uses classes |
| Q2 | High | Giant `'use client'` pages: `videos/[id]` 2,368 lines / 8 useEffects, `watch/[id]` 1,693, `admin` 1,458, `Step1Content` 1,141 — player/editor/share/analytics interleaved; whole bundle ships to every anonymous prospect on /watch | respective page.tsx files | Split by concern; move first-paint data to server components |
| Q3 | High | Admin auth boilerplate re-implemented in **38 routes** (one already drifted — see S7) | `app/api/admin/*` | Shared `requireAdmin()` helper in `_lib/admin.ts` |
| Q4 | Medium | Error shape/logging inconsistent: 883 `{error}` vs 9 `{message}`; **289 `console.error` vs 20 `logError()`** — 93% of errors bypass the error-capture pipeline that was purpose-built for the admin Logs UI | app-wide | Standardize `{error, code?}`; sweep hot paths to `logError` |
| Q5 | Medium | 234 `as any` across 81 files, concentrated exactly where types matter most (`generate-video` 20, `script-generator` 26, Stripe version seams) | e.g. `billing/route.ts:65` | Narrow interfaces for LLM-JSON and Stripe seams |
| Q6 | Medium | Route files export domain logic; tests import from routes (`isSceneEmpty` etc.) | `generate-video/route.ts:84,92` | Move to `_lib` |
| Q7 | Low | Repo root junk drawer: 5 demo MP4s, test media, ~25 planning docs, `test-results/`, ~60 loose root-level SQL files | repo root | gitignore artifacts; docs/ and supabase/migrations/ consolidation |

---

## 5. Performance

| # | Severity | Finding | Location | Fix |
|---|----------|---------|----------|-----|
| P1 | High | **The ~16fps render ceiling is per-frame compositing in SwiftShader** (measured: concurrency 8 vs 12 identical). Drivers: full-screen `blur(8px)` over per-frame-moving gradients (`AuroraBackground.tsx:27`), grain re-seeded every 2 frames + two full-screen `mixBlendMode` layers (`FilmOverlay.tsx:17–26`), full-scene `blur(7–12px)` on every transition (`V3Video.tsx:67`) | `remotion/src/*` | Bake softness into gradient stops (drop the blur), re-seed grain every 4–6 frames, quantize drift so layers cache; benchmark `--gl=angle-egl` |
| P2 | High | Page thumbnails boot N Chromes to re-render frames **that already exist in the final MP4** — one ffmpeg `-ss <t> -frames:v 1` pass gets pixel-identical stills in ~1s total | `vps/server.js:1556–1575` | Extract stills from the rendered MP4 (pre-music file) |
| P3 | Medium | Stripe list calls capped at `limit:100` with no pagination in money reports — MRR/revenue silently under-report past 100 subs (billing-health paginates correctly; reuse it) | `admin/billing/route.ts:31`, `admin/revenue/route.ts:26`, `admin/stats/route.ts:45` | Extract billing-health's pagination helper to `_lib/stripe.ts` |
| P4 | Medium | Admin dashboard ships ≤1,000 full profiles + 2,000 full videos + 20,000 analytics rows as one JSON blob to the client, re-fetched wholesale after **every** mutation | `admin/data/route.ts:17–44`; `admin/page.tsx:91, 564` | Named columns, pagination, SQL group-by for counts, scoped refetch |
| P5 | Medium | `npx remotion render` spawn per job re-resolves npx + re-bundles (10–30s each, plus per-still) | `vps/server.js` render spawns | Long-term: warm process with `@remotion/renderer` against one `bundle()` — also kills the props-file races |
| P6 | Low | Unbounded `credit_transactions` query silently truncates at Supabase's 1,000-row default as the ledger grows | `admin/costs/route.ts:50` | Date-window or aggregate in SQL |

---

## 6. Testing

Better than expected: vitest + playwright configured, 15 unit files + 14 e2e specs, and a genuinely sophisticated **golden-fixture approach for LLM output** (structural comparison, `UPDATE_GOLDEN=true` regeneration — the right way to test nondeterministic generation).

**Gaps, in value order:**
1. **`credits.ts` (661 lines) — one pure function tested.** Deduct/refund/grant math, grandfathering, the known UUID-refund gotcha: all untested.
2. **Stripe webhook (483 lines) — zero tests.** Highest blast radius in the app; B3/B11/B12 above would all have been caught by handler-level tests with mock events.
3. `tierFromPriceId` — trivial to test, silently breaks provisioning when misconfigured.
4. `displayProgress` — pure function driving all user-facing progress.
5. `isAdminRequest` fallback chain — already bitten once historically.

Also: several "unit" tests make live LLM calls (`testTimeout: 120_000`) — split pure-logic tests from LLM integration tests so CI can run on every push without keys/cost.

---

## 7. Maintainability & Tech Debt

- **Migration drift is the #1 systemic risk** (M1, High): ~60 loose root-level SQL files vs 10 in `supabase/migrations/`, prod applies them by hand, and one file is literally named `supabase-MISSING-TABLES-2026-06-22.sql`. This already causes real bugs (B6; dead share links per project memory). Fix: consolidate into `supabase/migrations/` with an APPLIED.md checklist — or adopt `supabase db push` against prod with review.
- **The VPS deploy story** (M2, Medium): `redeploy.sh` itself is exemplary (verifies the running container), but the box is hand-synced — today's deploy required `curl` from GitHub raw + a `sed` patch because `/root/video-service` isn't a git clone. One `git clone` on the box turns deploys into `git pull && redeploy.sh`.
- **Env sprawl** (M3, Low): 60 distinct `process.env.*` keys; `requireEnv` only warns and returns `''` (`env.ts:1–7`) — missing keys degrade silently. Fail hard on the required set.
- **BUILD-STATE.md staleness** (A9) undermines the project's own #1 operating rule.
- **`vps/server.js`** as a 2,167-line single untested file hand-synced with the app's payload shapes — the drift with Lambda (A1) is the proof of the cost.

---

## Executive Summary (for a non-engineer)

Docs2Video is a real, working product with unusually mature money-handling for its size — payments are double-checked, credit changes are logged, and many past bugs are documented in the code so they can't silently return. However, the review found **three urgent problems**: (1) when a video fails on the render server, the customer's credits are **not** refunded even though the error message tells them they were; (2) two videos rendering at the same time can get **each other's content** because they share a scratch file; and (3) buying the $50 social add-on can accidentally **upgrade a free account to a paid plan** with 25,000 free credits due to a webhook gap. There's also a placeholder password for the render server committed to the code that must be rotated. The render slowness was definitively traced this week: it's not the server's cores (the expensive 16-core upgrade made no difference) but heavy visual effects computed frame-by-frame, plus one-at-a-time asset generation, which was just parallelized — though that new parallel code introduced two smaller bugs of its own that need patching. Testing exists and is clever in places, but the code that moves money has almost no automated tests, which is how the webhook gaps slipped through. Overall: solid foundations, a handful of urgent revenue-and-trust bugs, and a codebase that needs consolidation (six render paths, duplicated logic) before it grows further.

---

## Top 10 Things to Fix First

1. **B1 — Refund VPS-failed renders** (customers charged for failures while told they were refunded). Cron sweep of `failed` + `deducted_cost>0` rows. *~1 hour, revenue/trust critical.*
2. **B2 — Per-video props for `/render-v3`** (cross-tenant content leak + placeholder-render risk). Copy editorial's `--props` pattern. *~30 min.*
3. **B3 — Guard social-addon events in all webhook handlers** (free Pro upgrades; addon failures flip accounts past_due). *~1 hour.*
4. **S1 — Remove the committed API-secret fallback everywhere, rotate the secret, fail closed at boot.** *~1 hour incl. rotation.*
5. **B7+B8 — Patch today's parallelization regressions**: bounded TTS pool (no mixed narrators) + `Promise.allSettled` cleanup (no asset leaks). *~1 hour.*
6. **B4+B5 — Refund idempotency per-charge + ownership check on the generate-video claim.** *~1 hour.*
7. **B6 — Resolve the `prompt_versions` migration drift** (silently breaks script persistence in prod). Run it or remove the column refs. *~30 min + one prod SQL.*
8. **B9 — VPS render queue (semaphore of 1–2)** before two simultaneous client renders crash Chrome again. *~1 hour.*
9. **S3 — Verify/commit `brands` RLS + add user scoping to the 7 brand fetches.** *~1 hour + one prod SQL.*
10. **T1 — Unit tests for `credits.ts` + the Stripe webhook** (mock events for every handler; this is what would have caught #3 and #6 before customers could). *~1 day, permanent payoff.*

**Fast follows:** P2 (ffmpeg stills instead of N Chrome boots — biggest remaining render-time win), P3 (Stripe pagination before subscriber #101), B12 (dunning grants free-tier credits), B14 (approved insurance videos render free), S4 (chatbot XSS sanitizer), Q3 (`requireAdmin()` across 38 routes).

---

## Uncertainties / Couldn't Verify

- **Prod RLS state** on `brands` (and other user tables without committed policies) — no migration exists in-repo; given known drift, prod may or may not have RLS enabled. Needs a live `pg_policies` check before treating S3 as confirmed-exploitable.
- **Whether the stale `video-service/` server is deployed anywhere** — the live box runs `vps/server.js` content from `/root/video-service/`, which confusingly shares the folder name. Verified today the running container matches `vps/server.js`; the in-repo `video-service/` tree's status on any other host is unknown.
- **ElevenLabs plan concurrency limit** (B7's severity depends on it — at N≤5 concurrent it may rarely trip; at 2–3 it will trip on most videos). Check the plan tier.
- **Actual Stripe API version pinned in prod** vs the `current_period_end`-on-item ambiguity papered over with casts (Q5) — behavior verified working today via billing-health, but the seam is untyped.
- Findings B11/B12 (grant cycle logic) were traced statically; edge-case behavior around `cycle_start` boundaries deserves a test harness rather than more reading.
- Line numbers cite the working tree as of commit `0028ee9` (2026-07-01) and will drift.
