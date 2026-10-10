# Docs2Video — Build State

**Last updated:** 2026-10-09 (scene kit engine behind KIT_ENGINE — see first section; new 3-step create flow from the approved sketch; videos only + dark by default — see below) (header sections below may lag — see CODE-REVIEW-2026-07-01.md for the current architecture map)
**Branch:** main
**Build:** ✅ Compiles clean
**Deploy:** Vercel (docs2video.com, text2art.app)

## 2026-10-09 — The look screen ("look wizard" v2) on the scene kit (not deployed)

- **What the user sees:** one screen, **Make it look like…** with three starts — **My brand** / **Something I like** (picture, PDF first page, or website) / **A ready style** (Navy and gold, Calm paper, Bold and bright, Forest). **We picked this from …** shows 4 colour squares (editable, **Try other colours from it**), **Headline** chips (Modern/Classic/Bold/Warm = Montserrat/Playfair/Oswald/Fraunces; a reference's font shows as "<free font> · closest match"), **Feel**, **Logo** (Auto / On a white card / Name as text). Nudges **More premium / Warmer / Bolder / Calmer** + **Undo** (colour-picker drags count as one step). Contrast auto-fix line + **Why?**. **Fine-tune (optional)**: background, corners, music (Match the feel / Gentle piano / Soft pulse / Upbeat / No music), look name. Bottom bar **Look ready · Saves to <brand>** + **Free preview** + **Use this look** (Brands: **Save look**). Phone: one column, preview first.
- **Live preview = the real kit in the browser:** `app/_components/look/LookPreview.tsx` (lazy `next/dynamic`, ssr off) plays `remotion/src/kit` theme + scene views through `@remotion/player` 4.0.290 — the person's OWN scenes (`/api/look` → `look-preview-plan.ts`: cover + up to 3 content scenes + closing via the kit's free `fallbackPlan`, compliance-scrubbed; a sample story on Brands). Scene tabs, **Play 10 seconds**, soft cuts; silent. **Hear it** plays a 14 s sample (`public/look-music/{piano,pulse,bright}.mp3`, cut from the kit beds) at 25% volume, only after a click.
- **Where:** `/create/look?id=` (step 3 card **Create your own look** / **Change your look**; **Your look** card comes FIRST and is pre-picked when the draft or brand has one; "Make it match your brand?" note after the first free preview), `/brands/[id]/look` (**Video look** on each brand card + the brand page). Step 3 path list includes `/create/look`.
- **Reference read** (`app/_lib/look-reference.ts` rules + `look-reference-deps.ts`): image as is · PDF → pdf-lib keeps page 1 → render service `/convert` (pdftoppm) → white padding cropped · website → SSRF guard → microlink screenshot (same as the commercial maker) + the site's own font names. Colours measured in CODE (`look-palette.ts`: sharp 120px → seeded k-means in Lab, merge ΔE<10, near-greys never accents, Bootstrap/Tailwind/Material defaults set aside when any other colour exists, calm page, the picture's own dark ink for words, alternatives). Gemini 2.5 Flash (thinking off, JSON) returns {mood, closestFontFamily (from our free list), density, energy}; code checks every field. **Measured: $0.0002 a read (~0.02¢), 3–8 s.** Cached per account by file hash (`videos/<user>/look-refs/v2-*.json`; websites by address, 7 days) — cache hits free + uncounted; **20 new reads/day** (`rate_limit_hit`, fail CLOSED) + the account's AI daily gate. Video links / video files → "take a screenshot". Any failure → starts from the brand with a plain message. Words, logos, photos never used.
- **Data — no migration:** a look = the kit `Look`. Saved on the brand in `brands.brand_guide_data.video_look` (+ up to 8 named in `video_looks`); `updateBrand` keeps the stored look (an old brand form can't wipe it). Each video gets a COPY at Use-this-look / Make-it time (`draft_data.kitLook='custom'` + `kitLookCustom`, sanitised in the draft PATCH); `generate-video` snapshots the brand look into the draft if none. `resolveKitLook`: 'custom' → draft copy, else brand's saved look, else brand colours; a ready look is never overridden by a stale copy. Free preview: `kit:custom`. **Drawn slides** read `kitLookCustom` (colours + feel into the drawing prompt, `drawnLookPalette`).
- **Kit changes (remotion/src/kit — Lambda site redeploy):** `Look.music` (`MUSIC_PICKS`, `musicFileFor`: user/AI track > pick > feel bed; 'none' = no music) used by KitVideo; `sanitizeLook` keeps `music` + `upperLabels`; contrast guard now also checks words against the second colour (moves it toward the page) and fixes unreadable words to 7:1 (not just 4.5); line-chart value pills got 6px vertical padding (tall serif `$` poked out).
- **Monorepo wiring:** `@remotion/player` 4.0.290 declared in root package.json + lock by hand (already installed at that version; no `npm install`); `next.config.ts` turbopack `resolveAlias` (browser) `remotion` → the root copy; tsconfig `paths` for `react`/`react/*`/`remotion` types → one copy. `npx remotion versions` still one version (4.0.290); nothing under remotion/ changed except the source files above.
- **Checks:** `tests/look-wizard.test.ts` (32: busy photo + Bootstrap page palettes, extreme looks, nudges/undo, cache + cap + fail-closed, failed reads, video links, private addresses, whitelist fonts, copy isolation, keepVideoLook, music, Drawn prompt, step-3 cards — mutations shown to fail); strict overflow QA (QA_OVERLAP + QA_SEQUENCE=4) on 15 kit cases incl. 3 extreme user looks (pale-on-pale, neon, black-on-black) **PASS 241 frames**; `e2e/look-wizard.spec.ts` (9); shots `.shots/look-wizard/` (1440 + 375, dark + light). Help: new `/help/video-look`, brands + creating-videos articles, How-to-use entry, help-chat prompt.
- **Also fixed:** kit `Dialog` closed itself the instant it opened in development (React runs effects twice; the clean-up's late `close` event reached the new listener) — How to use, admin confirms and Library delete pop-ups never showed in dev, failing 12 e2e tests. A close the dialog makes itself is now ignored. Step-3 look cards keep their picture at the top when a neighbour's caption is taller.
- **Deploy needs:** Vercel deploy; Lambda site redeploy (`remotion/scripts/deploy-lambda-site.sh`) for music picks + guard; render service unchanged. KIT_ENGINE must be on (it is in prod) for step 3's cards; the Brands look screen works either way.

## 2026-10-09 — Voices now come from fal.ai (not deployed)

- **Why:** OpenAI TTS said "no credits remaining" and ElevenLabs-direct said "payment_required" the same day, so narration was down. Owner decision: use fal.ai for voices.
- **What:** fal's ElevenLabs **turbo v2.5** (`fal-ai/elevenlabs/tts/turbo-v2.5`, override with `FAL_TTS_MODEL`) is now the FIRST voice everywhere; ElevenLabs-direct then OpenAI stay behind it as fallbacks. One helper per side: `render-service/fal-tts.js` and `app/_lib/fal-tts.ts` (plain fetch to fal.run, 3 tries with backoff on 429/5xx/timeouts/missing audio, 45s timeout, no retry on other 4xx; a reply only counts if it carries an audio URL that downloads to real mp3/wav >1 KB — fal's "COMPLETED with nothing" is a failure).
- **Voices** (`FAL_VOICE_MAP`, identical on both sides, a test checks): nova/Sarah → **Rachel** (the voice production already used), shimmer/Emily → Sarah, onyx/James → Brian, echo/Michael → Chris, alloy/Alex → River, fable/Oliver → George. Step-3 samples `public/samples/solo-*.mp3` remade with fal (`node scripts/generate-voice-samples.js --force`) so the sample = the video voice. Free-preview voice cache key bumped to `v2-fal`.
- **Word timings:** fal returns per-character timestamps (`timestamps: true`) → exact word times for Slide Deck / Kit sync (same as ElevenLabs-direct). If a reply ever lacks them, times are estimated from the measured mp3 length (OpenAI-style).
- **Loudness:** fal voices differ (Rachel −23.5, Brian −21.9, Sarah −15.5 LUFS), so the render service normalises every fal clip to −16 LUFS / −1.5 dBTP in memory (ffmpeg loudnorm; kept as-is if ffmpeg fails). Website-side clips (presentations, preview, re-render) are not normalised (no ffmpeg on Vercel); presentation exports already normalise.
- **Covered:** render-service `ttsToBuffer` (Aurora/Cinematic/Infographic/Editorial/Explainer/Drawn/classic), `slides.ttsTimed` (Slide Deck, Kit, commercials, Fix-a-Scene, fix-narration), `/selftest` (+ new `tts_fal` check); app `synthesizeSpeech` (presentations, re-render, admin campaigns), free-preview voice, Inngest `synthesizeNarration`. One-off `remotion/scripts/gen-*.mjs` and `scripts/director/*` marketing tools still call ElevenLabs directly (not production).
- **Measured (real calls):** ~1.1–1.8 s per clip (+0.3 s loudness), about $0.05 per minute of narration ($0.05 per 1,000 characters, ~1,000 characters a minute). Gemini read-back matched every word, including "$500,000" and "$142 a month". Sample: `.shots/fal-voice/bakery-bright.mp4` (voice −16.8 LUFS, music under voice −39.6 dB). Test spend ≈ $0.15.
- **Deploy:** website (Vercel) + video service image (`fal-tts.js` added to Dockerfile + build-context.sh). FAL_KEY is already in Vercel prod + ECS task def :2. No Lambda redeploy (remotion/src unchanged).

## 2026-10-09 — The scene kit: new video engine behind KIT_ENGINE (not deployed)

- **What it is:** one composition `KitVideo` (`remotion/src/kit/`, registered in Root.tsx) that renders a plan of 8 scene types — Title (optional real presenter photo + "Prepared for"), BigNumber (count-up that lands on the spoken word), Comparison (two real sides, same unit), Timeline, Chart (bar/donut/line), Checklist (≤4), Quote, CTA (contact rows from the agent's profile + button). Every scene fills the same 16:9 grid with one hero element; all words are `<Fit>/<FitBox>`; money via `formatFigure` ($ + commas).
- **Shared rulebook:** `remotion/src/kit/spec.ts` (no imports — the app imports it too): the `Look` type (colours bg/glow/accent/text, head+body font from a free Google-font whitelist, background gradient/glow/solid/paper, corners ≤10px, feel calm/premium/energetic → motion speed + music bed, logo mode auto/plate/text), presets **animated-slides** (navy/gold), **editorial** (cream paper, Fraunces), **bright** (old Explainer colours) + `brandLook()`, `guardLook()` contrast guard (text/muted/accent words ≥4.5:1, big numbers ≥3:1, fixes are reported), scene schemas + word limits, `parseFigure/formatFigure`, `kitTimeline` (mirrored in `render-service/kit.js`; a test proves they agree).
- **Motion** (`kit/motion.tsx`, `KitVideo.tsx`): settle springs scaled by feel, reveals spread over the voice (never-freeze), count-up landing on ElevenLabs word timings, `Alive` drift + late light sweep, 3 cuts by mood (calm = dip dissolve, build = push, reveal = zoom-through), always-moving backgrounds, progress line. Music = `MusicBed` loop + `explainerMusicDuck`; sfx quiet set when `regulated`.
- **Planner** `app/_lib/kit-planner.ts`: `claude-sonnet-5`, thinking off, cached system prompt; one scene per beat of the APPROVED story (narration never rewritten); code checks (word limits, numbers only from the source, money keeps its $, no raw 4+ digit numbers in words, no two same types in a row, comparison = two real sides of one measure, bar charts comparable, compliance via `scrubComplianceText`, sales-pressure words, never "Docs2Video"); ONE repair call; then per-scene deterministic fallback. Hard cap **$0.25/video** (worst case pre-computed with a deliberately high token estimate, output shrunk or call skipped). Cost logged `[kit-planner] {...}` per video; plan cached on `draft_data.kitPlanCache` (hash of the inputs) so retries/restarts pay $0. **Measured: $0.013 (8 beats, 1 call) – $0.027 (9 beats, 1 repair); tuning spend $0.09 total.**
- **Wiring:** `videoStyle 'kit'` + `draft.kitLook` (or `kitLookCustom`). generate-video plans → render service `POST /generate-kit` (voice per scene with word timings, voice normalised to −16 LUFS, real logo light/dark/any + photo, music by feel or the user's / AI music, per-video folder `public/kit-<videoId>/` named in props + `assetDir` for the Lambda uploader; `calculateMetadata` keeps `assetBase`). Can't start → falls back to Animated slides (render_note). Free preview: engine `kit` (deterministic plan, $0) via `/preview-still`. v1 API: `videoStyle: "kit"`, `look`. Duplicate copies `kitLook/kitLookCustom`, never `kitPlanCache`. Kit videos store `<id>_kit_plan.json` (NOT `slide_plan_url` — Fix-a-Scene is DirectedVideo-only).
- **Flag `KIT_ENGINE=on`** (Vercel env; `GET /api/kit-engine`): step 3 shows Animated slides / Editorial / Bright (Explainer renamed) / Drawn slides, all but Drawn saving `videoStyle 'kit'`; Aurora, Cinematic, Infographic hidden (old videos and their re-renders unchanged). Card pictures `public/style-samples/kit-*-{cover,data,closing}.png`. Flag off = nothing changes.
- **Gates (2026-10-09):** 3 full local renders in `.shots/kit/` (insurance × animated-slides 82s, insurance × editorial 82s, bakery × bright 58s) + sheets + 2 short MP4s; strict overflow QA (QA_OVERLAP + QA_SEQUENCE) on 11 kit cases / 167 frames PASS; sound: voice −16.9 LUFS, music under voice −38.6 to −39.5 dB, between lines −31.9 to −32.8 dB; preflight PASS on all three, music to the last frame; `tests/kit-engine.test.ts` (40 tests, mocked API).
- **Blocker found:** the local ElevenLabs key says "payment_required" and the OpenAI key says "no credits" — samples used the Windows voice. If production uses the same accounts, every voiced video fails at the voice step.
- **Deploy needs:** render-service image (Dockerfile + build-context now ship `kit.js`), Lambda site via `remotion/scripts/deploy-lambda-site.sh` (new KitVideo + fonts), Vercel deploy, then `KIT_ENGINE=on` after review. No migration (draft_data is JSON).

## 2026-10-09 — Admin fixes + "What needs you" (not deployed)

- **What needs you** (`app/_lib/admin/needs-you.ts`, one server function): admin home card (`admin/_components/NeedsYouCard.tsx`, `GET /api/admin/needs-you`) AND the daily email (`/api/cron/daily-digest`, rebuilt on it; HTML in `_lib/admin/needs-you-email.ts`). Items, each a link: videos that didn't finish (24h, saved reason in plain words), videos `review_required` (Approve / Reject right on the card), Stripe payment problems (from `error_logs`), payment-late customers, paying customers slipping (cancelling at period end / credits used up / no video in 14 days; admin + test accounts left out), affiliate money owed / past the 30-day hold, AI services. Email is quiet when nothing needs the owner.
- **One inbox:** `_lib/owner-inbox.ts` → `OWNER_ALERT_EMAIL` env, else **tdaniel@botmakers.ai** (the address the 6-hourly health alert already used). Both `/api/internal/error-report` and the daily email use it. The digest no longer mails `trenttdaniel@gmail.com` or the ADMIN_EMAILS list (that list is who may open /admin, not a mailing list). New optional env: `OWNER_ALERT_EMAIL`.
- **Payment errors:** the Stripe webhook gained ONE call in `invoice.payment_failed` → `recordPaymentFailure` (`_lib/admin/payment-alerts.ts`) → existing `error_logs` table (endpoint `stripe-webhook:payment_failed`, one row per customer). Webhook crashes / bad signatures were already logged there. **No new table, no migration.**
- **AI balances:** ElevenLabs (`/v1/user/subscription`) and fal (`/v1/account/billing`) are asked; **both current keys refuse** (ElevenLabs key lacks "User: read"; fal needs an ADMIN key) — the card says so plainly. OpenAI / Gemini / Claude have no balance API → last health check shown.
- **Review approve/reject:** `POST /api/admin/review-video` (only acts on a row still `review_required`; approve = the same re-run as Retry, which charges the owner — they were refunded at hold; reject = failed + "Not approved after review", refunds any outstanding charge). Shared re-run code `_lib/admin/retry.ts`.
- **Retry says the price first:** `GET /api/admin/retry-video?videoId=` → "This will charge X 1,000 credits" / "Free — …", from `videoCreditCost(videoPriceInputs(row))` (price-quote.ts), shown in the confirm box before anything runs.
- **Failed videos:** reason in plain words (`_lib/admin/fail-reason.ts`, folded technical text), Videos tab is server-paged with filters All / **Waiting for your OK** / Didn't finish / Being made / Finished + **Any time / Last 24 hours** (in the address: `?tab=videos&filter=failed&since=24h`).
- **Confirm pop-ups (kit Dialog, `admin/_components/useConfirm.tsx`; no browser confirm() left in admin):** Make/remove admin, beta, plan dropdown, Give credits, Ban/Unban (new button on the person's page, reason required), Pause/Resume/Cancel subscription, Revoke API key (Jordyn partner key: extra warning + type JORDYN), API credit top-up, affiliate approve / mark paid (type PAID) / pause, Log in as, billing-health fix, campaign start/cancel.
- **Credits:** 100 / 500 / 1,000 / Other (≤100,000) + required reason (server refuses without one); old +10/+100/+500 buttons gone. Billing actions, plan changes, payouts, API key actions, review actions, ban/unban all written to `admin_audit_log`. Audit tab hides test accounts by default ("Show test accounts" toggle), plain action names.
- **Plan change:** pop-up shows what the app says vs what Stripe bills, warns "Stripe keeps billing", offers **Change it in Stripe** when the existing plan-change rules allow it (one active subscription → `decidePlanChange` + `changePlanInPlace`, `POST /api/admin/plan-change`; webhook then updates plan + credits) else "Change it here only" + link to the Stripe customer.
- **One money calculation** (`_lib/admin/money.ts` pure + `money-server.ts`, 60 s cache) for Dashboard, Billing tab, Billing & Sales and Revenue: paying / trialing / past-due / paused separate, MRR = paying Docs2Video only, conversion leaves out banned/test/admin. **Finding:** the "Unknown" $129 / $149 / $150 rows are NOT old Docs2Video plans — the Stripe account is shared: Jordyn Pro ($129, $149), Apex API calls ($150), plus VidWiz/PubcoZone/Auto Social prices. They're named and shown as "Other products on this Stripe account", never in Docs2Video MRR (live read 2026-10-09: D2V MRR $158 from 2 paying Pro, 3 on Starter trial; old screen said $416). Revenue page counts charges from Docs2Video customers only.
- **No secrets to the browser:** admin selects use `_lib/admin/columns.ts` (no Stripe Connect tokens, social keys, mail tokens). `/api/admin/data` now returns database COUNTS + 10 recent sign-ups + audit log (was 1,000 profiles + 2,000 videos + 2,000 brands, all columns). New paged `GET /api/admin/users`, `GET /api/admin/videos`. Prospects tab moved to `_components/ProspectsTab.tsx` unchanged.
- **Phone:** the admin side menu is one dropdown under 900px (`admin/admin.css`); user page grids wrap.
- **Left as is (note):** `GET /api/admin/music` list is readable by any signed-in user — harmless, left. Ban writes `subscription_status='banned'`; if prod's CHECK constraint still lacks 'banned' (migration 20260919, see supabase/CHECK-PROD-FIRST.sql) the Ban button now shows the error instead of silently doing nothing.
- Help: admin help (credits, ban). Guards `tests/admin-fixes.test.ts` (money fixtures, fail reasons, no secret columns — checker proven to fail on a planted `select('*')`, every risky action asks before calling — checker proven to fail, one inbox, email links, webhook = one call, phone menu). e2e `admin.spec.ts` + 4 read-only checks (writes blocked by route guard). Shots `.shots/admin-fixes/` (`before-*` = the audit's shots, `after-*` 1440/375 dark/light, dialogs).
- **Needs:** Vercel deploy only. No migration. Optional: set `OWNER_ALERT_EMAIL`; give the ElevenLabs key "User: read" / add a fal admin key to see balances.

## 2026-10-09 — Money + safety holes from the audit (not deployed)

**Run BY HAND before deploying the website:** `supabase/migrations/20261009_trial_card_fingerprints.sql` (else confirm-card refuses every NEW trial — fails closed + emails) and `supabase/migrations/20261009_admin_flag_for_owner.sql` (flags the owner's confirmed accounts; anyone else who needs /admin must have `profiles.is_admin = true`). Also confirm `rate_limit_hit` exists (20260701_rate_limits.sql) — the free-AI caps now fail CLOSED without it. **Redeploy the video service** (render-service: job-guards.js is new, added to Dockerfile + build-context.sh; lambda-render.mjs changed).

- **Restart = free video (#1):** `/api/videos/[id]/restart` only restarts a job quiet for 15 min (`restartDecision` in video-running.ts) or already failed; removes the old MP4. Render service: every videos `status:'completed'` write goes through `completeIfRunning` (render-service/job-guards.js) — a failed/refunded row stays failed, the owner is alerted ("late-finish"). Cron V1 recovery also only completes running rows.
- **Scene cap (#2):** `app/_lib/length-limits.ts` (Short 8 scenes/400 words, Standard 14/1,000, Detailed 30/3,500 incl. cover+closing and edit room). Enforced before claim/charge in generate-video, generate-presentation, reedit-presentation, re-render.
- **Free AI caps (#3, #8):** `cardlessPrepGate` = `aiDailyGate` now: no-card cap (30/day) + every-account ceiling `AI_STEPS_PER_DAY` = 300/day (admin/beta exempt), via fail-closed `hitRateLimitStrict`; profile/counter errors → 503 + alert. Added to transcribe, help-chat, deck-parse, design-prefill, flyer-chat, fix-photo, re-render, brand-from-url, generate-logo-kit, generate-from-idea, generate-social-post, scrape-brand, extract-text, chat. **Deleted (no caller, uncharged AI):** quick-preview, preview-slide, script-chat, ai-research, classify-images, pre-generate-audio, preview-theme, regenerate-slide, proposal-chat, smart-followup, reference-url, auto-select, generate-slide, style-preview-from-brand, style-preview-from-ref, translate-presentation (tests/retired-tools.test.ts).
- **/api/chat (#4):** signed-in owner of the video only.
- **One card, one trial (#5):** confirm-card reads the Stripe card fingerprint; `trial_card_fingerprints` (PK fingerprint) — another account's card → 409 plain message.
- **SSRF (#6):** generate-commercial refuses private/loopback/link-local website/music/logo before charging; brand-scraper's address rule now uses net-guard's fuller list; API webhooks only POST to public addresses (no redirects); render service fetches outside URLs with `guardedFetch` (every redirect hop checked) in server.js + commercial.js.
- **Ledger write (#7):** deductCredits checks the credit_transactions insert; on failure puts the credits back (`restoreDeduction`, CAS) and refuses.
- **Alerts to one inbox (#9):** `app/_lib/ops-alert.ts` `alertOps` (Resend → `ownerAlertEmail()`, error_logs, 10-min throttle). Refund failures (generate-video, restart, cron), render-service unhandled rejections/crashes, credit-ledger failures, API refund failures, Stripe webhook handler errors (names email/customer/user via `stripeEventCustomer`). Cron heartbeats: every cron stamps `app_settings['cron_heartbeat:<name>']`; system-health emails if one is overdue (`cron-heartbeat.ts`). Lambda polling retries 8 errors then fails with a clear reason. **API jobs:** `api-job-finalize.ts` — failed API jobs refund their API credits once (key `api-refund:job:<id>`) and fire their webhook; completed ones fire it; swept by fix-stuck-videos (jobs from 2026-10-10 on).
- **Admin (#10):** `isAdminRequest` = confirmed email AND `profiles.is_admin`; the email list is a page hint only. `videoIsFree` no longer takes the email.
- **Classic /generate (#11):** every progress write stamps `progress_updated_at` and only touches running rows; the whole job runs inside `withRenderSlotFor` (queue heartbeat).
- Tests: tests/audit-*.test.ts (run real routes on `tests/fixtures/fake-supabase.ts`).

## 2026-10-09 — Video sound fix + no "Docs2Video" on client covers (not deployed)

- **Voice was halved:** the render-v3 (Cinematic/Aurora/Infographic) and render-editorial music mixes used ffmpeg `amix` without `normalize=0`, so voice AND music came out at half level (~-6 dB). All four ffmpeg music mixes in `render-service/server.js` (/assemble, /render-v3, /render-editorial, /generate incl. Drawn slides) now go through ONE helper, `render-service/audio-mix.js` → `mixMusicUnderVoice`: voice untouched (normalize=0), music looped (`-stream_loop -1`, cut to the video length, fade in/out) and DUCKED like the commercial template — 0.20 between lines, 0.08 under the voice, 0.3 s ramps; when the voice talks comes from silencedetect on the narration, or exact slide times (Drawn slides).
- **Remotion engines:** shared `explainerMusicDuck` + `sceneVoiceWindows` (`remotion/src/lib/audio.ts`) and `<DuckedMusic>` (`lib/musicbed.tsx`, loops via MusicBed). DirectedVideo (Slide Deck) now ducks (was a flat 0.28 that never moved) using each scene's measured voice length (`voFrames` + `musicFrames` from calculateMetadata); V3Video / EditorialVideo / InfographicVideo duck their optional `music` prop the same way. Insurance plans (`plan.regulated`, set by slides.js) get the quieter sfx set (0.6x, short whoosh + soft impact, no sub-drop). MusicBed without a known length now loops.
- **Drawn slides motion:** `render-service/drawn-assembly.js` — slow centred Ken Burns (4%, alternating in/out) + 0.5 s cross-fades; same per-slide timing (voice + 0.8 s), voice still starts with its slide.
- **Client covers:** `preparer || 'docs2video'` removed from /generate-slides and the free preview (server.js). generate-video resolves the name with `resolvePreparerName` (personalize.ts): brand → company typed → profile company_name → profile full_name → nothing; our own product names are dropped. slides.js no longer uses the document's company (the carrier) as the closing contact on regulated videos.
- **Small visual fixes:** Slide Deck cards — label/value slots the same height on every card (labels line up); "vs" only for a real comparison (`remotion/src/slides/compare.ts`); Infographic "Covered until"/dates get a calendar glyph, not the shield.
- **Stale files:** untracked `remotion/public/{v3,editorial,extracted,dir-plan}.json`, `dir-*`, `v3-*` moved to `.shots/old-public-leftovers/`; Root.tsx / DirectedVideo no longer fall back to public/*.json (placeholder instead).
- Guard test `tests/sound-and-cover-branding.test.ts`; measuring script `scripts/look-samples/sound-check.ts` (Windows speech + local track, no paid calls; output `.shots/sound-fix/`).
- **Needs:** render-service image rebuild + ECS roll (new files are in Dockerfile + build-context.sh), Lambda site redeploy via `remotion/scripts/deploy-lambda-site.sh` (remotion/src changed), Vercel deploy (route + personalize.ts).

## 2026-10-09 — Customer UX fixes from the audit (not deployed)

Thirteen fixes from the 2026-10-09 UX audit (`.shots/audit-ux/`). Shots: `.shots/ux-fixes/` — `before-*` / `after-*`, 1440 + 375, dark + light; `*-speed.json`.

1. **Missing / old video link** — result page (`videos/[id]`): `useVideoRow` returns `missing` when the first look-up is empty (stops polling) or nothing arrives in `MISSING_AFTER_MS` (6 s) → "We can't find this video" + **Back to Library** / Try again. Share page `/watch`: friendly "We can't find this video — ask them for a fresh link" (no marketing link), fetch gives up after 10 s.
2. **Step 2 number tiles** — figure + label are wrapping text boxes (`field-sizing: content`, line breaks become spaces); `numTileSize` steps long figures down (h2 → h3 → lead). No more "Preferred Non-Toba".
3. **Library** — **All** = videos + presentations only; decks/graphics/old tools ONLY under **Older items**. All · Videos · Presentations are now paged, searched and sorted in the database (`?q= &sort= &per= &page=`, `.range()` + count; card fields only — recipient + draft step pulled out of draft_data, not the whole draft). One rule in `videos/library-tabs.ts` (`videosFilterFor`, `OLDER_OUTPUT_TYPES`, `searchPattern`) used by the Library AND Home's "See all N" (`_home/load.ts`; Home's Recent no longer lists old decks).
4. **Looks** — "Slide Deck" → **Animated slides** (`NAMES.animatedSlidesLook`; help, FAQ, How-to-use, help-chat, v1 options name, comments). Every look card (video + presentation) has a one-line `short` under its name; BEST kept. Aurora/Cinematic/Infographic untouched (another job retires them).
5. **Bell** — `app/_lib/bell.ts`: notes older than 30 days stay out of the bell (Activity keeps them), same note about the same project folds into one line ("2 times"; read/delete act on all), failed = **Didn't finish** + link to `/videos/<id>` ("Open to try again"), badge counts the lines shown, lucide icons. Activity uses the same wording (`tidyNotice`). Writers in fix-stuck-videos cron, creatomate webhook and inngest render now title "Didn't finish" (generate-video's writer left to its owner — the bell rewrites it).
6. **Share page /watch** — no cookie notice there (`isClientSharePage` in CookieBanner); "Powered by Docs2Video" once (footer; header line and the free-plan bottom bar removed); always a next step block (`data-testid="watch-next-step"`): **Book a call with <agent>** when a booking link is set, else **Reply to <agent>** (the existing ask-a-question email form) + **Call <agent>** when a phone is set. The duplicate "Book a Call" above it is gone (payment button stays).
7. **Phone create header** — the current step's name shows next to the dots (kit.css `.is-now .kit-focusbar-word`).
8. **Free plan name** — one name: pricing.ts's label "Pay As You Go" (billing card said "Free trial"; marketing said "Free"). `planName('trial')` → the free label; marketing home + /plans + help read the label.
9. **Clients** — **Add a client** first; "Total revenue $0" tile removed (3 counts: Clients, In touch, Active this week); statuses in plain soft words (`clients/client-status.ts`: New, In touch, Watched your video, Customer, Quiet lately — DB values unchanged); cards instead of the table under 700 px. Client page uses the same words.
10. **Words + labels** — help index blurbs on the 3-step flow (+ free plan name, prices read from tables); bell = "Notifications, N new"; avatar button = "Account menu"; "+ Top Up" → "+ Top up".
11. **React #418 on Library** — dates were written in local time on the server (UTC) and in the browser; reproduced with a browser in another time zone. Fixed with `videos/LocalDate.tsx` (UTC first, then local after load) + `shortDate(iso, now, timeZone)`. Verified: no #418 on /videos or /dashboard in Los Angeles / Kiritimati time zones.
12. **Brands** — `app/_lib/brand-dupes.ts`: /brands/new warns under the name ("You already have a brand called …, Open it") and asks once more before a second copy; the Brands page folds same-name brands into one card (default, else newest) + "N copies with this name" (opens the rest). Nothing deleted.
13. **Speed** — result page player `preload="none"` (poster = thumbnail or first slide, resized); Library card pictures + scene thumbs lazy with width/height and resized copies via Supabase's image resizer (`app/_lib/picture-size.ts`, only our own public stills; falls back to the original on error) — note Supabase bills image transforms per origin image beyond the plan's allowance. Measured on a "slow 4G + 4× slower CPU" phone (Playwright/CDP, production build, see `.shots/ux-fixes/*-speed.json`).
- Guards: `tests/ux-fixes-2026-10-09.test.ts` (33; the bell-age and All-tab checks shown to fail on planted bad values). e2e: new `e2e/ux-fixes.spec.ts`; updated top-bar (Account menu, Top up), share-page + share-and-crawl (not-found words), redesign-step3-make + video-playthrough (Animated slides).
- Help: creating-videos, faq, making-changes, sharing-videos (next step, powered-by once, no cookie notice), brands (same-name), library (All vs Older items), help index, How-to-use (Home bell, step 3 short lines, Library, Brands, Clients, top bar), help-chat prompt.
- **Needs:** Vercel deploy only. No migration, no render-service change.

## 2026-10-09 — "Drawn slides" video look (not deployed)

The original Docs2Video look is back as a NEW look card: the AI draws every slide as ONE finished picture (headline, ≤4 short points, the numbers drawn in), then the voice (Sarah default) + optional music play over it.

- **Rules + prompts:** `app/_lib/drawn-slides.ts` (pure) — `DRAW_STYLES` (3D infographic default / Illustrated / Classic), `drawnSlideText` (short headline ≤8 words, ≤4 points incl. big numbers, bullets ≤10 words with no dangling cut, `formatFigures` = $ + commas, contact details dropped, compliance scrubber on EVERY drawn word), `drawnSlidePrompt` (exact words in quotes, "no other words", no logos/company/product names/contact, 16:9, margins), `buildDrawnSlides` (cover + content + closing).
- **Look card:** `looks.ts` entry `drawn` (tag NEW, samples `public/style-samples/drawn-{cover,data,closing}.png` + chip pictures `drawn-{3d,illustrated,classic}.png`, 960x540, made-up content only). Step 3 shows a **Drawing style** chip row (with a tiny sample each) only when Drawn slides is picked (`LookPicker` got a `children` slot; `.cf-chip-thumb`). `drawStyle` is saved on the draft and sent to generate-video only for this look; copied by Duplicate; v1 API takes `drawStyle`.
- **generate-video:** the look now resolves body → the draft's own `videoStyle` → admin default (retry/admin/start-pipeline callers that don't send it keep the person's look). `drawn` uses the CLASSIC `/generate` route (never V2/V3/slides) with the drawn prompts + `imageEngine:'fal'`, `drawStyle`, `closingContactLine` (contact line added as plain text by code). Refunds = the classic route's (route catch + stuck-video cron).
- **Render service (needs deploy):** new `render-service/fal-image.js` — `drawWithFal` (gpt-image-2.5 flare on fal.run, plain fetch, low quality, 1920x1088; throws on no key / HTTP error / 200-without-image / wrong shape) and `addContactStrip`. `server.js /generate`: with `imageEngine:'fal'` draws the first content slide, then every other slide with it as a style reference (fal edit), 4 at a time; a slide fal can't draw (2 tries) falls to the old Gemini loop. `DRAWN_SLIDE_QUALITY` / `DRAWN_SLIDE_REF=off` env overrides. `/health` reports `optional.falKey` (never fails health). Dockerfile + build-context.sh include `fal-image.js`.
- **Free preview:** supported — engine `drawn` draws ONE picture on Vercel (`slide-engine.drawSlide`, fal low → Gemini fallback, ~0.3c), stored like other stills; the chip style is part of the cache key; note "Every slide is drawn fresh…".
- **Cost (measured, 6 real fal calls, `scripts/look-samples/make-drawn-samples.ts`, ledger in `.shots/drawn-look/raw/ledger.json`):** quality `low` spelled every word and $ figure right on all 6 slides (3 styles), 11–24 s each, ~0.29c/slide; with the style reference ~0.3–2c (estimate). ~12-slide video ≈ 3.5–25c. **Price unchanged** (normal video price; comment in `credits.ts`). One flaw seen: with the reference, a near-copy layout squeezed "to you" → "toyou" (spelling right, spacing tight).
- **Spell-check (added 2026-10-09, not deployed):** every fal-drawn slide is read back and checked. `render-service/slide-spellcheck.js` (render service) + its mirror `app/_lib/slide-spellcheck.ts` (free preview) — KEEP IN SYNC; `tests/drawn-spellcheck.test.ts` runs every case through both. (1) Gemini 2.5 Flash (plain REST, `GEMINI_API_KEY`, thinking off, HIGH media resolution, 20 s timeout) returns every text line + a rough box; the intended words come from the prompt (`expectedFromPrompt` reads the HEADLINE/SUBTITLE/BIG NUMBER/BULLET quotes) and are compared forgivingly (case, punctuation, spacing, $ and thousands commas) → a missing word or wrong number fails. (2) Squeezed words ("toyou") are measured in CODE: Flash reads "toyou" as "to you" even when asked about gaps (tried twice), so around each line's box the pixels are split into text rows and the wide empty-column gaps counted (letter gaps 1–5px, word gaps 11–19px, "toyou" 2–4px on a ~50px line); rows that are cut by the window, two lines tall, or the wrong width for the line are ignored because Flash's boxes are rough. Fail → ONE redraw (same prompt; WITHOUT the style reference) → still failing → keep the one with fewer problems and log `[spellcheck] … STILL WRONG`. Vision error/timeout/no key → slide accepted. Never fails a video. Server: `drawCheckedWithFal` wraps `drawOneWithFal(idx, { noRef })`; preview: `drawPreviewStill` uses `drawChecked`, redraw only if <25 s used (route limit 60 s). Dockerfile + build-context.sh ship `slide-spellcheck.js`. **Cost ≈ 0.1c per check** (~1,800 image + ~250 prompt tokens in, ~150–370 out, measured), ~1–2 s; a redraw adds ~0.3c + a check. **Verified (10 real Flash calls in all, under 1c total, no fal):** image 1 flagged (missing "you"), image 6 flagged ("…happens toyou" = 7 words, not 8), images 2–5 pass; image 4 (same words as 6, normal gaps) passes with real boxes. Note: image 1's ledger text was the OLD cut ("…happens to"); it was checked against the full sentence. Limit: the squeeze measure only runs where a line's row can be found cleanly — a busy background just skips it (never a false fail).
- Help: creating-videos (Drawn slides paragraph), help index "Video styles explained", How-to-use step 3 (+ sources), help-chat prompt. Guard `tests/drawn-look.test.ts`; e2e step 3: Drawn slides card/chips/body test, look count 7.
- **Needs:** Vercel deploy (app) + render-service deploy (image rebuild + ECS roll). `FAL_KEY` is already wired into the ECS task definition from SSM `/docs2video/FAL_KEY` — confirm the SSM value exists; `FAL_KEY` must also be set in Vercel for the free preview (else it falls back to Gemini). Until the render service is deployed, a Drawn slides video still renders, but every slide is drawn by Gemini (old service ignores `imageEngine`).

## 2026-10-09 — New create flow from the approved sketch (not deployed)

Owner approved the sketch ("love it": wide, big type, few words). The create flow is now **three steps** — **Your content · The story · The look** — shown in the focus header (Header.tsx; a step already done links back to it for the same draft; on a phone only the numbered dots show). The making screen and the result page come after the steps (the header shows all three ticked there). Old 4th step "Send it" is gone as a step.

- **Frame:** `create/layout.tsx` is one centred column (`.cf-page`, max 1080px). The left **step rail** and the **"Your video so far" panel** are deleted (`workspace/SoFarPanel.tsx`, `workspace/Workspace.tsx` removed; their CSS removed). `workspace/steps.ts` = 3 steps + `AFTER_STEPS` + `stepHref`.
- **One bottom bar per step** (`workspace/BottomBar.tsx`, `.cf-bar`): fixed to the bottom, above the cookie notice and the phone's home bar; measures itself into `--cf-bar-h` so the page leaves room (nothing hides behind it). Left = price/state in big words, right = the one main button (MainAction: disabled reason + "Show me") and on step 3 the "Free preview" helper. Phone: buttons fill the width. The help button floats above the bar.
- **Step 1 "Your content"** (`Step1Content.tsx`): "Add your *document.*" (or website / text / idea from `/create?source=…`; default document), big drop box (click or drag-and-drop, up to 5 files, file rows with × to remove, extra-file note — price shown on step 3), chips "Use a website / Paste text / Describe an idea / Use a document", then **For** (client chips: 2 recent + "+ New" + "Find"; press again = general) and **Goal**, both optional, side by side. Bar: "Free / Nothing charged yet", **Read it →**. Reading → straight to step 2 (the "Here's what we read" screen moved to step 2; old `?review=1` links forward there). Returning with a read draft shows "Back to the story". `ReadReview.tsx` removed.
- **Step 2 "The story"** (`script/page.tsx`): "Here's the *story.*", the one point as a big editable card, the numbers as big tiles (edit / × remove) — editing after the story is written offers a free **Rewrite the story with it** or **Undo my changes** and holds "Pick a look" until chosen (brief saved to the draft before any rewrite). "What it covers" fold (summary editable, key points, leaving out). "N scenes · about X minutes" + compact length chips; scenes as title cards in two columns (drag to move; **Edit** opens the full SceneCard editor in place, one at a time). One **Ask for a change** line (+ Undo). Bar: "Free / Changes cost nothing", **Pick a look →**. In-page "← Back" buttons removed (header steps link back).
- **Step 3 "The look"** (`theme/page.tsx`): "Pick a *look.*", look cards 3 across (2 on a phone) from `lookCards()` in `make/looks.ts` (BEST on `RECOMMENDED_VIDEO_LOOK`, optional `tag`; a new look = one entry — ready for "Drawn slides"), the picked look's line + "See examples" fold, ONE settings line "Sarah · music off · standard  Change" (`settingsLine` in `workspace/facts.ts`), the slim brand line ("Add your brand" piece unchanged), and a **More options** fold: Voice, Music on/off, Make (Video / Presentation with prices), Length (+ Change the length), Photos (Slide Deck), For your client (PDF download, note), Price lines. Bar: price + "N left after" (server quote), notices (already started / error / card needed / short on credits), **Free preview** (FirstScenePreview split into `useFirstScenePreview` + result panel) and **Make it**. `PricePanel.tsx` removed. All Make-it protections unchanged.
- **Making screen** (`generating/page.tsx`): same wide column, "Making your *video.*", no bar.
- **Type scale:** added `--fs-big` 24 and `--fs-display` 48 (+ `.kit-text-big/.kit-text-display`, Tailwind `text-big/text-display`). Display drops to h1 (34) on phones.
- **Words:** How-to-use (Step 1 — Your content, Step 2 — The story, Step 3 — The look, Making it), help article creating-videos (rewritten for 3 steps), help index FAQ, faq, getting-started, brands, sharing-videos, help-chat prompt, Home draft status "Draft · step N of 3".
- **Guards:** new `tests/create-flow-sketch.test.ts` (3 steps; no rail / SoFar anywhere; one bottom bar per step with one main button and no other primary button on a step or its parts; bar fixed + safe area; column width; looks data-driven; step 2 brief edits). Updated: create-workspace, round-a, round-c (scale), help-page-context, how-to-use, create-flow-dead-ends, home-start-cards, make-screen-price, derive.test. e2e: redesign-step1/2/3, redesign-layout, light-start, redesign-home, journey, top-bar, app-pages, video-playthrough.
- Shots: `.shots/new-flow/` — `before-*` and `after-*`, dark + light, 1440 + 375, steps 1/2/3 (+ `3-look-more`) and the making screen.
- **Needs:** Vercel deploy only. No migration, no render-service change.

## 2026-10-09 — Videos only + dark by default (not deployed)

Owner decisions: Docs2Video makes **narrated videos, interactive presentations and commercials** only. No NEW slide decks (silent PDF/PowerPoint "Slide deck", the PowerPoint/PDF builder, deck builder) or custom graphics (flyers, posters, social posts, the /design wizard). The app is **dark unless you pick otherwise**.

- **One rule file:** `app/_lib/videos-only.ts` — `D2V_OUTPUTS` (video, interactive), `isRetiredOutput` (deck/pptx/pdf), `RETIRED_PAGES` (old maker addresses → where they go), `RETIRED_MAKER_APIS` + `isRetiredMakerCall`, `RETIRED_MESSAGE`. Every rule is for the Docs2Video storefront only (`brandFromHost`); Text2Art is untouched.
- **Old addresses (proxy.ts, Docs2Video host only):** `/design/*`, `/flyer`, `/flyers`, `/deck-builder`, `/demo-slide`, `/template-demo` → Home (`/dashboard`); `/library` (Text2Art's library page) → `/videos?type=older`; `/help/flyers`, `/help/restyle-deck` → `/help`. `/logo-creator` already redirected (left as is).
- **Refused routes (410 + plain message):** browser POSTs to flyer-art, flyer-chat, flyer-deck, flyer-deck-export, flyer-edit, design-prefill, deck-parse, deck-builder, generate-deck, convert-slides, generate-pptx, generate-pdf, demo-slide-gpt, template-demo — refused in proxy.ts AFTER the server's own x-internal-service calls pass. `generate-presentation` refuses `outputType: 'deck'` and `generate-video` refuses a draft saved as deck/pptx/pdf (browser calls on Docs2Video). Code kept (Text2Art uses it). Reading old files (flyer-file, flyer-history, flyer-library GETs) still works.
- **Left alone on purpose:** the public API / MCP (`/api/v1/decks`, `/api/v1/presentations` with `output_type: 'deck'`, MCP `create_deck`) — key-authed, no storefront; owner to decide. Brand "brand deck" style samples (part of video styling) and the logo kit (other agent's code).
- **Step 3:** offers Narrated video / Interactive presentation only (`outputsOffered` → `D2V_OUTPUTS`; the page also filters with `d2vOutputs`). An old draft saved as a deck / PowerPoint / PDF opens as a video. The client-note section now always shows. Step 1: "Custom graphics" link gone ("Making a commercial instead? Start a commercial"); `?type=deck|slides` start a video.
- **Library:** tabs All · Videos · Presentations, plus **Older items** (decks, graphics, older retired-tool rows) only when the account has any (`videos/library-tabs.ts`). Old `?type=deck` / `?type=flyer` still land on just those. Old items open (decks → result page with PDF/PowerPoint/share/Delete; graphics → the picture), unchanged. KIND_NAMES.graphic.many is now "Graphics".
- **A video's own downloads kept:** MP4 + slides as PDF/PowerPoint, a presentation's PDF/PowerPoint.
- **Words:** in-app pricing (no "~N slide decks", "videos, presentations and commercials"), public /plans, UpgradeModal, setup wizard, help-chat greeting, marketing home third card ("Its slides, for the meeting"), industry pages ("plus an interactive presentation"), IndustryPage feature, brand page logo hint, admin campaign prompt. Credit/price tables untouched (numbers stay; removed products just not shown).
- **Help:** new article "Slide decks and custom graphics" (help index, Management); index hides the Text2Art-only guides on Docs2Video; creating-videos, library, downloads, faq, getting-started, making-changes, pricing (removed deck/graphic/PPTX/PDF rows), account (dark default). How-to-use (step 1, step 3, Library tabs + Older items, Settings, top bar). Help-chat prompt (what it makes / doesn't, Older items, costs, dark default).
- **Dark by default:** `theme-pref.ts` `DEFAULT_PREF = 'dark'`; nothing saved / nonsense / blocked storage = Dark; Light only when Light is picked or System on a light computer. Picking System now saves the word `system` (it used to clear the key, which now means Dark). Boot script matches (test). Settings → Profile → Appearance + account-menu toggle unchanged.
- **Screens converted to dark (LightOnly removed):** admin (all pages; `'white'` boxes → `var(--bg-card)`, words on navy → `var(--on-ink)`, sidebar CSS, provider names keep a colour edge; the campaign email preview stays white on purpose), in-app pricing, AI Social (`social-media`; platform chips now solid brand colour + white letter), photo fixer (`/fix`, stays for Docs2Video). Also fixed: admin pages scrolled sideways on phones (wide tables now scroll inside the content box). Still LightOnly: Text2Art's /design + /library, /flyers, /deck-builder, /demo-slide, /template-demo (unreachable on Docs2Video now). Share page /watch unchanged (light).
- **Guards:** `tests/videos-only-dark.test.ts` (no maker entry on Home/top bar/menu/step 1/any Docs2Video screen; help/how-to/help-chat don't offer decks or graphics; redirects + refusals Docs2Video-only; proxy order; old items open/download/delete; dark default + saved choices; /watch light; no LightOnly / white boxes on converted screens — each shown to fail on a planted bad value). Updated: round-c, names, make-screen-price. e2e: new `videos-only-dark.spec.ts`; app-pages (Library tabs), step1-about, step3-make updated.
- Shots: `.shots/videos-only-dark/` — `before-*` (light, old), `after-*` (fresh visit = dark), `after-light-*` (Light saved), 1440 + 375.
- **Needs:** Vercel deploy only. No migration, no render-service change.

### Same day — nobody types "https://" (owner request)
- **One helper:** `app/_lib/normalize-url.ts` — `normalizeUrl()` trims, adds https:// when there's no scheme (a typed http:// is kept), lower-cases the host, drops the lone trailing "/", refuses spaces, other schemes (javascript:, mailto:, data:, ftp:), user:password@ and hosts with no dot; `tidyUrlInput()` for boxes (cleans on blur, keeps what was typed if it can't). `cleanWebLink` (settings links, https only) now uses it.
- **Boxes** (type="text" inputMode="url" autoComplete="url", "yourcompany.com"-style placeholders, cleaned on blur/submit): create step 1 website, commercial page, create/brand (both), AddBrandPiece, brands/new (website, logo address, import-from-website), brands/[id] (website, logo address, LinkedIn/X/Instagram/Facebook), settings booking + payment links, public /try. Step 1 says "That doesn't look like a website — try something like yourcompany.com" for junk.
- **Routes cleaning it first:** extract-url (so v1 brief/videos/presentations get it too), brand-from-url (old normUrl removed), reference-url, scrape-brand, generate-commercial (BEFORE the DNS "does this site exist?" check; junk → 400 `bad_url`), generate-slides, try-demo. generate-video has no website field.
- Guard `tests/normalize-url.test.ts` (helper cases incl. junk; no type="url" or "https://" placeholder left on those screens; routes call it; commercial cleans before the DNS check). e2e placeholders/messages updated (home, step 1, settings). Help: creating-videos, FAQ booking link, help-chat prompt.

## 2026-10-09 — UI round C: one type + spacing scale, light/dark switch (not deployed)

- **Type scale** (globals.css `:root`, "TYPE SCALE"): caption 12 · small 13 · ui 14 · body 15 · lead 18 · h3 22 · h2 28 · h1 34, each with a line height (`--fs-*`, `--lh-*`). Kit classes `.kit-text-caption … .kit-text-h1`; Tailwind names `text-caption … text-h1`. Old `--font-*` names now point at the scale. Picked from what the screens already used (13/14/12/15 were ~80% of all sizes) + VidWiz's small-UI/big-heading rhythm.
- **Spacing scale** `--space-1…8` = 4/8/12/16/24/32/48/64 (already existed); every `gap` on the converted screens now uses it (off-scale gaps snapped to the nearest step, ties up: 6→8, 10→12, 14→16, 20→24). Kit `.kit-row`, `.kit-stack`, `.kit-gap-1…7`. The create rail's gap went 28→24 (not 32) so step 3's column keeps its width.
- **Converted screens:** Home, Library, create steps 1–4 + brand/commercial/making, result page (videos/[id]/**), Clients, Brands (+ editor/guide), Settings/account area, Analytics, Affiliate, Activity, every help page, share page /watch, kit.css, the app sections of globals.css (buttons → container, wizard parts → activity row, create rail/workspace), and the shared parts they wear (top bar, bell, help chat, buy-credits, script editor, scene chat, send-email/SMTP/upgrade modals, toast, confirm, video player…). **Counts** (app/(dashboard) + app/(public)/watch): hand-set font sizes 1,396 → 601, distinct values 34 → 29 — what's left is admin, Text2Art's design screens and the retired/legacy tools (left alone). On the converted screens: 801 hand-set sizes / 25 distinct values → 2 allow-listed hero sizes (the 56px "making" percent, the step-3 title clamp) + the email HTML file (share-email.ts, untouched on purpose).
- **Light / dark** (VidWiz's theme.tsx pattern): System / Light / Dark in Settings → Profile → **Appearance**; one-line **Dark mode / Light mode** in the account menu. Rules in `_lib/theme-pref.ts` (localStorage `d2v.theme`, every touch in try/catch; nothing saved = System); the before-paint script (`THEME_BOOT_SCRIPT`, inline in `<head>` of app/layout.tsx, `suppressHydrationWarning` on `<html>`) sets `<html data-theme>` so there is no white flash. `_components/theme.tsx` = `ThemeChoice`, `ThemeToggle`, `ThemeSync` (dashboard layout; follows the computer while on System).
- **Who goes dark:** one CSS block in globals.css ("DARK MODE") re-points every colour name, scoped `html[data-brand='docs2video'][data-theme='dark']:has(.app-themed):not(:has([data-light-only]))`. The dashboard layout wears `.app-themed` on Docs2Video only. **Stays light:** the share page /watch (outside the dashboard), the marketing site, Text2Art, and screens not checked in dark — admin, /design, /library (Text2Art), /flyers, /deck-builder, /demo-slide, /template-demo, /fix, /pricing, /social-media — which carry `<LightOnly />` (`_components/LightOnly.tsx`; remove it once a screen is converted + checked). Dark palette: navy-black grounds, cream words; the main button turns cream with navy words (`--on-ink`); mint fills become deep green, green words light. Literal `'white'` backgrounds on the converted screens → `var(--bg-card)`, white words on navy → `var(--on-ink)` (logo previews keep a white backing on purpose).
- Also fixed: **Clients on a phone scrolled sideways** (the button row and status chips didn't wrap).
- Guard: `tests/round-c-type-and-theme.test.ts` — scale defined; no hand-typed px sizes on the converted screens (allow-list; shown to fail on a planted `fontSize: 13`); dark has a value for every colour and every words-on-ground pair is ≥ 4.5:1 (and the check fails on a bad value); the boot script decides exactly what `resolveTheme` does (incl. blocked storage); dark scoping + LightOnly markers; Profile choice + menu toggle present.
- Help: Account article (Appearance), How-to-use (Settings + top bar), help-chat prompt. Shots `.shots/round-c/` — `before-*`, `after-*` (light), `dark-*` at 1440 + 375; `viewport-dark-*` for the long pages. Step 3 runs on a pretend draft in the shots (nothing saved).
- **Needs:** Vercel deploy only. No migration, no render-service/Remotion change.

## 2026-10-08 — UI round B: account area, tighter Home, plain words, hover + focus (not deployed)

- **Settings = an account area (VidWiz layout).** Menu down the left with icons (phones: one row you swipe; the current item scrolls into view): Profile · Billing & credits · Brand kit · Email & sending · Analytics · Affiliate · AI Social (only with `social_addon_active`, or when sent to `?tab=social`). Pure rules in `settings/account-sections.ts` (`sectionFromParams`, `accountItems`, `currentItem`); menu `settings/AccountShell.tsx` (client) + `settings/AccountLayout.tsx` (server, reads the add-on flag) worn by `settings/layout.tsx`, `analytics/layout.tsx`, `affiliate/layout.tsx` — Analytics and Affiliate keep their own addresses. Text2Art: no Email & sending / Analytics.
- **Old links still land:** `?tab=subscription|plan|credits` / `?credits=` / `?plan_changed=` → Billing; `?tab=integrations` / `?email_connected` / `?email_error` / `?stripe_connected` → Email & sending (Profile on Text2Art, where the API keys are now); `?tab=social` → AI Social; junk (incl. `__proto__`) → Profile. Stripe portal return URL untouched.
- **Where things moved:** Profile = your details, security, photos, **API keys** (was Integrations), "Run the setup again" (was "Re-run Setup Wizard" at the top), **Delete account** at the bottom (was "Danger Zone" under every tab; same two confirms). Email & sending = connected email, booking link, payment link, **view alerts** (same component as Activity → Notifications). AI Social = social accounts + voice/topics (was in Integrations) + "Open AI Social". Brand kit = the default-brand card (logo upload, Edit colors, See all brands; empty state → + New brand). The old Affiliate card under Subscription is gone — Affiliate is a menu item. The hidden "Default Template" block was dropped (removed by product decision earlier).
- **Billing & credits** (`settings/BillingSection.tsx`): three cards — Current plan (name, price from pricing.ts, renew/ends date, Manage billing & invoices), Credits available (balance, bar = monthly credits left vs the plan's TIER_CREDITS or the period's grant, pack credits in words, Buy credits), This period (credits used, since date) — then Plans, Credit packs (credit-packs.ts), Invoices and receipts (See invoices, Cancel subscription on paid). Same calls as before (`/api/stripe/portal`, `/api/subscribe`, BuyCreditsModal). New **read-only** `GET /api/billing/summary` (credit_balances + Stripe subscription period end; never writes; renew date left out if Stripe can't be asked).
- **Avatar menu = shortcuts:** Settings, Billing & credits, Analytics, AI Social, Affiliate, Help Center, Admin, Sign out (`top-bar.ts`). Text2Art's frozen ClassicHeader unchanged.
- **Home:** six compact tiles (icon · title · one line; 3×2, two across on phones) under small grey labels CREATE / TODAY'S CLIENTS / RECENT (`kit-label`, `kit-tile` in kit.css; `_home/start-cards.ts` adds Paste your text + Your brand). The blue free-credits / cardless bars are now one slim line beside CREATE; the past-due warning stays (status). "This month" links to Billing & credits.
- **Plain words:** failed project = "This one didn't finish." + what to do + "Try again" / "Start a new project" (`FailedCard.tsx`, `FAILED_WORDS`); Library heading = `NAMES.library` everywhere on Docs2Video (tabs read "Videos", "Slide decks"…); Brands h1 "Brands"; Clients (Add a client, Save client, Yes, delete, Edit client, Add note, Make a video for this client, Import a CSV file); quote/follow-up labels; making-screen stages; Analytics labels; Brands editor/guide headings; help titles sentence case. Text2Art's "My Library" left alone (its own screens).
- **Hover + focus in kit.css:** clickable cards (`.kit-card--link`, `a.card`, `.kit-tile`) lift 2px with the accent-ink edge; one focus ring for every link/button (incl. old `.btn`) and text boxes; `prefers-reduced-motion` turns lift/transitions off.
- Help: account article rewritten for the account area; getting-started, FAQ, pricing, sharing, social-sharing, index; How-to-use (Home + Settings); help-chat prompt. Guards: `tests/round-b-account-and-feedback.test.ts` (old URLs, menu, billing reads only, stiff-word scan, kit hover/focus/reduced-motion — each shown to fail on broken code). e2e updated: app-settings (menu, old URLs, Analytics/Affiliate menu), settings, subscription, redesign-home, top-bar, app-pages, brands, light-start. Shots: `.shots/round-b/` (before-/after-, 1440 + 375).
- **Caught by the e2e run and fixed:** with sections in the address, the Settings data load re-ran on every section change and wiped a half-typed payment link; it now loads once (guarded in the round-B test).
- Checks 2026-10-08: tsc 0, vitest 826 passed / 2 skipped, next build OK, Playwright battery (port 3100) 327 passed / 8 skipped / 0 failed (1 flaky: step-3 "Make it" test, passed on retry; that screen wasn't touched).
- **Needs:** Vercel deploy only. No migration, no render-service/Remotion change.

## 2026-10-08 — UI round A: Library cards, one icon set, focus header (not deployed)

- **Library = picture cards** (VidWiz's library layout, D2V colours). `app/(dashboard)/videos/`: `page.tsx` (server, same two queries; the videos select now also reads `duration` and `first_slide:slide_urls->>0` — one short string per row, no per-card queries; if that select errors it falls back to the old columns so the Library never empties), `Library.tsx` (cards, search "Search by name or client", order Newest/Oldest/Name A–Z, Cards/List switch remembered in localStorage `d2v.libraryView` with try/catch, paging 24/48/96, the delete confirm), `CardMenu.tsx` ("…" menu: Open, Send, Delete…), `LibraryTable.tsx` (the old table = List view; on phones Type/Recipient/Credits/Created fold away and the status sits under the title), `library-items.ts` (pure: status words, Send link, open link, search/sort), `library.module.css`. Status line: "Ready to send · 1:30" (green), "Making… 65%" (amber), "Didn’t finish" (red), "Draft — not made yet". Ready videos get **Send** → `/videos/<id>#send` (the send panel now has `id="send"` and scrolls itself into view). Delete is only in the "…" menu, behind "Delete this for good?". Pictures: thumbnail, else first slide picture, else Custom Graphics' own image file; otherwise a placeholder per kind (never a broken image — failed loads fall back too). Tabs moved onto the kit tabs. **No view counts** on cards: per-video views need the `video_views` rows (analytics reads them all) — not cheap for 400+ items; left out.
- **One icon set: lucide-react 1.47.0** (VidWiz's). Added to package.json + package-lock by hand (2 entries) because `npm install` rewrites ~11k lockfile lines here (the lockfile is already out of step with `remotion/package.json` via `file:remotion`), and a real install also pulled @remotion 4.0.534 packages into the root and disturbed `remotion/node_modules`; restored (`npm ci --legacy-peer-deps` in remotion/, stray root packages removed) — `npx remotion versions` shows one version (4.0.290). Icons (16 in buttons/menus, 20 for bell/menu/start cards/choices; lucide sets aria-hidden): top bar (New, Library, Clients, Brands, How to use, credits, bell via new `icon` prop on NotificationBell — Text2Art's classic bar keeps its drawn bell, ☰/×), Home start cards, step 1 sources (kit `Choices` got an `icon` slot), step 3 outputs (hidden on phones), result Download/More menus + items, title pen, send panel (Send, copy link, copy email, someone else, sent tick), Library card menu, Settings tabs.
- **Focus header on every /create page** (incl. the making screen and the commercial maker): `Header.tsx` swaps the full bar for ← Home · the four step numbers (from `create/_components/workspace/steps.ts`, same list as the rail; done = mint tick, now = navy) · How to use · credits. Phone: arrow, numbers only, a **?** menu (How to use this screen / Ask the help assistant — the ☰ menu isn't there), the balance. `isFocusPath`/`focusTitle` in `top-bar.ts`. The step rail and its "Saved as you go" note stay.
- Help: new article `/help/library`, help index + inline Library article + "Home and the top bar" updated, How-to-use Library guide rewritten, help-chat prompt (Library cards + focus header).
- Guards: `tests/round-a-library-and-focus.test.ts` (renders the Library and the header for real; status words, Send only on ready, no Delete until the menu, DELETE only from the confirm box, focus header on /create only — proven to fail on broken code). e2e: `app-pages.spec.ts` Library tests rewritten for cards (paging, search, Cards/List remembered, Delete via menu + Cancel, Send → send panel, draft card), `top-bar.spec.ts` reads the + New button's name. Shots: `.shots/round-a/` (before-/after-, 1440 + 375).
- **Needs:** Vercel deploy only. No migration, no render-service/Remotion change.
- **Custom Graphics pictures are signed once per page** (`videos/library-pictures.ts`): their address is `/api/flyer-file/<id>` (owner check + redirect), and 18+ of those at once filled the browser's connections to our site — every click on the Library waited ~5 s (the e2e run caught it). Now one `flyer_designs` query (this user's ids, 200 at a time) + one `createSignedUrls` batch (1 hour); any failure keeps the old address. Card links don't prefetch. Measured: Library → Brands 5.5 s → 0.4 s.
- **Open:** those graphic cards still load the full-size file (up to 2550×3300) because the rows have no thumbnail — lazy-loaded with the placeholder underneath; a small thumbnail saved with the design would make the page lighter.

## 2026-10-07 — Overhaul phase 5: light start (not deployed)

- **No card before the free preview.** Before: signup → "Add your payment method" (card) → 5-page setup wizard → Home. Now on Docs2Video: signup → Home → first project → step 3 free preview, no card. The card is asked for only when "Make it" is pressed (video, presentation, deck, commercial → `/setup-payment?next=…` and back). Rules in `app/_lib/light-start.ts` (`afterSignupPath`, `landingAfterEmailLink`). Changed: `app/_actions/auth.ts` (lands on Home; the `d2v_ref` affiliate cookie is now recorded at signup — the wizard used to do it), `auth/confirm` + `auth/callback` (old email links with `next=/setup-payment` land on Home), dashboard layout (no forced `/setup`), `/setup` (no card redirect; still at Settings → Re-run Setup Wizard), `/setup-payment` (goes back to `next` or Home; "Not now" link). **Text2Art keeps card-first.**
- **Abuse still blocked, unchanged:** `spendBlockReason` (credits.ts) refuses every spend for a free/trial account without a card, so the 2,000 trial credits stay tied to the card; `confirm-card` still needs a Stripe-confirmed card (audit C2). New: a daily cap on free AI work for cardless accounts only (`app/_lib/cardless-prep.ts`, 30/UTC day in the existing `rate_limits` table) on extract, extract-url, extract-doc, combine-docs, brief, brief/chat, generate-script, ai-edit-scenes, style-previews; extract/extract-url let `card_required` through (other blocks still stop). `generate-presentation` and `generate-commercial` now answer `card_required` (were "not enough credits"); step 3 and the commercial page send it to the card page. `/api/credits/buy` sends cardless accounts to add a card first (bought credits couldn't be spent otherwise). Home shows "Try it before you add a card." with **Add a card** for cardless accounts.
- **Brand inside the first project:** step 3 "Add your brand" opens in place (by itself on a first project with no brand): name, website + **Fill in from it** (`/api/brand-from-url`, no AI), **Upload your logo** (`/api/brands/logo`, the Brands page's processing), two colours, **Save my brand** → `createProjectBrand` (shares `newBrandRow` with the Brands page's `createBrand`; first brand becomes default) and sets the draft's `brandId`. Real logos only; no logo → name as text. `create/_components/make/AddBrandPiece.tsx`, pure helpers `app/_lib/brand-quick.ts`.
- **Context-aware help:** each How-to-use guide has `asks` (suggested questions). The help widget shows "On this screen: …", opens with that screen's questions and sends `page`; `/api/help-chat` adds the screen's guide to the prompt via `helpContextFor` (the address only looks up a guide — never pasted into the prompt). **Fixed:** tapping a suggested question sent nothing (it read the old empty box). Panel has a Close button. Prompt now covers the light start, the free preview and Add your brand.
- **Phones:** the round help button is in the ☰ menu on Docs2Video ("Ask the help assistant") — it sat on a start card and above the pinned button; the panel opens as a bottom sheet. The pinned step button and the round help button (computer) sit above the cookie notice (`--bottom-bar`) — the e2e run found the help button was under it too.
- Help: getting-started, creating-videos, brands, account, FAQ ("Do I need a card to try it?"), pricing, index updated. e2e guard also blocks `/api/help-chat`, `/api/brands/logo`, `/api/brand-from-url`.
- Guards: `tests/light-start.test.ts` (cardless reaches preview; cardless can't spend — credits.ts run for real with a mocked DB), `tests/help-page-context.test.ts`, `tests/brand-in-project.test.ts`, `e2e/light-start.spec.ts`. Shots: `.shots/phase5-light-start/`. Checks 2026-10-07: tsc 0, vitest 786 passed, next build OK, Playwright battery 326 passed / 8 skipped / 0 failed.
- **No migration.** Needs: Vercel deploy only. Optional owner to-do: change the Supabase "Confirm signup" email template's `next=/setup-payment` to `next=/dashboard` (the code already redirects it, so not required).

## 2026-10-07 — Look sample pictures remade with made-up content (not deployed)

- The 18 look samples (`public/style-samples/{slides,aurora,cinematic,editorial,explainer,infographic}-{cover,data,closing}.png`, shown on step 3 and the marketing home) showed real names (PubcoZone, Valor Financial, a real IUL product, real people, ACME, "AI in Church"). Remade from a made-up story: "Your Coverage at a Glance" for "The Rivera Family", by "Your Agency", $500,000 / $142 a month / Age 65, 555-0142 + example.com. No logo, no photo.
- Drawn by the real renderers through the free-preview path (`buildPreviewPlan` → render-service pure helpers → Remotion stills): `npx jiti scripts/look-samples/make-look-samples.ts [look…]`. Content lives only in `scripts/look-samples/sample-content.ts`.
- No paid AI: Cinematic uses the licence-free Pexels bokeh photos already in `remotion/public/pexels-bg-{1,2,3}.jpg`; Infographic shows its code-drawn ground.
- Guard: `tests/look-samples-content.test.ts` fails on the old names or any `CARRIER_BLOCKLIST` entry in the sample content.
- Older unused files in the same folder (warm-story, scifi, steampunk, etc. `-cover/-content.png`) are referenced by nothing and were left alone.

## 2026-10-07 — Overhaul phase 4: the result page, built around sending (not deployed)

- **Result page split** (`app/(dashboard)/videos/[id]/`): `page.tsx` (~300 lines) wires `result/` (header, Download ▾ / More ▾ menus, `output.ts`, `downloads.ts`), `send/` (Ready to send + What's left), `change/` (Ask-for-a-change bar, routing, change log, older scene editor), `viewing/` (Who watched), `extras/` (Quote / Invoice + Follow-Up Plan tabs, Social posts dialog), `making/` (progress + failed). Was one 2,700-line file.
- **One send panel.** The older "Send to Your Client" window and the 10-button grid are gone. Kept in the panel: a name for an unknown client, **Send to someone else**, **Copy the email** (rich + plain, sends nothing), insurance disclosure on copied links, which mailbox it sends from. The sent/opened trail moved to Who watched.
- **What's left** chips above Send (`send/whats-left.ts`): client email, note, booking link, profile photo, name, payment link for a shown quote — only checkable things; each jumps to the fix. Brand left out on purpose (a finished video can't take one).
- **Ask for a change** (`change/change-route.ts`): presentations/decks → slide editor (`/videos/[id]/edit?ask=&slide=` — tries the request on arrival, lists every AI change with Undo, `?restore=` puts back pre-rebuild slides); Slide Deck look videos → Fix-a-Scene (now a kit Dialog, opened on the chosen scene/fix); other looks with slide pictures → the older scene editor (the old "Edit Video" window, KEPT — only in-place path for them; free; rebuilds from slide pictures); looks with neither → **Make a changed copy** (duplicate). Prices from credits.ts. Changes listed with Undo (localStorage, this browser only).
- **Downloads** in one menu, only what exists (video PDF/PowerPoint only when slide pictures exist; Export video for interactive presentations with its price).
- **Who watched** (`app/api/videos/[id]/viewing`, `app/_lib/viewing.ts`): per email sent — email opened, how far into the video in quarters (the finest the share page reports) and when, Book/Pay clicks; other viewers by device. Share emails now link `/watch/<id>?s=<sent_emails id>`; the share page copies `s` into each event's metadata. **Fixed:** watch milestones were never sent for looks without slide pictures. Links to the existing view-alert setting (`/activity#view-alerts`). **No migration.**
- e2e guard now also blocks `/api/fix-scene`, `/api/reedit-presentation`, `/api/ai-edit-scenes`. Guard tests: `tests/result-page.test.ts`. Help: new article `/help/making-changes`; sharing, downloads, FAQ, creating-videos, social-sharing, index, help assistant prompt and How-to-use updated.
- **Needs:** Vercel deploy only (no render-service or Lambda change).
- **Fixed after phase 4 — older scene editor's per-slide AI edit** (`/api/edit-slide`): it sent the slide's web address to Gemini where image bytes were expected (every edit failed), and it was never charged. Now the route downloads the picture itself — only from our own Supabase storage (`app/_lib/our-storage-image.ts`: https, our project host, `/storage/v1/object/…`, no redirects, 20 MB cap, PNG/JPEG/WebP bytes) — then charges `CREDIT_COSTS['scene-edit']` via `runCharged` (charge before AI, refund on any failure), saves the result to `videos/<user>/<video>/edits/` and returns its address (was a multi-MB data: URL that then rode along in Save & Regenerate). The Apply button and the help article show the price from credits.ts. `/api/re-render` (Save & Regenerate) also used to fetch any address the browser sent — now the same storage-only check. The do-nothing **Redo** button is hidden. Guard: `tests/edit-slide-route.test.ts` (runs the real route with mocks; no paid AI).

## 2026-10-07 — Overhaul phase 3: the workspace, free preview, honest waiting, ready email

- **Workspace:** every create step (incl. the making screen) = step rail left, work middle, "Your video so far" right (client, source, one point, output, look, voice, length, server price; "charged" on the making screen). Phones: "Step N of 4 · …" line, main button pinned bottom, summary folds under. Main buttons say what they do and cost; a held-back button says why + "Show me". Moved onto the kit.
- **"Here's what we read"** on step 1: summary, the one point, figures used exactly as written — editable, figures removable; reuses the brief step 2 already made (no extra AI call).
- **Honest waiting:** step 1's timer bar → real stages; the making screen shows the render service's own words ("Drawing scene 3 of 6", written by `server.js`) and Home's percentage.
- **Free first-scene preview** (owner: still + voice, 3/account/UTC day, admins unlimited, never charges): `app/api/preview-first-scene`, `app/_lib/first-scene-preview*.ts`, `create/_components/make/FirstScenePreview.tsx` on step 3 for videos and presentations. Stills from the real renderer per look (render-service `/preview-still`, Remotion still mode in `DirectedVideo.tsx`/`Root.tsx`); Cinematic/Infographic leave out the paid AI picture, Editorial/Explainer pick layout in code (noted under the image). Cap stored in the existing rate-limit table — no migration. < 1¢ per preview; repeats cached and free.
- **Ready email existed but was never called** — now sent once per project when anything finishes (video, presentation, deck, commercial), from the stuck-video cron / completion paths, plus a bell notice; skipped for drafts, prospect demos, tests, and when the owner is still on the making screen (`/api/videos/<id>/ready-seen`). Needs RESEND_API_KEY on Vercel. Home: "Finished while you were away".
- **Text2Art phone menu:** light side panel with close button (desktop bar unchanged).
- Skipped on purpose: "hold credits, then charge" — videos are all-or-nothing and failures already refund, so it would change nothing for customers.
- **Deployed 2026-10-07:** Lambda site `docs2video` (still mode, verified with a live render) → Vercel (main d171435) → ECS image `sha256:b9a38ab3…` (digest verified on the running task; `/preview-still` answers). The Remotion package mix-up from the earlier sharp reinstall was fixed with `npm ci --legacy-peer-deps` in remotion/ (all 4.0.290).
- **Open:** look sample thumbnails on step 3 show real names (PubcoZone, Valor Financial, "QoL Max Accumulator+ III") — regenerate with neutral content; cookie notice covers the pinned phone button until dismissed.

## 2026-10-07 — Chosen voice in every look + header compliance scrub (not deployed)

- **Voice:** one rule for every narrated look (`app/_lib/voice-choice.ts`, mirrored by `render-service/slides.js` `wantsChosenVoice`): Sarah/nothing picked → ElevenLabs first; any other voice → that OpenAI voice first, ElevenLabs only as fallback. Fixed in `render-service/server.js` `ttsToBuffer` (Aurora, Cinematic, Infographic, Editorial, Explainer) and `app/_lib/tts.ts` `synthesizeSpeech` (interactive presentations). Free preview now uses the pick for every look; its "only the Slide Deck look uses the voice you pick" note is gone.
- **Compliance:** `complianceScrubberFor` / `makeComplianceScrubber` in `app/_lib/compliance.ts`. Editorial/Explainer masthead + running title (raw doc title) and every Claude-written page string, and V3 footer chips / metric labels / hero label (raw key metrics), now go through the shared scrub. Agent name, contact line, client name and figures untouched. Title that is only a product name → "Your Personalized Illustration".
- Guard: `tests/voice-choice-and-header-scrub.test.ts` (each check proven to fail on the old code).
- **Needs:** Vercel deploy (app side) + new ECS render-service image (server.js). No Remotion/Lambda change.

## 2026-10-07 — Overhaul phase 2, steps 3–4: kit, top bar, home, How to use

- **Kit:** `app/kit.css` (loaded once in `app/layout.tsx`) + `app/_components/kit/` — Button (price slot, disabled reason), Card, Choices, Note, Tabs, Chip, EmptyState, Dialog. Colours from the token names only; corners ≤ 10px (`tests/kit.test.ts`). Later phases move screens onto it.
- **Top bar** (`app/_lib/top-bar.ts`, `Header.tsx`): + New (navy button), Library, Clients, Brands; the logo goes Home ("Dashboard" link gone); How to use, a GOLD credit chip (amber below one standard video — the old green chip's "low" check never fired), bell, avatar. Avatar menu: plan, Analytics, AI Social, Affiliate, Settings, Help Center, Admin, Sign out; closes on Escape/outside click. Phone: the words + How to use sit in ☰. Text2Art uses a frozen copy of the old bar (`ClassicHeader.tsx`) so it is unchanged. Guard `tests/top-bar.test.ts`, `e2e/top-bar.spec.ts`.
- **Home:** "Start something new" cards first — From a document / a website / an idea / A commercial (`_home/start-cards.ts`); each opens Step 1 with that source chosen via `/create?source=upload|url|ai` (`app/_lib/create-sources.ts`), commercial → `/create/commercial`; "Paste your text" link under them. Then Today's clients, then Projects with This month. The dark "Start from a document" box and the new-user 4-step list are gone. Guard `tests/home-start-cards.test.ts`.
- **How to use:** top-bar button → in-app dialog with numbered steps for the current screen (Home, create steps 1–4, Library, result, Brands, Clients, Settings; others get "Getting around"), content in `app/_lib/how-to-use.ts`, a slot for a short video per screen (none recorded yet). Guard `tests/how-to-use.test.ts` checks every bold word in a guide appears on its screen.
- Help articles, the help index and the help assistant prompt updated; the waiting screen's "Dashboard" buttons now say "Home".
- **Open:** Text2Art's phone menu is still the old full-screen dark cover with unreadable links (frozen on purpose — owner's call). The floating help button overlaps a start card on phones.
- Local note: deleting a throwaway build copy removed `node_modules/sharp`; restored with `npm install sharp@0.34.5 --no-save` (lockfile unchanged).

## 2026-10-07 — Overhaul phase 2, step 1: one colour set

- App, share page and marketing site share ONE colour set — the redesign's warm cream (#F4F1EC), navy (#0B2545) and mint (#C7E8A8) — defined once in `app/globals.css`; the marketing `--mk-*` names are aliases of the app names. Cyan is gone.
- `--mint` (cyan, used for fills AND words) split by job: `--accent` fills, `--accent-ink` (#2F6B3A) words/edges/progress on light, `--link` (#1F5FA8) links, `--gold` money only (so far the share-page quote total). Primary buttons navy with white words; words on mint fills are navy. Progress bars, selected edges and spinners use `--accent-ink` (mint on the light track measured 1.1:1).
- Hand-typed colours in dashboard + shared components + share page: 811 → 219 (the rest are Text2Art's wizard 70, logo creator 33, look swatches 18, and content colours: brand defaults, social logos, chart series, client emails).
- Text2Art unchanged: a block in `globals.css` keeps its blue; 5 screens compared pixel-identical. `--mint-darker` stays (≈100 uses) because Text2Art overrides it.
- Contrast: every text/background pair ≥ 4.5:1 (weakest 4.67); the three pairs that would fail are never combined (noted in `globals.css`).
- Guard: `tests/one-colour-set.test.ts` fails if `--mint` comes back, typed colours rise above 219, a marketing colour gets its own value, a pair drops below 4.5:1, or Text2Art's overrides go missing.
- Left for later steps: credit chip still bright green (step 4 makes it gold); cookie banner typed (shared with Text2Art); the `/design` wizard is Text2Art's system.

## 2026-10-06 — Overhaul phase 1: clean house (branch `redesign/marketing-site`)

Phase 1 of the overhaul modelled on VidWiz, One Dollar Decks and Restylez (report: https://claude.ai/code/artifact/8a9fe3c5-63c4-4430-a14c-3f7593a730d6; phase 2 plan: `docs/overhaul-phase-2-one-look.md` — the app adopts the redesign's cream/mint/navy).

- **Retired tools deleted for real:** ads, brand-kit, business-cards, course-builder, email-signature, headshot, image-remix, infographic-creator, social-campaigns, social-kit, templates, `/infographics`, and the first infographic maker `/api/generate` (still charged 300 credits to a direct POST). ~10,900 lines. Redirects in `next.config.ts`; guard `tests/retired-tools.test.ts`. `/logo-creator` and all logo code kept as-is.
- **Create flow dead ends fixed:** Step 2 has Length (Short / Standard / Detailed → `detailLevel`, priced 500 / 1,000 / 1,500; changing it after the story exists offers a free "Rewrite at this length"); Step 3's "Change the length" lands on it. Duplicate (`/create?duplicate=<id>` → `app/api/videos/draft/duplicate`) copies the user's own project into a new draft at step 2. Waiting-screen tips true per output type. ~500 unreachable lines removed from Step 1. Guard `tests/create-flow-dead-ends.test.ts`.
- **One name per thing:** shared words in `app/_lib/names.ts` — "+ New", "Library", "Brand(s)"; library kinds. The $10 pack is "Small" (packs in `app/_lib/credit-packs.ts`; the internal key stays `'starter'`). Avatar menu shows the real plan ("Business plan", "Free trial"…), no longer "Free Account" for Business/Enterprise/trial.
- **Prices from one place:** Settings, pricing page, commercial page, top-up window, MP4-export button, help articles, the help index and the help assistant's prompt all read `pricing.ts` / `credits.ts` / `credit-packs.ts`. Guards `tests/screen-prices.test.ts`, `tests/help-chat-knowledge.test.ts`.
- **Library tabs:** All · Videos · Presentations · Slide Decks · Custom Graphics, kept in the URL.
- **Result page:** "Chat Messages" stat and the unreachable Translate window removed.
- **Help:** index and the help assistant rewritten for the 4-step flow (they still described the old 8-step one).
- **Owner to-do:** rename the live Stripe product "Starter Credit Pack" → "Small Credit Pack" (checkout and receipts still say Starter).

## 2026-09-30 — Text can never leave the frame: every creation system audited (commit 27080db)

**Deployed 2026-09-30:** Remotion Lambda site `docs2video` redeployed (production renders go through it — `REMOTION_SERVE_URL` IS set in SSM) and the ECS service rolled to image `sha256:69039e5b…` (digest verified on the running task, healthy). Proof: the customer's failing scenes rendered on the live Lambda show the card wrapped inside its box. **Vercel (app-side: decks/PPTX/PDF, /design preview, signatures, compliance scrub in the app, v3/editorial payload builders) goes live when 27080db is pushed to `docs2video/main`.**

Trigger: customer video 590fe9f6 (infographic style) showed "100% High Cap Rate Ac" with the stat card half off the right edge — a model-written value in a card built for "$10,000", a `1fr` grid column that grew to its longest word, and `white-space: nowrap`.

**The shared fix (videos):** `remotion/src/lib/fit.tsx` — `<Fit>` (one run of text: wraps at spaces, shrinks the font until it fits the width / `lines` / box height, measured on the real rendered text in the real font; `sizeFor` sizes count-ups by the FINAL value) and `<FitBox>` (a group scaled down together to fit a box of definite height; put plain text inside, never `<Fit>`). Never overflows: below `min` it keeps shrinking to 14px and logs `D2V_FIT_SMALL`. Parents must be bounded: `minmax(0, 1fr)` not `1fr`, `minWidth: 0` in flex rows.

**The checker (videos):** `cd remotion && npm run qa:overflow [-- <filter>]` (`scripts/overflow-qa.mjs`). Renders the REAL compositions from `src/qa/cases/*.tsx` (real customer data + worst-case text + normal text per engine) with `src/qa/OverflowGuard.tsx` measuring every word: off-frame, clipped, out-of-box, box-off-frame. Release gate: `npm run qa:overflow:gate` (`scripts/overflow-gate.mjs`) — every case with `QA_OVERLAP=1 QA_SEQUENCE=4`, which also fails on text over text / text under a logo and renders 4 warm-up frames first in the same tab like a real render (caught a bar-label bug single stills missed). It runs in batches of 8 cases, one process each: a single ~700-frame run crashed Remotion's console source-map reader. A planted-broken self-test runs every time; if the guard misses any planted fault the run FAILS. `data-overflow-ok` / `data-overlap-ok` opt-outs need a reason in the attribute. Stills: `remotion/out/qa-overflow/`.

**Engines fixed (before → after):** infographic (14 → 0; also: `heroMetric` was ignored, the headline figure vanished), V3 cinematic/aurora (169 → 0; body text now stays above the corner logo), editorial/explainer/time (212 → 0; also: step numbers were invisible, bars mis-scaled), commercial all 22 styles (1062 → 0), VisualDirector (699 → 0), slide deck / DirectedVideo, the default style (2818 → 0; also: a card value "100% High Cap Rate Acct (S&P 500 Index)" showed as "100%", a date range as "10", "6.35%" as "6.4%", and `slides.js` chopped on-screen text mid-sentence — a value is now a rolling number only if it is wholly a number, and text is shortened only at a clause break), classic `/generate` fallback slide + `gemini.ts` fallback (text now wraps/shrinks).

**Presentations + decks:** `app/_lib/presentation.ts`, `presentation-exports.ts`, `pptx-generator.ts` — HTML deck 2492/4350 slide-views broken → 0 (37 decks × 10 window sizes incl. phone share player and the 1920×1080 MP4 capture); PPTX 38 → 0 boxes (sizes from real letter widths); PDF drops/encoding failures → 0. Checker: `node scripts/deck-overflow-check.mjs` (~13 min). Decks ALREADY SENT keep the old HTML until rebuilt (any edit rebuilds; a bulk rebuild needs owner OK — it writes live storage).

**Other graphics tools:** `/design` live preview headline (the email-signature and brand-kit tools were deleted 2026-10-06). Checker: `node scripts/graphics-overflow-check.mjs`. AI-drawn lettering (flyers, social, cards) can only be steered by prompt — prompts demand safe margins.

**Also fixed on the way:** `/render-editorial` dropped `timeline`/`chart`/`matrix`, so those magazine pages shipped with only a title (server.js); `isHeadlineFigure` (v3-render.ts) promoted sentences with ",000" to the giant hero number; the compliance name-scrub (both copies: `app/_lib/compliance.ts` + `render-service/slides.js`) cut detected tokens out of the middle of words — shipped videos said "or inal illness" and "The Long- Upside" — now whole words only, generic insurance words (Term, Long, Whole…) are never taken for product names, and blocklisted carriers are still stripped next to a hyphen ("AIG-backed"). Guard: `tests/compliance-word-boundary.test.ts`.

**Any future change under `remotion/src`:** redeploy the Lambda site (`cd remotion && npx remotion lambda sites create src/index.ts --site-name=docs2video --region=us-east-1`, REMOTION_AWS_* keys from .env.local in the shell) AND rebuild the ECS image (VisualDirector renders from the image, and server/slides/commercial/present-export live there) — render-service/DEPLOY.md. In Git Bash, SSM paths like `/docs2video/X` get rewritten by MSYS (ParameterNotFound) — use PowerShell.

**Known gaps (not overflow):** commercial `quote.sub` and `meet.kicker/pre/hot` are written by the director but never shown; infographic ignores recipient/contact/presenter; commercial props are deleted after render so real commercials can't be re-checked; phone share player is 341×192 (everything thumbnail-sized).

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
| fal.ai | `FAL_KEY` (optional `FAL_TTS_MODEL`) | PRIMARY narration voice (ElevenLabs turbo v2.5 via fal, since 2026-10-09); Drawn slides pictures |
| OpenAI | `OPENAI_API_KEY` | TTS voice fallback, logo styling (GPT Image) |
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

0. **Slide-deck videos on Lambda (fixed 2026-10-08).** Since the Lambda switch (2026-09-02) DirectedVideo dropped `assetBase` in calculateMetadata and lambda-render never uploaded the voice clips / music (names built in code), so renders used the stale dir-vo/dir-bd files bundled from `remotion/public` (our own "Meridian Financial Group" demo) — or crashed when a presenter photo was set. Fixed (1f55a75, 92ef43a), Lambda site now published ONLY via `remotion/scripts/deploy-lambda-site.sh` (sfx + music only; the old site carried 2.5 GB / 2,775 scratch files publicly). Live check: `npx jiti scripts/look-samples/lambda-smoke.ts`. Affected finished videos: 8f39b650 (owner's own) and d8bb1e42 (Aziz Ali) — Aziz's remake rendered and verified; swapping it into storage needs the owner to run it (blocked for the assistant). Retry for create-flow projects now goes back to step 3 (it used to start nothing).

1. E2E suite rewritten for the 4-step app on 2026-09-27 (see the section at the top). Action cards on Home, the first-visit screen and the billing-portal button can't be exercised with the current test account (it has none of them).
2. Logo kit generation is async — may not complete before user navigates away. Also: after a logo upload on the brand page the kit is made from the logo SAVED on the profile (the new one isn't saved until "Save"), so the first kit is built from the old logo — or fails on a first upload. The kit isn't shown anywhere in the app; owner to decide whether to keep it.
3. ⚠️ ACTION REQUIRED: Cartesia API key `sk_car_q3LX...` was committed to git history (commit ff100f4) — rotate it in the Cartesia dashboard and set `CARTESIA_API_KEY` env var on the VPS. Code no longer hardcodes it.
4. `app/_lib/music-generator.ts` and `synthesizeAllScenes` in `app/_lib/tts.ts` are dead code — music/TTS for the main pipeline run on the VPS. Candidates for removal.
5. Webhook idempotency unique index: run `supabase/legacy/supabase-webhook-idempotency-migration.sql` against the DB.
6. `FAL_KEY` is not set in production → print sizes in Custom Graphics are resized, not AI-upscaled (lettering can look soft on posters/signs). `upscaleForPrint` logs "upscale skipped … no FAL_KEY configured". Fix: set `FAL_KEY` in Vercel. No page promises print-ready output or upscaling any more.
7. Outlook connect needs the `MICROSOFT_*` env vars in production (the button is replaced by a note until they are set).
8. ~~`/infographics` unlinked~~ — deleted 2026-10-06; old email links redirect to Home.
9. A stuck run that is restarted keeps going on the render service if it was actually alive; if it later fails on its own it refunds by charge number, which can give back the NEW run's charge too. Rare (needs a stuck-looking run that then fails), and in the customer's favor.
10. Audit 2026-09-26: see the consolidated section at the top — migrations, env vars, render-service redeploy, Supabase settings and the Stripe double-billing check are still owner to-dos.
11. ~~Older scene editor's per-slide AI edit always failed and was free~~ — fixed 2026-10-07 (see phase 4 section). Not yet tried with a real Gemini call (tests use mocks); try one slide edit after deploy. Edited pictures are kept under `videos/<user>/<video>/edits/` and are not cleaned up.

### Audit 2026-09-26 — content / pricing / help / nav / SEO details

- **Pricing truth** — customer-facing plan statements match pricing.ts + credits.ts (help center, Text2Art landing, /pricing, /plans, setup page, settings plan cards, upgrade modal, help-chat prompt). Removed claims the code never enforced (priority generation, free slide edits, bulk creation).
- **Commercial "Buy more"** opens the top-up modal (was a 404).
- **AI Social** in the account menu (desktop + mobile; "Add-on" tag if not subscribed); posting cost disclosed.
- **Nurture emails** — no more "no card needed"; the discount code is entered at checkout.
- **Orphan tools retired** — /headshot, /logo-creator, /templates, /infographic-creator, /email-signature, /image-remix, /course-builder, /brand-kit → home; /ads, /business-cards → /design; /social-kit, /social-campaigns → /social-media. 2026-10-06: pages and APIs DELETED (except /logo-creator, kept as-is); permanent redirects live in `next.config.ts`; `tests/retired-tools.test.ts` fails if any comes back.
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
