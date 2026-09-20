# Build prompt — Thumbnail Maker

Paste to a build agent in `C:\dev\1 - Restylez`.

---

You are a senior full-stack engineer in the Restylez app at `C:\dev\1 - Restylez` (Next.js 15; Supabase schema `restylez`; OpenAI `gpt-image-2` for images and `gpt-4o-mini` for copy/vision; billing via `lib/billing.ts` / `lib/admin.ts` (`chargeJob`, prices from admin settings, the "Billing on" switch, super-admin never blocked); sizes in `lib/sizes.ts`; looks in `lib/looks.ts`; brands in `app/brands` + `lib/store.ts`; help in `lib/help.ts` + `app/help`; CSS `rz-*` in `app/globals.css`, radius max 10px; plain-English copy in the app's voice; Title Case sidebar). Dev server already runs on http://localhost:3005 (hot reload) — do NOT start another. Super-admin login: `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` in `.env.local` (never print them). Playwright + sharp from `C:\dev\1 - PrismGraphs`.

**UX is the owner's priority — the app is uncluttered and must stay that way.** Read `app/new/page.tsx` and `app/logo/page.tsx` first and match them exactly: one screen, numbered stations, a one-sentence helper under every heading, one primary button per step with the price on it, no tabs-within-tabs, `rz-*` classes only, no new UI libraries. Screenshot every state at desktop and 390px, LOOK at them yourself (Read tool), and fix anything cramped or busy before finishing.

**Ship rules:** `npx tsc --noEmit` and `npx next lint` clean on touched files (no `Date.now()` or other impure calls inside client component bodies — use module-level helpers). Commit in sensible steps (co-author `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`), push, wait for `npx vercel ls restylez --scope bot-makers` to show Ready (on Error: `npx vercel inspect <url> --logs`, fix, push). Never print or commit secrets. Don't modify `C:\dev\1 - PrismGraphs`.

## Build: Thumbnail Maker at `/thumbnails`

Sidebar "Thumbnails" in Title Case, after Logo Studio. The job: scroll-stopping thumbnails and post images, made in batches, tested at the size people actually see them.

### Station 1 — What's the post about
- One required box: *"What's the post about?"* with helper *"One or two sentences. A link to your own page works too — we'll read it."* Speak button (reuse `Mic.tsx`).
- If the text is a URL, fetch and summarise it with the existing `lib/fetch-url.ts` reader (respect its safety rules; on failure say so plainly and let them type instead).
- Optional: **a photo to feature** (upload or paste — reuse the paste-anywhere pattern from New Design) and **my own headline** (if they already have one, skip the angle generator for it but still offer alternates).
- Platform pills (multi-select, default Facebook post): Facebook post, Facebook ad, Facebook event cover, Instagram post, Instagram story, X post, YouTube thumbnail, LinkedIn. Map each to the existing `SIZES` entries; add any missing YouTube/LinkedIn thumbnail sizes to `lib/sizes.ts` with correct pixels.

### Station 2 — The angle (the real value)
- On "Suggest angles" (free, `gpt-4o-mini`), return **five headline angles** for the topic, each labelled and each ≤ 6 words: **Bold claim**, **Question**, **Number**, **Before and after**, **Curiosity gap**. Show as five selectable cards with the headline large and a one-line note on why that angle works. The user picks one, edits the words inline, or writes their own.
- Rules in the prompt: never invent a fact, a statistic, a date or a price — if the topic doesn't supply one, use a bracketed blank. Never make a medical, legal or financial claim. Never name a real private individual. Keep it to 6 words or fewer.

### Station 3 — The look
- The looks picker (same modal as New Design), pre-filtered to looks that hold up small: `density: 'airy'` or `'balanced'` and moods bold / playful / sporty / neon / artsy. A "Show all looks" link removes the filter.
- Brand picker (existing): logo pinned by code, brand colours steer the design.

### Making them
- Primary button: **"Make 4 thumbnails — $15"** (new price key `thumbnails`, default 1500 cents; add to admin Prices and the account "What things cost" list). Charge once on success through `chargeJob` (tool `thumbnails`); a run that produces nothing charges nothing. Respect the "Billing on" switch and the 402 / low-balance pattern used elsewhere.
- Generate **four variations** of the chosen angle at the first selected platform size — vary composition (photo left / photo right / full-bleed photo with a type block / type-only), not the words.
- **Thumbnail rules baked into the prompt:** headline ≤ 6 words and the single dominant element; a featured face large and to one side; extreme contrast between type and background; nothing important in the outer 6%; no small print at all.
- **Platform safe zones** (respect in the prompt AND check after): YouTube — keep clear of the bottom-right duration stamp and the bottom bar; Facebook event cover — keep the lower-left clear of the date badge; any cover — keep the profile-picture corner clear. Encode these as a small table in `lib/thumbnails.ts`.

### The check that matters
- After generation, run a **small-size legibility proofer** (`gpt-4o-mini` vision): downscale each result to 320px wide, then ask ONLY: "At this size, is the headline instantly readable, and is there one clear focal point? Answer JSON {issues:[]}, empty if fine." Anything flagged gets one automatic repair pass, exactly like the remake route's proofer. Also run the existing safe-area/margin check for any print-shaped output.
- Show results in a **feed preview**: each thumbnail rendered at real feed size inside a simple phone-width frame, not full-bleed, so the user judges it the way their audience will. A "See it big" toggle shows full size.

### After
- "Make every size" turns the chosen thumbnail into the other selected platforms through the existing sizes engine ($3 each, the existing price).
- Everything saves to the Library as normal designs; the Editor's fix-by-sentence works on them; art direction (from the recent build) is supported and inherited.

### Help + admin
- A Help guide (`lib/help.ts`) with steps, screenshots and close-ups via the existing `scripts/help-shots.mjs` pattern, plus the "How to Use" pill on `/thumbnails`, `GUIDE_FOR_PATH` mapping and the sitemap.
- Admin: the `thumbnails` price row; Jobs shows "Thumbnails".

### Test
Playwright as super admin: type a topic ("our website design studio is booking new clients for spring"), get five angles, pick one, pick a look, make four (one real run — keep it to a single run), confirm the feed preview renders, confirm the small-size proofer ran (log it), send one to another size, confirm it lands in the Library. Screenshots (desktop + 390px) to `C:\Users\tdani\AppData\Local\Temp\claude\C--dev-1---PrismGraphs\b49a578b-8a92-4baa-9740-01972f39bb4f\scratchpad\thumbs-*.png`.

Report in plain language under 250 words: the flow as built, prices and charging, what the small-size proofer caught, screenshot paths, commits, deployment status, anything left undone.
