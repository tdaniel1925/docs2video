# AI Social Auto-Post Add-On — Implementation Plan

**Goal:** A monthly add-on where clients connect their own social accounts, and the
app uses **Gemini** to create social **images + videos** + AI to write captions,
then **auto-posts/schedules** them across the client's channels via **Zernio**.

**Decision:** Switch the social-posting backend from **AyrShare → Zernio**.
**Pricing model:** per connected account (1–2 free, $6 @ 3–10, $3 @ 11–100, $1 @
101–2,000). Unlimited posts. → ~64% margin early, ~90%+ at scale on a $50/mo add-on.

---

## Confirmed Zernio facts (docs + Zernio confirmation 2026-06-26)
- **Tenant model:** ONE profile per CLIENT (a profile holds one account per
  platform → each client gets their own X+FB+IG+LinkedIn). Create via
  `POST /api/v1/profiles` → `profile._id`. Scope everything by `profileId`.
- **One master API key** manages all profiles (no per-tenant Zernio user). Store
  `profiles.zernio_profile_id` per app user/client.
- **Connect (branded/headless):** `GET /api/v1/connect/{platform}?profileId=THEIR_PROFILE_ID&redirect_url=https://docs2video.com/...&headless=true`
  → returns `authUrl`; redirect the client there; they return to our callback with
  connected-account info. `headless=true` keeps the account-picker INSIDE our app
  (finalize via list/select endpoints — no Zernio-branded screens).
- Guide: https://docs.zernio.com/guides/connecting-accounts

## Confirmed Zernio facts (earlier doc pull)
- Auth: API key `sk_…`, REST, base `https://zernio.com/api/v1`. Env: `ZERNIO_API_KEY`.
- **Multi-tenant:** `profiles` isolate each customer's connected accounts.
- **Connect flow:** `GET /v1/connect/url` → hosted `authUrl` (redirect user) →
  `POST /v1/connect/callback`. No native OAuth to build.
- **List accounts:** `GET /v1/accounts` → each has an `id` (accountId).
- **Post:** `POST /v1/posts` with `content`, `platforms:[{platform, accountId}]`,
  media (`video` / `imageUrl` / `mediaUrls`, **passed as URLs**), scheduling via
  `scheduledFor` + `timezone`, or `publishNow:true`, or omit = draft.
- **Video supported via URL**, incl. YouTube (`title`/`description`/`visibility`).
- 14+ platforms (X, IG, FB, LinkedIn, TikTok, YouTube, Pinterest, Reddit,
  Bluesky, Threads, Telegram, Snapchat, WhatsApp, Discord).

## API key handling
- **Build:** no key needed. Code references `process.env.ZERNIO_API_KEY`.
- **Test/live:** user adds `ZERNIO_API_KEY` to Vercel env (+ VPS only if the VPS
  ever posts; it won't — posting is app-side). NEVER paste the key in chat.

---

## Phase 0 — Backend swap (AyrShare → Zernio core lib)
- New `app/_lib/zernio.ts`: typed client — `connectUrl()`, `listAccounts(profileId)`,
  `createPost({profileId, content, platforms, media, scheduledFor|publishNow})`.
- Reuse the AyrShare call sites' SHAPE; point them at Zernio. Keep AyrShare code
  behind a flag for one release (fast rollback) — `SOCIAL_BACKEND=zernio|ayrshare`.
- DB: `profiles.zernio_profile_id` (per user), drop reliance on
  `ayrshare_profile_key` (keep column for migration).

## Phase 1 — Connect accounts (the OAuth-less connect flow)
- Settings → "Social Accounts": button → `GET /v1/connect/url` → redirect user to
  Zernio's hosted `authUrl` → callback returns to `/settings/social/callback` →
  `POST /v1/connect/callback` → store nothing (Zernio holds tokens); we just
  re-list accounts.
- Show connected accounts (`GET /v1/accounts`) with platform icons + disconnect.

## Phase 2 — AI content engine (the differentiator)
This is the value; reuses existing pieces.
- **Input modes:** (a) short interview (reuse brief-chat pattern), (b) a doc/topic
  (reuse extract + combine), (c) "promote this video I made" (reuse a Library video).
- **Generate batch:** one Claude pass → N posts (caption + hashtags + per-platform
  variants + an image-prompt). Reuse script-generator patterns.
- **Gemini media:**
  - Images: reuse the flyer/`generateImage` Gemini path (art-direction pass +
    flat full-bleed rules) → social sizes (1080² / 1080×1350 / story).
  - Video: reuse the existing V3 render pipeline (the videos the app already makes)
    → upload MP4 → use its public URL as Zernio's `video`.
- Upload all media to the `videos` Supabase bucket → pass public URLs to Zernio.

## Phase 3 — Review + schedule
- Batch review screen: edit captions, swap/regenerate image, pick platforms,
  set a schedule (date/time or a recurring cadence → Zernio `scheduledFor`/queue).
- Publish → `POST /v1/posts` per platform/account.

## Phase 4 — Billing (the $50 add-on)
- New Stripe price `STRIPE_PRICE_ADDON_SOCIAL` ($50/mo). Add-on subscription item
  on the user's existing subscription (you already have trial→sub plumbing).
- Gate the whole Social area behind `profiles.social_addon_active`.
- Webhook: on add-on purchase/cancel → flip the flag.
- Credits: AI generation (captions + Gemini images/video) still costs credits per
  your normal rates; the $50 covers the posting/Zernio seat. (Decide: include some
  monthly generation credits in the $50, or charge generation separately.)

## Phase 5 — Help + nav + tests
- Re-expose under nav (or a dedicated "Social" section).
- Help article. e2e smoke (connect URL returns, post payload shape) like the
  existing subscription specs. Unit test the caption/post builder.

---

## DECISIONS LOCKED (2026-06-26)
- **Cutover:** HARD switch AyrShare → Zernio (no parallel flag).
- **$50 add-on:** posting/connect/schedule ONLY. AI generation (captions + Gemini
  images/video) draws from the user's normal credit balance.
- **v1 scope:** images AND video (post rendered MP4s incl. YouTube) in the first release.
- **Start now.**

## Open decisions before build (superseded above)
1. **Cutover vs parallel:** run Zernio alongside AyrShare behind a flag (safe), or
   hard-cut? (Recommend flag for one release.)
2. **What the $50 includes:** posting only, or posting + a monthly bundle of
   generation credits?
3. **Video in v1 or phase 2:** ship image posts first (faster), add video-to-social
   right after? (Recommend image-first, video fast-follow.)
4. **Per-account cost passthrough:** flat $50 regardless of # accounts, or $50 +
   $X per account beyond N? (Protects margin if a client connects 10 accounts.)

## Reuse map (why this is ~60% existing)
- Interview/brief → have it. Extract/combine → have it. Caption gen → script-gen
  pattern. Gemini images → flyer path. Video → V3 pipeline. Storage/URLs → have it.
  Stripe add-on → trial→sub plumbing. NEW: zernio.ts, connect flow, batch review
  UI, the posts-from-interview prompt, the add-on gate.
