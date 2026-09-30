# Docs2Video — Build State

**Last updated:** 2026-09-30 (text can't leave the frame — overflow audit of every creation system; see below) (header sections below may lag — see CODE-REVIEW-2026-07-01.md for the current architecture map)
**Branch:** main
**Build:** ✅ Compiles clean
**Deploy:** Vercel (docs2video.com, text2art.app)

## 2026-09-30 — Text can never leave the frame: every creation system audited (commit 27080db)

**Deployed 2026-09-30:** Remotion Lambda site `docs2video` redeployed (production renders go through it — `REMOTION_SERVE_URL` IS set in SSM) and the ECS service rolled to image `sha256:69039e5b…` (digest verified on the running task, healthy). Proof: the customer's failing scenes rendered on the live Lambda show the card wrapped inside its box. **Vercel (app-side: decks/PPTX/PDF, /design preview, signatures, compliance scrub in the app, v3/editorial payload builders) goes live when 27080db is pushed to `docs2video/main`.**

Trigger: customer video 590fe9f6 (infographic style) showed "100% High Cap Rate Ac" with the stat card half off the right edge — a model-written value in a card built for "$10,000", a `1fr` grid column that grew to its longest word, and `white-space: nowrap`.

**The shared fix (videos):** `remotion/src/lib/fit.tsx` — `<Fit>` (one run of text: wraps at spaces, shrinks the font until it fits the width / `lines` / box height, measured on the real rendered text in the real font; `sizeFor` sizes count-ups by the FINAL value) and `<FitBox>` (a group scaled down together to fit a box of definite height; put plain text inside, never `<Fit>`). Never overflows: below `min` it keeps shrinking to 14px and logs `D2V_FIT_SMALL`. Parents must be bounded: `minmax(0, 1fr)` not `1fr`, `minWidth: 0` in flex rows.

**The checker (videos):** `cd remotion && npm run qa:overflow [-- <filter>]` (`scripts/overflow-qa.mjs`). Renders the REAL compositions from `src/qa/cases/*.tsx` (real customer data + worst-case text + normal text per engine) with `src/qa/OverflowGuard.tsx` measuring every word: off-frame, clipped, out-of-box, box-off-frame. Release gate: `npm run qa:overflow:gate` (`scripts/overflow-gate.mjs`) — every case with `QA_OVERLAP=1 QA_SEQUENCE=4`, which also fails on text over text / text under a logo and renders 4 warm-up frames first in the same tab like a real render (caught a bar-label bug single stills missed). It runs in batches of 8 cases, one process each: a single ~700-frame run crashed Remotion's console source-map reader. A planted-broken self-test runs every time; if the guard misses any planted fault the run FAILS. `data-overflow-ok` / `data-overlap-ok` opt-outs need a reason in the attribute. Stills: `remotion/out/qa-overflow/`.

**Engines fixed (before → after):** infographic (14 → 0; also: `heroMetric` was ignored, the headline figure vanished), V3 cinematic/aurora (169 → 0; body text now stays above the corner logo), editorial/explainer/time (212 → 0; also: step numbers were invisible, bars mis-scaled), commercial all 22 styles (1062 → 0), VisualDirector (699 → 0), slide deck / DirectedVideo, the default style (2818 → 0; also: a card value "100% High Cap Rate Acct (S&P 500 Index)" showed as "100%", a date range as "10", "6.35%" as "6.4%", and `slides.js` chopped on-screen text mid-sentence — a value is now a rolling number only if it is wholly a number, and text is shortened only at a clause break), classic `/generate` fallback slide + `gemini.ts` fallback (text now wraps/shrinks).

**Presentations + decks:** `app/_lib/presentation.ts`, `presentation-exports.ts`, `pptx-generator.ts` — HTML deck 2492/4350 slide-views broken → 0 (37 decks × 10 window sizes incl. phone share player and the 1920×1080 MP4 capture); PPTX 38 → 0 boxes (sizes from real letter widths); PDF drops/encoding failures → 0. Checker: `node scripts/deck-overflow-check.mjs` (~13 min). Decks ALREADY SENT keep the old HTML until rebuilt (any edit rebuilds; a bulk rebuild needs owner OK — it writes live storage).

**Other graphics tools:** `/design` live preview headline, email signatures, brand-kit signature (`app/_lib/email-signature.ts`). Checker: `node scripts/graphics-overflow-check.mjs`. AI-drawn lettering (flyers, social, cards) can only be steered by prompt — prompts demand safe margins.

**Also fixed on the way:** `/render-editorial` dropped `timeline`/`chart`/`matrix`, so those magazine pages shipped with only a title (server.js); `isHeadlineFigure` (v3-render.ts) promoted sentences with ",000" to the giant hero number; the compliance name-scrub (both copies: `app/_lib/compliance.ts` + `render-service/slides.js`) cut detected tokens out of the middle of words — shipped videos said "or inal illness" and "The Long- Upside" — now whole words only, generic insurance words (Term, Long, Whole…) are never taken for product names, and blocklisted carriers are still stripped next to a hyphen ("AIG-backed"). Guard: `tests/compliance-word-boundary.test.ts`.

**Any future change under `remotion/src`:** redeploy the Lambda site (`cd remotion && npx remotion lambda sites create src/index.ts --site-name=docs2video --region=us-east-1`, REMOTION_AWS_* keys from .env.local in the shell) AND rebuild the ECS image (VisualDirector renders from the image, and server/slides/commercial/present-export live there) — render-service/DEPLOY.md. In Git Bash, SSM paths like `/docs2video/X` get rewritten by MSYS (ParameterNotFound) — use PowerShell.

**Known gaps (not overflow):** commercial `quote.sub` and `meet.kicker/pre/hot` are written by the director but never shown; infographic ignores recipient/contact/presenter; commercial props are deleted after render so real commercials can't be re-checked; phone share player is 341×192 (everything thumbnail-sized); retired design tools' API routes still charge credits if called directly.

## 2026-09-27 — False claims removed from the public site (branch `redesign/marketing-site`)

- Industry pages (/for/*) now share one template (`app/_components/IndustryPage.tsx`, copy in `app/_lib/industry-pages.ts`). Gone: fake user counts ("Trusted by 1,200+"), made-up stats (73%, 3.2 hrs…), fake quotes and the testimonial section, "SOC 2"/"HIPAA" features, "under 90 seconds" speeds, real carrier names. Free credits come from pricing.ts.
- Blog: unsourced stats, named studies and "close 40% faster" removed (slugs unchanged).
- Emails (welcome, nurture, referral, promo, outreach prompts): speed/"2 free videos"/"unlimited"/referral-credit claims fixed; outreach AI prompts told never to invent stats or testimonials.
- Help center + in-app: "8 layers", "stays compliant", "28 themes", "unlimited videos", "Most popular" badges → "Recommended".
- /try, signup, auth side panel, contact ("within 24 hours"), watch-page footer, brand meta description fixed. Dead FaqSection/IndustryMegaMenu (had "SOC 2 Type II") deleted.
- Header logo sizing fixed (`.mk .mk-logo-img` beats `.mk img { height:auto }`).
- Guard: `tests/no-false-claims.test.ts` scans public pages, components, help and email files for the removed claims.

## 2026-09-27 — New marketing home page (branch `redesign/marketing-site`, not deployed)

Light cream + mint page from the approved "Combo" design ("B's opening + A's page").
- `app/page.tsx` now only picks the storefront: text2art.app → `Text2ArtLanding`, everything else → `app/_components/marketing/Docs2VideoHome.tsx`.
- Sections: hero (long document in → video frame), three outputs (video / interactive presentation / slide deck), how it works, industry switcher, share page, style gallery, pricing, compare table, FAQ, final CTA.
- Shared header/footer: `app/_components/marketing/SiteHeader.tsx` (+ `MarketingMenu.tsx` phone menu) and `SiteFooter.tsx`, also used by `/for/*` (their old dark nav is gone). Header/footer links: `/#how`, `/#share`, `/#industries`, `/#pricing`, `/#compare`, `/blog`, `/pricing`, `/for/*`, `/contact`, legal pages.
- Truth by construction: prices/credits/"about N videos" from `PLANS` + `SELLABLE_PLAN_TIERS` (Starter hidden), credits per video from `CREDIT_COSTS.video`, top-up line from the plan features text, industry words/disclaimers/closing asks from `INDUSTRIES`, look names/counts from the Make step's `looks.ts`.
- Pictures: `/public/style-samples/*` frames that carry only fictional names (ACME, EPOCH). The `slides-*` samples (PubcoZone), `aurora-cover`/`aurora-closing` (Valor Financial / a real person) and `cinematic-cover` (a real policy name) are deliberately NOT used. The old hero video is no longer on the page — its frames claim "28 visual styles" and "50 explainers/mo (Pro)", which are not true.
- CSS: "MARKETING SITE" section at the end of `app/globals.css`, all scoped under `.mk` with `--mk-*` tokens. JSON-LD (SoftwareApplication with offers + FAQPage) added on the home page.
- `/for/*` pages: fixed 3- and 2-column inline grids that forced a sideways scroll on phones.
- Tests: `e2e/landing.spec.ts` rewritten for the new page (12 checks, incl. every link opens without 404/500 or a login bounce, no sideways scroll at 1440/1024/768/375). Run: `E2E_BASE_URL=http://localhost:3100 npx playwright test e2e/landing.spec.ts --project=chromium --no-deps`.
- Not done: dark mode toggle from the design (light only for now). `FaqSection`, `SharePagePreview`, `IndustryMegaMenu`, `ClickToPlayVideo` are no longer used by the home page (left in place).
- Still open on `/for/*` bodies (not touched): claims like "Trusted by 1,200+ insurance professionals" and "73% of clients…" need checking.

## 2026-09-27 — Playwright battery for the 4-step app (branch `redesign/app-4-steps`)

**How to run:** `npx next build`, `npx next start -p 3100`, then
`E2E_BASE_URL=http://localhost:3100 npx playwright test`. The config loads
`.env.local` (TEST_EMAIL / TEST_PASSWORD) and signs in once (`e2e/auth.setup.ts`).
Screenshots go to `E2E_SHOTS_DIR` (default `test-results/shots`).

**Safe on the live database:** `e2e/helpers/guard.ts` blocks every call that
spends credits, charges a card, sends email/SMS, deletes the account or
replaces real photos unless a test mocked it, and fails the test if one gets
through. View tracking is answered quietly (test visits never count as views).
Tests that create things (one draft, one profile, one client) remove them with
the app's own Discard / Delete buttons. Opt-in only: `RUN_VIDEO_E2E=1` (real
video), `E2E_ALLOW_STRIPE_SESSIONS=1` (real Stripe sessions), `E2E_SKIP_REAL_AI=1`
turns off the one real story-writing run.

**Specs:** `redesign-home`, `redesign-step1-about`, `redesign-step2-story`,
`redesign-step3-make`, `redesign-step4-send`, `redesign-layout` (rail, 1440 +
375, screenshots), `redesign-journey` (one real run), `app-settings`,
`app-pages` (brands, clients, library, pricing, help), `share-and-crawl`
(share page + every internal link signed in and out), plus the older specs
updated to the new flow. Old `create`, `dashboard`, `integration` specs removed
(old wizard; some spent real money).

**Bugs found and fixed:**
- Settings accepted `http://` booking/payment links and said "Saved"; the share page only shows `https://` → buttons never appeared. Now refused (bd70770).
- Opening a brand profile with a logo but no logo kit started a full OpenAI logo kit every visit (the kit isn't shown anywhere) — ~90 calls in one crawl. Removed; upload still makes it (7362234).
- Brand delete removed the card even when the delete failed (be158a7).
- Library showed drafts as "Processing" and Open went to the finished-video page; file links were prefetched (404s, storage 429s) (6cd14c6).
- "Send to Your Client" and other in-app pop-ups sat under the sticky top bar — close button unclickable on laptop-height screens; long video titles made the page scroll sideways on phones (bc4990e).

**Proved the checks can fail:** 11 deliberate bugs were built into the app;
all 11 turned tests red (4 checks were strengthened first because they
passed for the wrong reason).

## Audit 2026-09-26 — everything fixed, and what the owner must do (`AUDIT-2026-09-26.md`, branch `fix/audit-2026-09-26`)

One section for the whole audit (five fix branches plus the follow-up pass).
Nothing below is live until the branch is deployed AND the owner checklist at
the end is done.

### What is fixed

**Money and credits**
- One spend rule for every product (`spendBlockReason` in `checkCredits` + `deductCredits`): no card on free/trial, `past_due` or banned = can't spend. generate-video no longer has its own copy; it turns the shared answer into `card_required` / `payment_past_due` / `account_blocked` (the theme page still sends `card_required` to `/setup-payment`). Trial converts inside `deductCredits` / `checkCredits` from any product.
- Charge-first + refund-once-on-failure for 13 one-off tools (`app/_lib/credit-charge.ts`); tools that charged 1 credit now charge real prices.
- The stuck-video cron refunds only what the ledger proves was charged (`app/_lib/video-billing.ts`), never a number a user typed (C1).
- Refunds are keyed per attempt: presentation builds, MP4 exports and narration-edit fees each have their own charge/refund pair (`refundLedgerCharge`), so they never collide with each other or with a video refund.
- **Restart Generation** goes through `POST /api/videos/{id}/restart`: marks the stuck run failed, refunds its ledger-verified charge, then sets it back to pending — restarting no longer charges twice.
- generate-video refuses before claiming the row and prices from the saved draft (C4).

**Stripe**
- Plan changes never create a second subscription (`app/_lib/subscription-checkout.ts`); `/api/confirm-card` checks the SetupIntent with Stripe; the webhook throws on any failure so Stripe retries; refunds/disputes claw back commission and revoke credits in proportion; incomplete checkouts grant nothing; only the subscription on file can change a plan.
- Apex buyers are matched to an existing account by their **sign-in (auth) email**, not the editable `profiles.email`; an unconfirmed match gets the set-password email so the real inbox owner can take it over.
- Apex welcome email's button now opens `/auth/confirm?token_hash=…&type=recovery&next=/reset-password` — a real set-password page (it used to land on login). A failed send is logged.
- Account delete cancels Stripe first; promo revoke is safe; only Pro/Business/Enterprise are sold anywhere (`SELLABLE_PLAN_TIERS`).

**Sign-in and security**
- New `/reset-password` page (outside the dashboard) and `/auth/confirm` (works on any device); welcome email only after confirmation; `?next=` honored after login.
- Public pages reachable logged out (`app/_lib/public-paths.ts`); `/admin` gated on the server; Gmail/Outlook connect uses signed state (C7); SMTP limited to public mail servers; secrets encrypted when `DATA_ENCRYPTION_KEY` is set.
- Profiles and videos column guards (migrations below) stop the browser writing paid, identity or billing columns.

**Clients, emails and share page**
- Automatic follow-ups are **off by default** and turned on per quote; opt-in, one email per stage, signed unsubscribe, stop on paid/accepted/declined.
- Every Resend send is checked (Resend v6 returns errors instead of throwing): share emails, contact form, admin campaign/nurture/promo-user, daily digest, weekly report, referral prompt, error alerts, Apex welcome. Failures are logged; people waiting are told.
- Share page: only `https://` booking/payment links become buttons (the public watch API filters them too, and now passes the per-video links through); slide decks render as decks; edits never take a live link down.
- Follow-up share links always use the configured site address, never `VERCEL_URL`.
- Client intelligence reads the real columns (`sent_emails.to_email/created_at`, `video_views.opened_at`).
- View alerts: owner's own views ignored, per-viewer cooldown, agent setting.

**Wizard and rendering**
- Brief "Skip" really skips; scripts run in the background; drafts keep the source PDF and use every uploaded file; drafts **with a script are kept 14 days** (24 hours without).
- Slide Deck videos use the user's voice, music, length and edited script (render service change — needs the redeploy below).
- `WizardDraft` type now lists every field the wizard and server write.

**Copy and help**
- Pricing text matches `pricing.ts` everywhere (no $29 Starter, no "$10 per video", no "save 60%"). No share-page chatbot, no password-protected links, no "print-ready" promise (print upscaling needs `FAL_KEY`).
- Help center: reset password, Google booking-page links, drafts, follow-ups, Slide Deck choices, Restart Generation; branded 404/error pages; SEO metadata; orphan tools redirect.

### Owner checklist

**1. Run these migrations by hand in the Supabase SQL editor, in this order** (production does not run `supabase db push`; each is safe to run twice):
1. `20260926_revoke_credits_atomic.sql` — atomic "take credits back" after a Stripe refund/chargeback, from both balances. Without it: a slower fallback runs (works, but two refunds at once could race).
2. `20260926_client_emails_followups.sql` — follow-up/email-type columns, per-quote follow-up switch, suppressions, view-alert setting. Without it: automatic follow-ups never send, the view-alert setting can't save, unsubscribes can't be recorded.
3. `20260926_card_on_file_backfill.sql` — marks everyone who has paid through Stripe as having a card. **Run before (or right with) the deploy.** Without it: past subscribers who cancelled are told "Add a card" and can't spend credits they still have. (It marks its own transaction as the service role so the profile guard lets it through.)
4. `20260926_videos_column_guard.sql` — the database refuses browser writes to video billing columns and most status changes. Without it: nothing breaks (the code already blocks the exploit); this is the second lock.
5. `20260926_profiles_guard_v2.sql` — the database refuses browser writes to paid/identity/link columns on profiles (add-on flag, social workspace ids, email, referral, plan). Without it: a user could edit those from the browser; the add-on is still checked against Stripe.

**2. Environment variables (Vercel)**
- `NEXT_PUBLIC_SITE_URL=https://docs2video.com` (email links, share links, Apex set-password link).
- `DATA_ENCRYPTION_KEY` — encrypts SMTP passwords and Gmail/Outlook tokens. Never change it once set.
- Optional: `OAUTH_STATE_SECRET`, `EMAIL_UNSUBSCRIBE_SECRET` (changing it later breaks unsubscribe links already sent).
- `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_REDIRECT_URI` if Outlook connect should work (the button hides without them).
- `FAL_KEY` (Vercel and SSM `/docs2video/FAL_KEY` for the renderer) if print upscaling is wanted.

**3. Render service redeploy** — `render-service/server.js` and `slides.js` changed (Slide Deck uses the user's script/voice/music/length; queued jobs stay alive). Deploy per `render-service/DEPLOY.md` (ECS Fargate, CodeBuild image, then force a new deployment of service `video-service`). Until then Slide Deck videos ignore the chosen voice/music/script.

**4. Supabase dashboard**
- Auth → URL configuration → Redirect URLs: add `https://docs2video.com/auth/confirm`, `https://docs2video.com/auth/callback` and `https://docs2video.com/reset-password`.
- Auth → Email templates: "Reset password" → `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`; "Confirm signup" → `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/setup-payment`.
- Run `node scripts/fix-private-logo-urls.mjs --apply` once to repair old private logo links.

**5. Stripe — check by hand for customers already double-billed.** The old "Switch plan" could leave two live main-plan subscriptions on one customer, or a leftover 365-day trial next to a paid plan. In the Stripe dashboard, look for customers with more than one active/trialing main-plan subscription; cancel the extra and refund what it charged. New code only prevents new ones.

## 2026-09-16 — Infographic slides on fal, real logo pinned by code

Explainer slides are drawn by `app/_lib/slide-engine.ts` now (fal
gpt-image-2.5, Gemini as fallback), and the real logo is composited into a
reserved corner by `app/_lib/logo-space.ts`.

**The logo bug.** `generateSlide()` in `app/_lib/gemini.ts` accepts a
`logoBuffer` and never uses it — declared, referenced nowhere. The logo was
either absent or AI-drawn.

**Measured, both engines, same hard slide** (proper nouns, "$4,280 to $4,715",
"10.2%", a semicolon, a date):

| | fal | Gemini |
|---|---|---|
| every character right | yes | yes |
| reserved corner | 0.6 variation | 0.9 |
| size returned | 1920x1088 | 2752x1536 |
| cost/slide | 3.7c | ~4-6c |

fal wins on LAYOUT (numbered badges, clearer hierarchy), not on text — the
"cheap models treat text as decoration" note in this repo was measured on
flyers, not slides. Gemini also needed `imageConfig` or it returns 1376x768,
below a 1080p frame.

**Env:** `FAL_KEY` added to `render-service/ecs-task-definition.json` and
`render-service/docker-compose.yml`; `SLIDE_IMAGE_ENGINE` defaults to `fal`.

**NOT YET DONE:** the SSM parameter `/docs2video/FAL_KEY` still has to be
created — see render-service/DEPLOY.md. Until it is, the renderer falls back to Gemini
(loudly, in the container log).

## 2026-09-16 (later) — Palette from the logo, footer art, dark closer

Second pass on the home page, bringing it fully in line with restylez.app
and restylez.app/decks.

- **Palette re-sampled FROM the new logo** rather than the retired one. The
  old tokens were a muted teal (#3BB5C8) taken from the previous mark;
  measured off the new artwork the brand is navy #002B63, cyan #00A0E0 and
  orange #F07000. Token NAMES are unchanged (--mint is now cyan) because they
  appear in hundreds of call sites and renaming buys no behaviour.
- **Kickers are large italic lines**, not small uppercase labels — the device
  the sibling sites use to announce a section.
- **Footer** gets the new logo and a giant faded wordmark under the links.
- **The closer is the dark moment of the page**: navy ground, white type, cyan
  on the italic. It had been navy on pale teal, and the palette change
  destroyed that contrast.

THREE CONTRAST BUGS the palette change caused, all fixed: the closing heading,
its CTA button (.btn-primary is navy, so it vanished on navy), and its perks
row, whose labels lost to a more specific existing rule. A whole-page contrast
sweep now reports nothing below 3:1.

## 2026-09-16 — Home page overhaul + new logo

The marketing page at / was rebuilt to match the scale of its sibling sites
(restylez.app, restylez.app/decks). Same cream + mint palette, same 10px
control radius, same Plus Jakarta Sans + Instrument Serif — what changed is
SCALE and RHYTHM:

- **Hero is centred.** It was a left-hand text column beside the video, with
  `.hero-split` capping the headline at 56px while the base rule already
  allowed 84. The promise now runs full width at up to 92px and the video sits
  beneath it as proof. A receipt line lists every input format.
- **Sections are panels.** Every one ran on the same flat ground, so a long
  page never arrived anywhere. They alternate white / soft now, each its own
  rounded object. Section headings went 44px -> up to 60px.
- **New logo** (`public/logo-new.png`, 2035x773). Served as `logo-nav.png`
  (h180) and `logo-big.png` (h340) — the source is 1.8MB, far too heavy for a
  62px nav mark. All 9 references across 7 files plus `app/_lib/brand.ts`
  (which drives the signed-in header) now point at the resized copies.

Nothing about routing, data or the Text2Art branch was touched.

## 2026-08-23 — Text2Art deck AI: tells a story, and the logo stays put

The "make a deck from words/paste" path was rebuilt in three phases after the
customer verdict "eight generic slides, not a cohesive presentation — I told it I
wanted an investor's deck." All three deck callers (wizard, `/api/v1/decks`, MCP
`create_deck`) improve at once because they share `planDeck()`.

- **Phase 1 — story planner** (`app/_lib/deck-plan.ts`, `app/api/flyer-deck`).
  `planDeck` now first works out the deck's purpose (investor/sales/training/
  report/all-hands/talk), audience, one-message and usable facts, then lays the
  slides along the matching narrative arc, each carrying a one-line purpose.
  Brief cap 4k→24k chars; slide count is a RANGE by length (short 5–7 / medium
  8–14 / long 15–24), no more "EXACTLY 8" and no placeholder padding. Honesty
  block overrides the arc (skips a beat rather than fabricating). Proven on a 9k
  investor brief: purpose=investor, Long=18 / Short=7, every figure traced.
- **Phase 2 — length choice + visible plan** (`design/content/page.tsx`). The
  words step now asks Short/Medium/Long, plans, and shows the running order
  (title + purpose per slide) with per-slide Remove and a re-length escape,
  BEFORE anything is drawn or charged.
- **Phase 3 — pinned logo** (`app/api/flyer-art`, `deckGenerate.ts`, DeckSlide
  gained `role`). Body slides no longer hand the logo to the image model; it's
  composited in code at a fixed top-right corner (14% width, 4% margin), so it
  can't wander. Cover/closing keep the model's hero placement. Works for uploaded
  (data URL) and brand (stored URL) logos. Proven by pixel check: the logo's
  bounding box is byte-identical across body slides, and the check flags the old
  wandering placement as inconsistent (so it can fail).

Commits: bd83eb8, b914877, 8522821. Docs: TEXT2ART-WORKFLOW.md + flyers help
article updated. Not yet exercised: a full live draw-a-real-deck run (costs
credits; left for owner to run on the deployed build).

## 2026-08-09 — Text2Art: second storefront on the same codebase

One app, two front doors. `text2art.app` sells the existing Custom Graphics tool
(`/flyer`) on its own; `docs2video.com` is unchanged. Auth, credits, Stripe,
admin and the database are shared — a person has ONE account and ONE credit
balance across both.

**Where the switch lives (one place):**
- `app/_lib/brand.ts` — the `Brand` object and `brandFromHost()`. Import-free so
  both client and server can read it. Every host-dependent decision (name, logo,
  landing page, nav, whether video features are advertised, where a signed-in
  user lands) is a FIELD here. Do not add `if (host === …)` anywhere else.
- `app/_lib/brand-server.ts` — `getBrand()`, reads `x-forwarded-host`/`host`.
- `app/_components/BrandProvider.tsx` — root layout reads the host once and
  passes the brand to client components via `useBrand()`. Client components must
  never sniff `window.location` (hydration mismatch).
- **Unrecognised host ⇒ Docs2Video.** Previews, localhost and a missing Host
  header all behave exactly as before. `NEXT_PUBLIC_BRAND=text2art` forces the
  other brand for local dev only.

**Files changed:** `app/_lib/brand.ts` (new), `app/_lib/brand-server.ts` (new),
`app/_components/BrandProvider.tsx` (new), `app/_components/Text2ArtLanding.tsx`
(new), `app/layout.tsx`, `app/page.tsx`, `app/sitemap.ts`,
`app/_components/Header.tsx`, `app/(dashboard)/layout.tsx`,
`app/(dashboard)/dashboard/page.tsx`, `app/(auth)/layout.tsx`,
`app/(auth)/login/page.tsx`, `app/(auth)/setup-payment/page.tsx`,
`app/(onboarding)/layout.tsx`.

**Routing on text2art.app:** `/dashboard` redirects to `/flyer`. That is the one
choke point — login, signup, the auth callback, the onboarding wizard and
proxy.ts all send people to `/dashboard`, so none of them needed changing. The
video-only setup wizard is skipped (`app/(onboarding)/layout.tsx`) because it
asks for a narrator voice and a slide style.

**Landing page** (`/` on text2art.app) is public and uses the REAL pre-generated
samples in `public/flyer-templates/*.png` plus the live values from
`flyer-engine` (225 styles, 15 sizes, photo roles) and `credits.ts` (200 credits
per design). It states the card-on-file requirement and the "read it before you
print" caveat rather than overselling.

**No database change.** No migration, no new table, no new column, no new env
var. Trent only needs to add the domain in Vercel and point DNS.

**Not done / known gaps:** no Text2Art logo artwork (the header renders a text
wordmark); `/terms`, `/privacy`, `/cookies`, `/contact`, `/help` and billing
emails still carry Docs2Video wording on both hosts; `NEXT_PUBLIC_SITE_URL` is
still docs2video.com, so links inside emails point there.

## 2026-08-05 — Presentation editing (manual + AI) and display fixes
- **New: post-generation slide editor** at `/videos/{id}/edit` for interactive
  presentations and slide decks. Manual editing of headline/bullets/narration
  per slide, add/delete/reorder, plus an AI instruction bar (whole deck or one
  slide) via new `POST /api/ai-edit-scenes` (Claude; edits, never authors —
  forbidden from inventing figures). Rebuild goes through
  `POST /api/reedit-presentation` → internal `/api/generate-presentation`, so
  the compliance scrub applies to edits identically. Pricing: text-only rebuild
  FREE; narration changes bill at `slide-scene-fix` (50) per changed slide,
  capped at 300; server-side quote (`quoteOnly`) shown on the button before the
  user commits; refund on failed rebuild. "Edit slides" is the first button on
  the presentation detail page.
- **New: whole-deck AI bar on the wizard script step** — the per-scene
  SceneEditChat existed, but nothing could do cross-slide edits ("add a slide
  about pricing"). Uses the same `/api/ai-edit-scenes`.
- **Fix: SLIDES (0)** — generate-presentation only filled `draft_data.scenes`;
  the detail page counts from `videos.script`. The generator now writes both;
  `scripts/repair-presentations.mjs` backfilled all 13 existing rows in prod.
- **Fix: slide content under the nav / titles under the corner block** — slides
  were flex-centered and overflowed through their padding; now safe-centered
  (margin:auto) with measured chrome lanes (88px top / 128px bottom). Standing
  disclaimer width capped so it can never run beneath the nav pill. The repair
  script also patched the 11 published HTML decks in storage (2 older-vintage
  files left untouched rather than guessed at).
- The help pages' "AI editor" description (FAQ + creating-videos) is now TRUE —
  previously it promised a feature that did not exist, which is where the
  "users can't edit slides" complaints came from.

## 2026-07-07 — Narrative-first two-pass script generation (fixes "disjointed slide reading")

Root cause: solo-narrator prompt ordered scenes to be "SELF-CONTAINED... WITHOUT referencing other scenes" and to narrate "EXACTLY what is on that scene's slide — nothing more, nothing less" (added for slide-sync), which overrode the storytelling/arc rules → 8 isolated blurbs. Also, narration was written in the same pass as slide layout JSON, and a per-scene "editor" pass re-fragmented whatever flow survived.

Fix in `script-generator.ts` (solo mode; podcast unchanged; output shape unchanged so TTS/slides/render untouched):
- **Pass A (storyteller, `claude-opus-4-8`)**: writes the ENTIRE narration as one continuous monologue — arc, transitions, "so what" — grounded by the same data-integrity rules. ~+$0.05/script.
- **Pass B (segmenter, Sonnet)**: cuts the story at topic boundaries VERBATIM and derives each slide FROM its segment → narration matches its slide by construction; forward-preview sentences are moved to the next scene instead of banned.
- Sync rules softened everywhere: only forward previews banned; backward references/transitions encouraged.
- Editor polish pass now runs on the LEGACY path only (it would shred the story). Durations computed in code (words/2.5) on the story path — model estimates were wildly off.
- Fallback: if the story pass fails, legacy single-pass runs (with the self-contained rules removed there too).
- Verified live (`scripts/test-narrative-script.ts`): 336-word story → 7 scenes, 100% verbatim retention, correct durations, flowing narration with callbacks and build.
- Existing videos keep old scripts — regenerate to get the new narration.

## 2026-07-06 — Hero-number clipping fix (deployed to VPS)

Dynamic stat values rendered at fixed sizes (`v3/HeroMetric.tsx` 320px, `scenes/StatScene.tsx` 260px) clipped long figures like "$176,204.18" at the frame edge. Both now measure with `@remotion/layout-utils` `fitText` and scale down to fit (≤1560/1600px width), capped at original size; `whiteSpace: nowrap`. Swept all other template families — only remaining large fixed text is a static decorative quote glyph (editorial). Deployed via `render-service/redeploy.sh` (SSH key: `~/.ssh/apex_deploy`, now set in ~/.ssh/config as IdentityFile); verified `fitText` present in the RUNNING container. Existing videos need a re-render to pick up the fix.

## 2026-07-05 — Apex (reachtheapex.net) integration, Path B (spec: DOCS2VIDEO-INTEGRATION-SPEC)

D2V keeps its own Stripe; attributed sales are reported to the Apex MLM comp engine over signed webhooks. Affiliates owned by Apex reps are flagged `payout_via='apex'` — commission rows recorded for audit, never paid locally.

- **`app/_lib/apex.ts`** — HMAC sign/verify (shared `APEX_WEBHOOK_SECRET`, SHA-256 hex in `x-webhook-signature`), `sendApexSaleEvent()` (withRetry, 10s timeout, non-fatal), `provisionApexAffiliate()` (slug→referral_code, creates auth user by email + Stripe coupon/promo, `payout_via='apex'`).
- **`app/api/partner/apex/affiliate`** — signed provisioning endpoint Apex calls lazily per rep. 409 if the code belongs to an existing direct affiliate.
- **Stripe webhook** — at the 3 commission touchpoints, freshly recorded commissions for apex affiliates emit `sale.created` (session id), `sale.renewed` (invoice id), `sale.refunded` (from clawback rows). Dedupe rides commission idempotency + Apex's (external_source, external_ref) unique.
- **Payout suppression** — admin export-csv and mark-paid exclude `payout_via='apex'`; GET includes the flag.
- **`/r/{code}`** — regex relaxed to `^[A-Z0-9][A-Z0-9-]{2,31}$` (Apex slugs contain hyphens).
- **SQL to run manually in prod** (migration drift!): `supabase/legacy/supabase-apex-integration.sql` (adds `affiliates.payout_via`).
- **Env needed:** `APEX_WEBHOOK_SECRET` (shared with Apex's `integrations.webhook_secret` row), optional `APEX_INTEGRATION_URL` override.
- **Apex repo side** (already present there): products d2v-starter/pro/business/enterprise, `prismgraphs` integrations row, `processD2VSale/Refund`; added: `/api/dashboard/docs2video-link` (lazy provisioning), D2V link in ai-chat links tool + ReferralInfoTab.
- **RESOLVED 2026-07-05:** the suspected tier mismatch was stale docs, not code — `pricing.ts` (source of truth) has exactly free/starter/pro/business/enterprise at $0/29/79/199/499, matching the spec table and Apex's `TIER_TO_SLUG` + seeded product rows (verified live in Apex prod DB: 2900/9bv, 7900/21bv, 19900/50bv, 49900/122bv). CLAUDE.md's old 6-tier table was corrected.
- **GO-LIVE DONE 2026-07-05:** `supabase/legacy/supabase-apex-integration.sql` run on D2V prod (payout_via verified); `APEX_WEBHOOK_SECRET` set in Vercel (production) + `.env.local`, value = Apex's `integrations.webhook_secret` for prismgraphs.
- **E2E TEST PASSED 2026-07-05** (`scripts/apex-e2e-test.ts`, Stripe test mode, local Apex dev server, real prod DBs, test data cleaned up after): provisioning → affiliate payout_via='apex' + test promo ✓; sale.created/renewed → Apex orders (external_ref, paid, BV 21) + PV/GV 158 ✓; refund → order refunded + clawback row + PV/GV back to 79 ✓; duplicate event → idempotent 200 ✓; engine-eligibility filter matched 1 paid order ✓.
- **Found+fixed Apex-side bug during E2E:** `processOrderClawback` reversed member PV/GV by total_bv on top of `processD2VRefund`'s price-based reversal (double dip, PV came out 58 instead of 79). Fixed in Apex `clawback-processor.ts` — volume reversal now skipped for external-source orders.
- **Still needed to be live:** deploy D2V (git push → Vercel) and deploy the Apex repo (includes the clawback fix); Stripe *live-mode* promo attribution not yet exercised (E2E used test mode).

## 2026-07-04 — Admin back office rebuilt with sidebar navigation

- New `app/(dashboard)/admin/layout.tsx`: persistent left sidebar wrapping all 14 admin routes. Groups: Overview (the 8 index tabs), Money (Costs/Revenue/Billing & Sales/Billing Health), Growth (Campaigns/Prospect Pipeline/Bulk Generate/Affiliates), Platform (API Keys/Help Articles/System Status/Logs).
- Admin index tabs now URL-driven: `/admin?tab=users` etc. (`useSearchParams`, validated against a whitelist, wrapped in `Suspense`). Deep links to specific tabs now work; the old in-page button rows were removed.
- Tab switching side effects (search/filter reset, settings load) moved to a `useEffect` on the tab value.
- Sidebar styles added to `globals.css` (`.admin-shell`, `.admin-sidebar`, `.admin-nav-*`) — cream/mint palette, 10px radius, sticky ≥900px, wraps to a horizontal block on mobile.
- No route or auth changes; `npx tsc --noEmit` clean.

## 2026-07-01 — Full code review + top-10 hardening (commit ea77d13)

Full-codebase review in `CODE-REVIEW-2026-07-01.md`. Fixed in one pass:
- **Refunds:** VPS-failed renders now actually refund (cron sweeps `failed` + `deducted_cost>0`; refund zeroes the marker); refund idempotency is per-charge so retried videos refund correctly.
- **Render isolation:** per-video `--props` for /render-v3 AND /render-editorial (shared props file = cross-video content leak); render queue (one Chrome fleet at a time); TTS pool of 3 + ElevenLabs retry (no mixed narrators); allSettled asset fan-out (no orphaned files); 120s Gemini timeouts; editorial page thumbnails via ffmpeg frame-grab instead of N Chrome boots.
- **Stripe webhook:** `social_addon` guarded in ALL handlers (was silently upgrading free→Pro and blocking accounts on a failed $50 invoice); renewal grants derive tier from the invoice price id (dunning recovery no longer grants free tier).
- **Security:** committed fallback API secret removed everywhere (VPS fails closed); LIVE keys stripped from video-service/docker-compose.yml (**ROTATE: API_SECRET, Supabase service-role, Gemini, OpenAI**); constant-time VPS auth; brands RLS migration (`supabase/migrations/20260701_brands_rls.sql` — **run manually in prod**) + owner-scoping on all 14 brand fetches; DOMPurify on chatbot HTML.
- **Correctness:** generate-video claim requires ownership; `prompt_versions` (column missing in prod) split out of the critical script persist, which is now error-checked.
- **Tests:** +25 unit tests (webhook guards, tierFromPriceId, displayProgress, video cost/grandfathering).

**2026-07-01 (second pass, commit 3944e69) — ALL deferred findings fixed:** B10 (Lambda parallel assets + maxDuration 800), B11 (forceNewCycle grants on checkout/trial-conversion), B13 (CAS-atomic tier/monthly grants), B14 (recharge-on-approve via retry-video chargeOwner), B15/B16 (change_plan allowlist + reset ledger), B18 (MPEG2-aware mp3 parser), B21 (banned-user gate), B22 (completed-after-refund re-deduct in cron), P3 (listAllStripe pagination in billing/revenue/stats), Q3 (requireAdmin across all 38 admin routes + debug-videos; isAdmin split to client-safe admin-emails.ts), S6 (durable rate_limit_hit RPC + try-demo/capture-lead/track-view wired — **run supabase/migrations/20260701_rate_limits.sql in prod**), A3 (stale video-service/ tree deleted; compose template at render-service/docker-compose.yml).

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

Updated 2026-09-26. Source of truth: `app/_lib/pricing.ts` (plans), `app/_lib/credits.ts`
(`TIER_CREDITS`, `CREDIT_COSTS`), `app/api/credits/buy/route.ts` (packs),
`app/api/stripe/checkout/route.ts` (what is sellable: pro/business/enterprise).

| Tier | Monthly | Credits | ≈ standard videos (1,000 cr) | Sold? |
|------|---------|---------|------------------------------|-------|
| Free | $0 | 2,000 one-time (card required) | 2 | signup |
| Starter | $29 | 5,000/mo | 5 | **retired** — existing subs only |
| Pro | $79 | 25,000/mo | 25 | yes |
| Business | $199 | 75,000/mo | 75 | yes (white-label share pages) |
| Enterprise | $499 | 200,000/mo | 200 | yes (white-label share pages) |

Extra usage = one-time credit packs for everyone (free included): $10 / 2,500 · $25 / 7,500 ·
$50 / 18,000, never expire. There is NO per-video overage fee; the `extraVideoPrice` /
`overageRatePer1000` fields in pricing.ts are legacy and must not be quoted to customers.
AI Social add-on: $50/mo, plus 25 credits per caption set and 25 credits per platform per post.

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
| Stripe Promo | `STRIPE_PROMO_WELCOME50` | Promotion-code id auto-applied by `?promo=WELCOME50` (falls back to the old live id only on a live key) |
| Stripe Projects | `STRIPE_PRICE_PROJECT`, `STRIPE_PRICE_PROJECT_PRO`, `STRIPE_PRICE_COURSE`, `STRIPE_PRICE_COURSE_PRO`, `STRIPE_PRICE_COURSE_BIZ` | Per-project prices |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Gmail, Google Calendar |
| Microsoft OAuth | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_REDIRECT_URI`, `MICROSOFT_TENANT_ID` | Outlook/365 email |
| Kie.ai | `KIE_API_KEY` | Suno music generation |
| Resend | `RESEND_API_KEY` | Email delivery |
| Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | SMS notifications |
| Video VPS | `VIDEO_ASSEMBLY_URL`, `VIDEO_ASSEMBLY_SECRET` | External FFmpeg server |
| Public API | `INTERNAL_API_SECRET` | Trusted header for v1 API → internal route calls (required to enable `/api/v1`) |
| App Config | `NEXT_PUBLIC_SITE_URL`, `ADMIN_EMAIL`, `IMAGE_MODEL` | App settings |
| Encryption at rest | `DATA_ENCRYPTION_KEY` | AES-256-GCM key for SMTP passwords + Gmail/Outlook tokens (`app/_lib/secret-box.ts`). Optional — unset = stored plaintext with a warning. Never change once set. |
| OAuth state | `OAUTH_STATE_SECRET` | Optional HMAC key for Gmail/Outlook connect `state`; falls back to a key derived from the service-role key |
| Unsubscribe links | `EMAIL_UNSUBSCRIBE_SECRET` (optional; falls back to `CRON_SECRET`, then the service key) | Signs unsubscribe links. Changing it breaks links already sent. |

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
- **Migration**: `supabase/legacy/supabase-clients-migration.sql` (run against Supabase to create tables + RLS)

### Public Video-Generation API v1 (added 2026-06-12)
- **Purpose**: let other apps generate videos/PPTX/PDF from text, URL, file upload, or an AI idea — programmatically.
- **Auth**: `Authorization: Bearer d2v_live_…`. Admin-issued keys only; SHA-256 hash stored, raw key shown once.
- **Credit pool**: separate metered `api_credit_balances` (NOT the UI `credit_balances`). Charged on accept, auto-refunded on failure.
- **Endpoints**: `POST /api/v1/videos` (async → `job_id`), `GET /api/v1/videos/[id]` (poll), `GET /api/v1/credits`.
- **Reuse**: v1 routes call the existing extraction + generate-video routes server-to-server with an `x-internal-service` trusted header (`INTERNAL_API_SECRET`) + `x-internal-user-id`. Those routes gained a guarded internal-auth branch (`resolveRequestUser` in `app/_lib/api-auth.ts`) that acts as the resolved user and skips UI-credit gates (already metered at v1 layer). No refactor of working generation logic.
- **Webhook callback**: optional `webhook_url` in the create body; `app/_lib/api-webhook.ts` POSTs the job payload on completion/failure (fires on the Creatomate v2 path + the generate-video failure path; poll is the source of truth on the legacy VPS path).
- **Admin UI**: `/admin/api-keys` (page) + `POST/GET /api/admin/api-keys` — create/revoke keys, top up the API pool.
- **Migration**: `supabase/legacy/supabase-api-migration.sql` (api_keys, api_credit_balances, api_usage_log + indexes, RLS-deny).
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
- **Migration**: `supabase/legacy/supabase-affiliate-migration.sql` (extends `affiliates`; adds `affiliate_commissions`, `affiliate_clicks`; RLS-deny). Built against the LIVE `referrals` shape (affiliate_id, referred_user_id, status, commission_amount, commission_paid).
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
- **Migration**: `supabase/legacy/supabase-pipeline-hardening-migration.sql` (videos.deducted_cost, creatomate_render_id, creatomate_render_url, progress_updated_at).
- Audit dropped 2 false-positive criticals; V2 is the safer pipeline once these ship.

### Go-Live Checklist — API v1 + Affiliate Program
These features are code-complete and build clean. Setup status:
- [x] **Run `supabase/legacy/supabase-api-migration.sql`** in Supabase (creates `api_keys`, `api_credit_balances`, `api_usage_log`). DONE 2026-06-13.
- [x] **Run `supabase/legacy/supabase-affiliate-migration.sql`** in Supabase (extends `affiliates`; adds `affiliate_commissions`, `affiliate_clicks`). DONE 2026-06-13.
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

1. E2E suite rewritten for the 4-step app on 2026-09-27 (see the section at the top). Action cards on Home, the first-visit screen and the billing-portal button can't be exercised with the current test account (it has none of them).
2. Logo kit generation is async — may not complete before user navigates away. Also: after a logo upload on the brand page the kit is made from the logo SAVED on the profile (the new one isn't saved until "Save"), so the first kit is built from the old logo — or fails on a first upload. The kit isn't shown anywhere in the app; owner to decide whether to keep it.
3. ⚠️ ACTION REQUIRED: Cartesia API key `sk_car_q3LX...` was committed to git history (commit ff100f4) — rotate it in the Cartesia dashboard and set `CARTESIA_API_KEY` env var on the VPS. Code no longer hardcodes it.
4. `app/_lib/music-generator.ts` and `synthesizeAllScenes` in `app/_lib/tts.ts` are dead code — music/TTS for the main pipeline run on the VPS. Candidates for removal.
5. Webhook idempotency unique index: run `supabase/legacy/supabase-webhook-idempotency-migration.sql` against the DB.
6. `FAL_KEY` is not set in production → print sizes in Custom Graphics are resized, not AI-upscaled (lettering can look soft on posters/signs). `upscaleForPrint` logs "upscale skipped … no FAL_KEY configured". Fix: set `FAL_KEY` in Vercel. No page promises print-ready output or upscaling any more.
7. Outlook connect needs the `MICROSOFT_*` env vars in production (the button is replaced by a note until they are set).
8. The Library (`/videos`) has no link to `/infographics` (legacy infographic gallery); it is reachable from the infographic email only.
9. A stuck run that is restarted keeps going on the render service if it was actually alive; if it later fails on its own it refunds by charge number, which can give back the NEW run's charge too. Rare (needs a stuck-looking run that then fails), and in the customer's favor.
10. Audit 2026-09-26: see the consolidated section at the top — migrations, env vars, render-service redeploy, Supabase settings and the Stripe double-billing check are still owner to-dos.

### Audit 2026-09-26 — content / pricing / help / nav / SEO details

- **Pricing truth** — customer-facing plan statements match pricing.ts + credits.ts (help center, Text2Art landing, /pricing, /plans, setup page, settings plan cards, upgrade modal, help-chat prompt). Removed claims the code never enforced (priority generation, free slide edits, bulk creation).
- **Commercial "Buy more"** opens the top-up modal (was a 404).
- **AI Social** in the account menu (desktop + mobile; "Add-on" tag if not subscribed); posting cost disclosed.
- **Nurture emails** — no more "no card needed"; the discount code is entered at checkout.
- **Orphan tools retired** — /headshot, /logo-creator, /templates, /infographic-creator, /email-signature, /image-remix, /course-builder, /brand-kit → home; /ads, /business-cards → /design; /social-kit, /social-campaigns → /social-media. Each via a `layout.tsx` that redirects before the page renders (delete the layout to restore). Their APIs still exist.
- `/api/demo-slide-gpt` and `/api/template-demo/generate` require an admin.

## Product Focus (2026-06-11)

Owner decision: the product is **document-to-video + PPT deck maker** only.
- Peripheral tools (social media, course builder, headshots, image remix, infographics, flyers, business cards, ads, email signatures, brand-kit, translations, affiliates) are HIDDEN from nav/dashboard/help but routes remain live at direct URLs. Restore by re-adding links in `Header.tsx`, dashboard `creations` queries, and the help index.
- **2026-09-26:** the still-live peripheral pages now REDIRECT (a `layout.tsx` in each folder) so they can't spend credits — see Known Issues › Audit 2026-09-26. Since then, AI Social (/social-media), Affiliate Program and Brand profiles are back in the account menu, and Custom Graphics (/design) is on + Create.
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
- Repo: 75+ `vps-*` one-off patch scripts removed; canonical VPS server tracked at `render-service/server.js` (env-var secrets, exits if API_SECRET unset); `vps-*`/`teaser-output/` gitignored
- All inline border-radius values >10px clamped to 10px app-wide (circles via '50%' kept)
- `generating` page surfaces persistent polling failures instead of spinning forever
- Removed unauthenticated test scaffolding: `/api/test-{seedance,seedance-full,kenburns,flipbook}` + their public pages (they called paid AI APIs with no auth). `demo-video` is already disabled (503); `try-demo` has IP rate limiting; `demo-slide-gpt`/`template-demo` are authed.

## Flyer maker rebuilt — one tool, chat-first, paid (2026-08-09)

Three problems fixed together.

**There were two flyer makers.** `/flyers` (Gemini wizard, 4 steps) was the one
linked in `Header.tsx`, so it is what every customer used. `/flyer` (chat-driven,
gpt-image-2, 225 styles, photo upload, per-size native aspect ratios) was
unlinked and reachable only by typing the URL. The good one was invisible.
- Menu now points at `/flyer`; `/flyers` is a `redirect()` stub (bookmarks).
- `app/api/generate-flyer/route.ts` DELETED. Flyers it made are untouched —
  they live in the `videos` bucket and are listed in `creations`.

**The new maker was free.** It never called `deductCredits`. Now charges
`costForUser('flyer')` (200, or 100 grandfathered) PER DESIGN, checked up front
and quoted on the button. Failures refund via `addTopupCredits` with
`videoId` null — NOT `refundVideoCredits`, which keys off a video id and would
silently swallow it (see the credit-refund UUID gotcha).

**Work disappeared.** Make wiped the previous batch; refresh lost everything.

**The builder was three fixed columns — dead on a phone.** At ≤900px they were
clipped off the right edge with no way to reach the steps or typing box. Now a
single `isPhone` switch (`matchMedia('(max-width:900px)')`) stacks it into one
scrolling column: the working surface (steps + chat + typing box) first, designs
below, past-jobs list behind a ☰ drawer. The typing box is pinned to the bottom
above the cookie bar; the composer row wraps so Send/Make never clip. Desktop is
unchanged (still fixed 3-column, `steps-check` 7/7). Proven with
`scripts/phone-check.mjs` (390×900: box + all 5 rows + composer buttons reachable
via elementFromPoint) — shown to fail on the old layout before the fix.

### New
| Thing | Purpose |
|---|---|
| `supabase/migrations/20260809_flyer_designs.sql` | `flyer_rounds` + `flyer_designs`, owner RLS. **Run by hand — applied to prod 2026-08-09** |
| `GET /api/flyer-history` | Rebuilds the thread; returns `unit` (price) + `balance`; degrades to empty if the tables are missing |
| `GET /api/flyer-file/[id]` | Permanent, ownership-checked address for a design; mints a fresh signed URL. Stored in `creations` so library thumbnails never expire |
| `app/_lib/flyer-engine/` | The engine, moved out of `_lib/flyer.ts`. Imports NOTHING; `__tests__/portable.test.ts` fails if that changes |
| `app/(dashboard)/help/flyers/` | Help article + help-index entry |
| `scripts/smoke-flyer.mjs` | Signed-in end-to-end run |
| `scripts/check-flyer-schema.mjs` | Is prod actually ready |

Images go to the PRIVATE `creation-assets` bucket at
`{user_id}/flyers/{roundId}/{sizeId}.png` — a flyer can carry a client's name,
address and phone number, so no public URLs.

### Business cards
`biz-card-front` / `biz-card-back` (3.5×2in). Small enough that `apiSize` hits
the pixel FLOOR and scales the request up, then the route scales back to
1050×600 for print. `flyerPrompt` branches: headline is the person's NAME, the
back is kept near-empty, and it is told this is flat artwork not a photo of a
card on a desk.

### The style bug worth remembering
`/api/flyer-chat` has ALWAYS returned a suggested `layoutId` and the page threw
it away. A live test asked for an estate agent's business card and got a
technically flawless card set in a nightclub, because the default style is a
club night and nothing ever moved it. The page now applies the suggestion — for
style AND size — but only while the customer is still on the defaults; once
they pick for themselves their choice wins. Anything changed on their behalf is
said out loud in the reply.

### Two checkers that lied (same failure, twice in one session)
- `check-flyer-schema.mjs` used `select(..., {head:true})`, which returns clean
  for a table that does not exist. It passed `table_that_cannot_possibly_exist_xyz`.
  Ask for a real row instead — a missing relation then fails with PGRST205.
- `smoke-flyer.mjs` waited for `figure img`, which matched a design RESTORED FROM
  HISTORY, reported success in 22s, then reloaded and killed the generation still
  in flight. It now counts what is on screen first and waits for one MORE.

Verified live 2026-08-09: redirect, price shown, thumbnails, cards offered,
style auto-picked (Luxury Listing), design produced in 86s, opens full screen,
survives a refresh, saved to the library. Charging proven via the
`admin_bypass:flyer` ledger row — this account is admin, so the balance itself
cannot demonstrate the deduction; that still needs a paying account.
