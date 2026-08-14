# Security audit — results (read-only, nothing changed)

Five parallel audits: secrets, Supabase RLS, API routes, injection/uploads, and
middleware/CORS/deps/sessions. Ranked by real-world severity.

## DO THIS NOW (needs a key rotation or live SQL / bucket change — code merge won't fix)

1. **Make the `creation-assets` storage bucket PRIVATE.** It is `public: true`.
   Flyer designs live at a guessable path `{user_id}/flyers/{roundId}/{size_id}.png`.
   The app already mints 300s signed URLs and checks ownership — but a public
   bucket lets anyone with the path fetch the raw file, bypassing all of it.
   Fix: set bucket private, drop the "Anyone can view creation assets" policy.
   (`supabase-assets-migration.sql:18,23`)

2. **Review the other public buckets:** `videos`, `logos`, `infographics`,
   `brand-assets` are all `public: true`. `videos` may need public share links,
   but `logos`/`infographics`/`brand-assets` should be private + signed.
   (`supabase-video-migration.sql`, `supabase-migration.sql`, `supabase-logo-kit-migration.sql`)

3. **Drop the anon `USING(true)` policies on `affiliates` and `referrals`.**
   These grant any anonymous caller full read/write/delete of affiliate payout
   and referral data. (Their siblings campaigns/clients/quotes were already
   fixed; these two were missed.) `DROP POLICY "Service can manage affiliates" ON affiliates;`
   and the referrals twin. (`supabase-affiliates-migration.sql:44,48`)

4. **Verify every security migration actually ran in prod.** This repo applies
   SQL by hand (no `supabase db push`), so committed RLS may never have landed.
   Run in prod and eyeball the result:
   - `SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace ORDER BY 1;`
   - `SELECT tablename, policyname, qual FROM pg_policies ORDER BY 1;`
   Confirm: brands, videos/jobs/notifications, credits, flyer_rounds/designs/chats
   are RLS-on and owner-scoped; and that the old "Anyone can view completed
   videos" policy is GONE (a later migration drops it — whichever ran last wins).

## Secrets — CLEAN. Nothing to rotate from this repo.
No hard-coded secret in the working tree or anywhere in git history. Every
`NEXT_PUBLIC_*` var is genuinely public (anon key, Stripe publishable key, URLs).
The service-role key appears only in server code, never in client code or a
response body. `.env*` is gitignored and untracked. (One caveat: the VPS's own
secrets live in a separate docker-compose config outside this repo — rotate
there if anything was ever exposed on that side.)

---

## HIGH (fix in code — any logged-in user, or a phishing target)

- **IDOR in `social-campaign`** — reads/publishes/spends on ANOTHER user's
  campaign by id, no owner check. `get-campaign`, `publish-post`, `generate-images`
  all skip `user_id` scoping. (`app/api/social-campaign/route.ts` ~196,297,344,350)
  Fix: require `campaign.user_id === user.id` before any read/generate/publish.

- **Open redirect in auth callback** — `next` query param used as
  `${origin}${next}`, so `?next=//evil.com` bounces a just-logged-in user off-site.
  (`app/(auth)/auth/callback/route.ts:8,33`) Fix: only allow `next` if it starts
  with a single `/` and not `//`.

- **SSRF in 3 authed routes** — fetch a user-supplied URL with no guard, so they
  can reach cloud-metadata (169.254.169.254) / internal services. The app HAS a
  good shared guard (`isSafePublicUrl`) — these routes just skip it:
  `extract-logo-colors:35`, `upscale-logo:56`, `brand-kit:93`. Fix: wrap each in
  `isSafePublicUrl` + manual redirect re-check (copy the `proxy-image` pattern).

- **Raw DB/error messages returned to the client** in ~70 routes, including
  public ones (`try-demo:148`, `demo-slide-gpt:128`, `quotes`, `confirm-card:32`,
  `v1/brief`). Leaks table/column names — a schema map for an attacker. Fix:
  return a fixed string, log the real error server-side only.

## MEDIUM

- **`chat_messages` fully public** — anon can read every share-page chat across
  all videos, and post. (`supabase-sharelink-migration.sql:27-28`) Scope SELECT
  to a specific video via a server route, or accept it's public by design.

- **Stored XSS via SVG logo upload** — `upload-logo` accepts `image/svg+xml`,
  served from a public bucket; an SVG can carry `<script>`. Shareable link runs
  JS in the app origin. (`app/api/upload-logo/route.ts:8`) Fix: drop SVG from
  allowed types, or sanitize server-side.

- **IDOR write in `script-chat`** — `saveRevision()` writes to another user's
  `script_revisions` by body `videoId`, no owner check.
  (`app/api/script-chat/route.ts` ~39,129,148) Fix: verify the video's owner.

- **Compliance blocklist is evadable** — plain lowercase `includes()`, defeated
  by unicode look-alikes / spacing / any carrier not on the static list.
  (`app/_lib/compliance.ts:208`) Regulatory risk (a carrier name could leak into
  a client video), not a classic breach. Fix: NFKC-normalize + strip zero-width
  before matching.

- **`extract-url:331` DNS-rebinding window** — re-fetches a previously-vetted URL
  without re-checking. Fix: re-validate on every fetch.

- **Machine-path gate is `startsWith`** — `/api/v1`, `/api/mcp`, `/api/partner`,
  `/api/checkout/create` skip the login redirect entirely (intentional — they
  self-authenticate). Safe ONLY if every sub-route checks its own secret; one
  unguarded sub-route is instantly public. Fix: add a test asserting each rejects
  an unsigned request.

## LOW

- `javascript:` scheme allowed in email-signature `website` href (self-XSS,
  clients strip JS). Allowlist http/https/mailto. (`generate-email-signature:59`)
- Filename extension trusted in storage key on `upload-logo`/`upload-photo`
  (can't traverse — scoped under `{user_id}/` — cosmetic). Derive ext from MIME.
- OpenTelemetry moderate DoS advisory in prod dep tree. `npm audit fix`.
- Impersonation magic-link returned in JSON body (admin-gated + audit-logged;
  bearer link in browser history). Consider a server-side redirect instead.

---

## What's SOLID (verified, no change needed)
- **Webhooks** — Stripe and Apex both verify signatures before trusting the
  payload; Creatomate re-fetches the authenticated render. No one can grant
  themselves credits/a plan via a forged webhook.
- **Public API keys** — SHA-256 hashed at rest, format-gated, rate-limited
  (60/key/hour), scoped to their owner.
- **Credit ledger** — atomic compare-and-set, can't go negative, idempotent
  top-ups/refunds keyed by Stripe event id — no double-spend.
- **Most of the 228 routes** — call `auth.getUser()` and scope by `user_id`.
- **Storefront split** — cosmetic only (name/nav/logo); forging a Host header
  leaks no data, because nothing keys authorization off the brand.
- **SQL & command injection** — none. Query builder is parameterised; the
  document pipeline uses `execFile` with arg arrays, never a shell string.
- **Session cookies** — httpOnly/secure/sameSite=lax defaults intact; logout,
  password reset, email change all invalidate correctly.
- **CORS** — no cross-origin headers anywhere. Same-origin only.
- **api_keys / profiles** — hashes only; profiles UPDATE blocks self-granting admin.
