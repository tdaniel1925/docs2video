# Docs2Video — Build State

**Last updated:** 2026-07-01 (header sections below may lag — see CODE-REVIEW-2026-07-01.md for the current architecture map)
**Branch:** main
**Build:** ✅ Compiles clean
**Deploy:** Vercel (docs2video.com)

## 2026-07-01 — Full code review + top-10 hardening (commit ea77d13)

Full-codebase review in `CODE-REVIEW-2026-07-01.md`. Fixed in one pass:
- **Refunds:** VPS-failed renders now actually refund (cron sweeps `failed` + `deducted_cost>0`; refund zeroes the marker); refund idempotency is per-charge so retried videos refund correctly.
- **Render isolation:** per-video `--props` for /render-v3 AND /render-editorial (shared props file = cross-video content leak); render queue (one Chrome fleet at a time); TTS pool of 3 + ElevenLabs retry (no mixed narrators); allSettled asset fan-out (no orphaned files); 120s Gemini timeouts; editorial page thumbnails via ffmpeg frame-grab instead of N Chrome boots.
- **Stripe webhook:** `social_addon` guarded in ALL handlers (was silently upgrading free→Pro and blocking accounts on a failed $50 invoice); renewal grants derive tier from the invoice price id (dunning recovery no longer grants free tier).
- **Security:** committed fallback API secret removed everywhere (VPS fails closed); LIVE keys stripped from video-service/docker-compose.yml (**ROTATE: API_SECRET, Supabase service-role, Gemini, OpenAI**); constant-time VPS auth; brands RLS migration (`supabase/migrations/20260701_brands_rls.sql` — **run manually in prod**) + owner-scoping on all 14 brand fetches; DOMPurify on chatbot HTML.
- **Correctness:** generate-video claim requires ownership; `prompt_versions` (column missing in prod) split out of the critical script persist, which is now error-checked.
- **Tests:** +25 unit tests (webhook guards, tierFromPriceId, displayProgress, video cost/grandfathering).

**2026-07-01 (second pass, commit 3944e69) — ALL deferred findings fixed:** B10 (Lambda parallel assets + maxDuration 800), B11 (forceNewCycle grants on checkout/trial-conversion), B13 (CAS-atomic tier/monthly grants), B14 (recharge-on-approve via retry-video chargeOwner), B15/B16 (change_plan allowlist + reset ledger), B18 (MPEG2-aware mp3 parser), B21 (banned-user gate), B22 (completed-after-refund re-deduct in cron), P3 (listAllStripe pagination in billing/revenue/stats), Q3 (requireAdmin across all 38 admin routes + debug-videos; isAdmin split to client-safe admin-emails.ts), S6 (durable rate_limit_hit RPC + try-demo/capture-lead/track-view wired — **run supabase/migrations/20260701_rate_limits.sql in prod**), A3 (stale video-service/ tree deleted; compose template at vps/docker-compose.yml).

**2026-07-01 (commit afbc37c) — A1 closed by REMOVAL:** the Remotion Lambda render path was deleted entirely (user no longer uses Lambda). `v3-lambda.ts`, the generate-video Lambda branch, the admin "V3 render target" selector, the `video_render_target` setting, `deploy-lambda.mjs`, and the `@remotion/lambda` dependency are gone — the VPS is the only renderer. Git history preserves it.

**Remaining debt:** per-frame effect cost in Remotion comps (~16fps ceiling, P1), giant client pages (Q2), inline-style burn-down (Q1).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.6 (Turbopack) |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| AI Images | Google Gemini 3 Pro Image |
| AI Text | Google Gemini 2.5 Pro/Flash + Anthropic Claude |
| AI Voice | OpenAI TTS-HD (6 voices) |
| AI Music | Suno via Kie.ai API |
| AI Logos | OpenAI GPT Image (cover-overlay.ts — logo+title on cover/closing slides) |
| Video Assembly | FFmpeg (external Hetzner VPS) |
| Payments | Stripe (subscriptions + agent OAuth Connect) |
| Email | Gmail API, Microsoft Graph, SMTP/Nodemailer, Resend |
| SMS | Twilio |
| Hosting | Vercel |

---

## Pricing (from pricing.ts)

| Tier | Monthly | Projects | Courses |
|------|---------|----------|---------|
| Free | $0 | $10/each | $249/each |
| Pro | $25 | $6/each | $149/each |
| Business | $99 | 50 included | $99/each |
| Agency | $249 | 150 included | 5 included |
| Enterprise | $499 | Unlimited | 20 included |
| Enterprise+ | $799 | Unlimited | Unlimited |

---

## Codebase Stats

| Metric | Count |
|--------|-------|
| Source files | 253 |
| API routes | 116 |
| Pages | 50+ |
| Components | 23 |
| Lib files | 32 |
| Slide templates | 65 |
| Voice options | 6 |
| Industry configs | 12 |
| Migration files | 31 |
| E2E test files | 12 |

---

## External Services & API Keys

| Service | Env Var | Purpose |
|---------|---------|---------|
| Gemini | `GEMINI_API_KEY` | Image gen, text extraction, script writing |
| OpenAI | `OPENAI_API_KEY` | TTS voices, logo styling (GPT Image) |
| Anthropic | `ANTHROPIC_API_KEY` | Claude for brand-kit chat (Sofia AI) |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | DB, auth, storage |
| Stripe | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | Subscriptions, payments |
| Stripe Prices | `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`, `STRIPE_PRICE_AGENCY`, `STRIPE_PRICE_ENTERPRISE`, `STRIPE_PRICE_ENTERPRISE_PLUS` | Plan price IDs |
| Stripe Projects | `STRIPE_PRICE_PROJECT`, `STRIPE_PRICE_PROJECT_PRO`, `STRIPE_PRICE_COURSE`, `STRIPE_PRICE_COURSE_PRO`, `STRIPE_PRICE_COURSE_BIZ` | Per-project prices |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Gmail, Google Calendar |
| Microsoft OAuth | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_REDIRECT_URI`, `MICROSOFT_TENANT_ID` | Outlook/365 email |
| Kie.ai | `KIE_API_KEY` | Suno music generation |
| Resend | `RESEND_API_KEY` | Email delivery |
| Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | SMS notifications |
| Video VPS | `VIDEO_ASSEMBLY_URL`, `VIDEO_ASSEMBLY_SECRET` | External FFmpeg server |
| Public API | `INTERNAL_API_SECRET` | Trusted header for v1 API → internal route calls (required to enable `/api/v1`) |
| App Config | `NEXT_PUBLIC_SITE_URL`, `ADMIN_EMAIL`, `IMAGE_MODEL` | App settings |

---

## Auth Providers

1. **Supabase Auth** — email/password signup/login
2. **Google OAuth** — Gmail send + Google Calendar
3. **Microsoft OAuth** — Outlook/365 email send
4. **Stripe OAuth** — agents connect their own Stripe for client payments

---

## Key Features (verified working)

### Content Creation
- Upload PDF → AI extraction (any document type, 12 industry configs)
- Type/paste text → AI structuring
- Start from idea → AI content generation
- URL extraction
- AI Research mode

### Output Types
- Video explainers (script → slides → audio → music → assembly)
- Infographics
- Slide decks (PPTX)
- PDF downloads
- Logo generation + styling
- Social media kits
- Business cards
- Flyers
- Video courses
- Brand decks

### Branding
- Website scraper (URL → colors, logo, fonts, tone, industry)
- Brand guide generation (color psychology, tone guide, content themes)
- Cover/closing overlay system (Gemini decorative background + GPT logo+title overlay + Sharp composite)
- Multiple photo uploads (headshot, mid-level, standing)
- Photo compositing on slides

### Share Page (/watch/[id])
- Branded video player with slide thumbnails
- Quote/invoice with line items
- Accept & Pay (agent's Stripe)
- Calendar booking (Calendly)
- AI chatbot (Gemini)
- View tracking + agent notifications
- PDF/PPTX/MP4 downloads

### Communications
- Gmail, Outlook, SMTP email sending
- Branded HTML email templates
- Email open tracking
- SMS notifications (Twilio)

### Admin
- Dashboard with stats
- Bulk operations
- Campaign management
- User management
- Music library management

---

## Database Tables (Supabase)

Core: profiles, videos, brands, infographics, custom_templates
Content: creations, video_analytics, chat_messages
Commerce: quotes, email_connections, sent_emails
CRM: clients, client_activities (+ videos.client_id FK)
Social: social_shares, affiliates, referrals
Admin: campaigns, notifications, jobs, feedback
Public API: api_keys, api_credit_balances, api_usage_log
Affiliate: affiliates, referrals, affiliate_commissions, affiliate_clicks
Credits: credit_balances (SOURCE OF TRUTH: balance + topup_balance), credit_transactions. profiles.credits_remaining is DEAD/legacy — do not read or write it.
Auth: managed by Supabase Auth

### Client Management System (added 2026-05-25)
- **clients** table: full CRM with name, email, company, phone, industry, tags, status (lead/active/engaged/converted/inactive), source tracking, revenue/video/view counters
- **client_activities** table: unified timeline (email_sent, video_viewed, video_played, note_added, client_created, quote_sent, etc.)
- **videos.client_id**: FK to clients table for direct assignment
- **API routes**: `/api/clients` (list+create), `/api/clients/[id]` (detail+update+delete), `/api/clients/[id]/activities` (timeline+notes), `/api/clients/[id]/videos` (assigned+sent videos), `/api/clients/import` (CSV), `/api/clients/export` (CSV)
- **Pages**: `/clients` (list with stats, search, status filters, add form, CSV import/export), `/clients/[id]` (detail with tabs: activity, videos, emails, payments)
- **Activity wiring**: send-video-email and send-email routes auto-create/update client records and log activities; track-view logs video_viewed/video_played activities to matching clients
- **Migration**: `supabase-clients-migration.sql` (run against Supabase to create tables + RLS)

### Public Video-Generation API v1 (added 2026-06-12)
- **Purpose**: let other apps generate videos/PPTX/PDF from text, URL, file upload, or an AI idea — programmatically.
- **Auth**: `Authorization: Bearer d2v_live_…`. Admin-issued keys only; SHA-256 hash stored, raw key shown once.
- **Credit pool**: separate metered `api_credit_balances` (NOT the UI `credit_balances`). Charged on accept, auto-refunded on failure.
- **Endpoints**: `POST /api/v1/videos` (async → `job_id`), `GET /api/v1/videos/[id]` (poll), `GET /api/v1/credits`.
- **Reuse**: v1 routes call the existing extraction + generate-video routes server-to-server with an `x-internal-service` trusted header (`INTERNAL_API_SECRET`) + `x-internal-user-id`. Those routes gained a guarded internal-auth branch (`resolveRequestUser` in `app/_lib/api-auth.ts`) that acts as the resolved user and skips UI-credit gates (already metered at v1 layer). No refactor of working generation logic.
- **Webhook callback**: optional `webhook_url` in the create body; `app/_lib/api-webhook.ts` POSTs the job payload on completion/failure (fires on the Creatomate v2 path + the generate-video failure path; poll is the source of truth on the legacy VPS path).
- **Admin UI**: `/admin/api-keys` (page) + `POST/GET /api/admin/api-keys` — create/revoke keys, top up the API pool.
- **Migration**: `supabase-api-migration.sql` (api_keys, api_credit_balances, api_usage_log + indexes, RLS-deny).
- **Env**: requires `INTERNAL_API_SECRET` set; API returns 503 until it is.
- **Docs**: `API.md`.

### Affiliate Program v1 (added 2026-06-12)
- **Model**: 20% **recurring, lifetime** commission, **manual** payouts, **Stripe promo-code** tracking, **self-serve** enrollment. Buyer gets 15% off via the affiliate's promo code.
- **Replaces** the old stub affiliate system (deleted `/affiliates`, `/api/affiliates`, `/api/affiliates/track` — they had enrollment + a 5-free-credits-per-signup reward but no money). The 5-credit signup bonus was intentionally dropped.
- **Enrollment**: `enrollAffiliate()` (`app/_lib/affiliate.ts`) creates the `affiliates` row + a real Stripe **coupon (15% off, forever)** and **promotion code** (unique code, e.g. `JANE7K2P`), storing `stripe_coupon_id`/`stripe_promo_code_id`/`promo_code`. Idempotent.
- **Attribution**: link `…/api/affiliate/r?ref=CODE` logs a click, drops a 60-day `d2v_ref` cookie, redirects home. The Stripe promo code on the paid subscription is the authoritative signal.
- **Commission recording** (in `app/api/webhooks/stripe`): first payment on `checkout.session.completed`; recurring on `invoice.payment_succeeded` (subscription_cycle); clawback on `charge.refunded`. All NON-FATAL (a commission bug never breaks subscription provisioning). Idempotent on `stripe_invoice_id`. Self-referral guarded.
- **Checkout**: `allow_promotion_codes: true` so referred buyers can enter a code.
- **Ledger**: `affiliate_commissions` (status pending → approved → paid → clawed_back; 30-day refund hold before approval).
- **Affiliate dashboard**: `/affiliate` — enroll CTA, link + promo code copy, funnel stats, banner downloads (`public/affiliate/*.svg`), email/social swipe copy. Linked from the account menu in `Header.tsx`.
- **Admin**: `/admin/affiliates` + `/api/admin/affiliates` — list, pause/activate, approve-pending (30d+), **export payout CSV**, mark-paid. Gated by `isAdminRequest`.
- **Migration**: `supabase-affiliate-migration.sql` (extends `affiliates`; adds `affiliate_commissions`, `affiliate_clicks`; RLS-deny). Built against the LIVE `referrals` shape (affiliate_id, referred_user_id, status, commission_amount, commission_paid).
- **Help**: updated the "Affiliate Program" article.

### Credits System Audit + Fixes (2026-06-13)
Deep multi-agent audit of all 36 credit-touching files. Fixed (all build-clean):
- **getBalance / checkCredits**: checkCredits is now PURE (no side-effect grant). First grant happens only via ensureCreditBalance (self-heal). Fixes new-user "disappearing credits".
- **grantMonthlyCredits**: now PER-CYCLE IDEMPOTENT (guards on cycle_start < ~25d + already-granted) — no more blind overwrite that wiped spend / refilled free on upgrade or webhook retry.
- **applyTierChange (new)**: plan upgrade adds only the positive tier delta (no free full refill); downgrade is a no-op on the current cycle. Wired into Stripe customer.subscription.updated.
- **deductCredits**: bounded retry (max 5), aborts on hard DB error, NO legacy profiles.credits_remaining fallback (ensures a real row instead).
- **addTopupCredits**: atomic compare-and-set on topup_balance + bounded retry (was a lost-update race).
- **refundVideoCredits (new)**: idempotent per videoId (credit_transactions marker) — prevents double refund across generate-video / Inngest onFailure / Creatomate webhook.
- **5 routes** (extract, extract-url, extract-text, generate-from-idea, proposal-chat) + generate (infographics) now gate/charge against credit_balances via checkCredits/deductCredits, not the dead column. Internal API calls skip the UI gate.
- **getUserTier**: 'agency' now maps to enterprise (was silently → free).
- **Stripe webhook**: idempotency marker written BEFORE grant; grant on upgrade via applyTierChange.
- **Admin**: create-user + promo-user now grant via ensureCreditBalance (promo-user sets is_beta for true unlimited, recognized status); add_credits no longer writes the misleading legacy column; social-share rewards go to the real wallet via addTopupCredits.
- Audit dropped 2 false-positive "critical" claims (no silent mid-cycle refill in normal spend; agency loop self-stabilizes).

### Video Pipeline Hardening (2026-06-14)
Multi-agent reliability audit → fixed all HIGH + MEDIUM. Build-clean.
- **H1**: fix-stuck-videos cron now REFUNDS deducted credits on force-fail (was the central money bug) + notifies. Reads videos.deducted_cost.
- **H2**: generate-video early-return guards (invalid scenes, insurance Tier1/2 review holds, script validation, daily ceiling) now refund. Insurance hold policy = REFUND NOW, recharge on approval. deducted_cost persisted on the row at deduction.
- **H3**: duplicate-submission guard is now DB compare-and-set (UPDATE…WHERE status IN draft/failed/pending) — prevents double-charge across serverless instances; in-memory set kept as fast path.
- **H4**: cron recovers V2 jobs via Creatomate getRender — succeeded→download+complete, failed→fail+refund; only force-fails V1 (no render id). render id persisted in render-video.ts.
- **M1/M2**: cron force-fails on activity-staleness (progress_updated_at, no progress in 10min) not absolute created_at age.
- **M3**: deducted_cost persisted immediately so a mid-setup kill is refundable.
- **M4**: VPS ACK timeout 10s→25s; on abort, treat as maybe-queued (leave assembling, cron reconciles) instead of refund+fail.
- **M6**: creatomate render id/url persisted for finalize retry.
- **Notifications**: bell hides stale jobs (>30min) + a Dismiss (×) button per active job (POST dismiss-job). Cleared 144 stuck jobs from prod.
- **Migration**: `supabase-pipeline-hardening-migration.sql` (videos.deducted_cost, creatomate_render_id, creatomate_render_url, progress_updated_at).
- Audit dropped 2 false-positive criticals; V2 is the safer pipeline once these ship.

### Go-Live Checklist — API v1 + Affiliate Program
These features are code-complete and build clean. Setup status:
- [x] **Run `supabase-api-migration.sql`** in Supabase (creates `api_keys`, `api_credit_balances`, `api_usage_log`). DONE 2026-06-13.
- [x] **Run `supabase-affiliate-migration.sql`** in Supabase (extends `affiliates`; adds `affiliate_commissions`, `affiliate_clicks`). DONE 2026-06-13.
- [x] **Set `INTERNAL_API_SECRET`** in Vercel (long random string). `/api/v1/*` returns 503 until set. DONE.
- [x] **Enable the `charge.refunded` Stripe webhook event** in the Stripe dashboard so affiliate commission clawbacks fire. DONE 2026-06-13.
- [ ] **Affiliate promo codes are created in whatever mode `STRIPE_SECRET_KEY` points to** — verify enrollment once in test mode, then confirm in live.
- [ ] **Test-mode affiliate flow**: enroll → confirm coupon (15% off, forever) in Stripe → refer via `/r/CODE` in incognito → subscribe with `4242…` → confirm a pending commission in `/admin/affiliates`; verify self-referral records nothing.
- [ ] **Issue a test API key** at `/admin/api-keys`, top up its pool, and smoke-test `POST /api/v1/videos` per `API.md`.

---

## UX Streamline (2026-06-02)

### Completed
- Deleted 4 orphaned pages (source, extracting, review, options) from old 7-step flow
- Removed advanced flow logic from create/layout.tsx — single 5-step wizard only
- Fixed critical routing bug: Step 1 was sending users to deleted /create/styling
- Cleaned up all dead references to orphaned pages in script and styling pages
- Renamed detail levels from Quick/Standard/Detailed to Short/Medium/Long with duration badges
- Added "Upgrade to unlock" links on plan-gated video lengths
- Fixed narration style play buttons (were hardcoded disabled)
- Script page defaults to read-only summary view with "Edit script" toggle
- Fixed skip button text on brand page: "Skip branding" instead of "Skip — use generic styling"
- Removed stale localStorage writes from Step 1 (wizard uses draft API)

### Remaining
- Generate voice audio samples for all 6 voices
- Generate narration style samples (solo vs podcast demo)
- Add style picker with thumbnail previews
- Dashboard "Continue draft" cards
- Quick mode (skip brand/voice/script, auto-generate with defaults)

---

## Known Issues

1. Some E2E test selectors may not match current UI (ongoing)
2. Logo kit generation is async — may not complete before user navigates away
3. ⚠️ ACTION REQUIRED: Cartesia API key `sk_car_q3LX...` was committed to git history (commit ff100f4) — rotate it in the Cartesia dashboard and set `CARTESIA_API_KEY` env var on the VPS. Code no longer hardcodes it.
4. `app/_lib/music-generator.ts` and `synthesizeAllScenes` in `app/_lib/tts.ts` are dead code — music/TTS for the main pipeline run on the VPS. Candidates for removal.
5. Webhook idempotency unique index: run `supabase-webhook-idempotency-migration.sql` against the DB.

## Product Focus (2026-06-11)

Owner decision: the product is **document-to-video + PPT deck maker** only.
- Peripheral tools (social media, course builder, headshots, image remix, infographics, flyers, business cards, ads, email signatures, brand-kit, translations, affiliates) are HIDDEN from nav/dashboard/help but routes remain live at direct URLs. Restore by re-adding links in `Header.tsx`, dashboard `creations` queries, and the help index.
- Podcast (two-voice) mode SUNSET — wizard option removed, generate-video forces solo. Was the last VPS-only feature.
- Deck builder: 300 credits per deck (`CREDIT_COSTS.deck`), Gemini engine.
- All style previews now Gemini (`generateSlideFromPrompt`, optional reference image param).

## Pipeline v2 — Inngest + Creatomate (2026-06-11, flag OFF)

VPS-free render path behind `USE_PIPELINE_V2` env flag (default false — v1/VPS unchanged and default):
- `app/_lib/inngest/client.ts` + `app/api/inngest/route.ts` — Inngest v4 setup
- `app/_lib/inngest/render-video.ts` — `video/render.v2` function: Gemini slides (`generateSlideFromPrompt` in gemini.ts, same finished prompts the VPS gets) + OpenAI TTS, all scenes in parallel, assets to `videos/{userId}/{videoId}/v2-*`; failure → auto credit refund + notify
- `app/_lib/creatomate.ts` — RenderScript builder (image+audio per scene, 0.5s fades, optional music track) + render API client
- `app/api/webhooks/creatomate/route.ts` — completion webhook; verifies by re-fetching render from API (webhooks unsigned), copies MP4 to `videos/{userId}/{videoId}.mp4`, marks completed
- Limitations: podcast mode falls back to VPS; AI music (Lyria) not supported in v2 yet (static musicUrl works)
- Env: `CREATOMATE_API_KEY` (local only so far), `USE_PIPELINE_V2=false`, Inngest keys needed in Vercel before prod enable
- Local test: `npx inngest-cli dev` + `USE_PIPELINE_V2=true` in .env.local
- DO NOT enable in prod until side-by-side render comparison vs VPS passes

## Security Hardening (2026-06-11)

Full-codebase review applied:
- `GET /api/videos/[id]` now requires auth + ownership (was unauthenticated)
- All 6 cron routes use `verifyCronAuth()` (`app/_lib/cron-auth.ts`) — constant-time compare, fails closed
- SSRF guard (`isSafePublicUrl` in `brand-scraper.ts`) on brand scraping, logo fetching, logo-kit HEAD checks; redirects validated hop-by-hop
- Stripe webhook: generic signature-error response, idempotency check now matches credit-pack descriptions (was never matching — replays could double-credit), credits metadata clamped
- `credits/buy`: fixed metadata key (`supabase_user_id`) — credit packs previously NEVER granted credits via webhook; race-safe customer-ID claim
- `generate-video`: credits auto-refunded when generation fails before VPS handoff; VPS error responses logged with status + body
- `send-email`: rate limit (30/hr), recipient email validation, video ownership check
- Admin data endpoint: query limits added, error detail no longer leaked
- Repo: 75+ `vps-*` one-off patch scripts removed; canonical VPS server tracked at `vps/server.js` (env-var secrets, exits if API_SECRET unset); `vps-*`/`teaser-output/` gitignored
- All inline border-radius values >10px clamped to 10px app-wide (circles via '50%' kept)
- `generating` page surfaces persistent polling failures instead of spinning forever
- Removed unauthenticated test scaffolding: `/api/test-{seedance,seedance-full,kenburns,flipbook}` + their public pages (they called paid AI APIs with no auth). `demo-video` is already disabled (503); `try-demo` has IP rate limiting; `demo-slide-gpt`/`template-demo` are authed.
