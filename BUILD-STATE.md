# Docs2Video — Build State

**Last updated:** 2026-06-02
**Branch:** main
**Build:** ✅ Compiles clean (1 warning)
**Deploy:** Vercel (docs2video.com)

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
Auth: managed by Supabase Auth

### Client Management System (added 2026-05-25)
- **clients** table: full CRM with name, email, company, phone, industry, tags, status (lead/active/engaged/converted/inactive), source tracking, revenue/video/view counters
- **client_activities** table: unified timeline (email_sent, video_viewed, video_played, note_added, client_created, quote_sent, etc.)
- **videos.client_id**: FK to clients table for direct assignment
- **API routes**: `/api/clients` (list+create), `/api/clients/[id]` (detail+update+delete), `/api/clients/[id]/activities` (timeline+notes), `/api/clients/[id]/videos` (assigned+sent videos), `/api/clients/import` (CSV), `/api/clients/export` (CSV)
- **Pages**: `/clients` (list with stats, search, status filters, add form, CSV import/export), `/clients/[id]` (detail with tabs: activity, videos, emails, payments)
- **Activity wiring**: send-video-email and send-email routes auto-create/update client records and log activities; track-view logs video_viewed/video_played activities to matching clients
- **Migration**: `supabase-clients-migration.sql` (run against Supabase to create tables + RLS)

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
