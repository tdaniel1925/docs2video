# Build prompts — Art Direction (all makers) and Logo Studio

Paste to a build agent in `C:\dev\1 - Restylez`. Two prompts; run them in order. Both carry the same header.

## Shared header (paste at the top of each)

You are a senior full-stack engineer in the Restylez app at `C:\dev\1 - Restylez` (Next.js 15; Supabase schema `restylez`; OpenAI `gpt-image-2` for images, `gpt-4o-mini` for copy and vision checks; billing via `lib/billing.ts` / `lib/admin.ts` (`chargeJob`, prices from admin settings, "Billing on" switch, super-admin never blocked); Brands in `app/brands` + `lib/store.ts`; Looks in `lib/looks.ts`; Help in `lib/help.ts` + `app/help`; CSS `rz-*` classes in `app/globals.css`, radius max 10px; plain-English copy in the app's voice; Title Case sidebar). Dev server already runs on http://localhost:3005 (hot reload) — do NOT start another. Super-admin login: `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` in `.env.local` (never print them). Playwright + sharp from `C:\dev\1 - PrismGraphs` (see `scripts/rz-flow-test.mjs` for login; own-it checkbox must be ticked before run buttons enable).

**UX is the owner's priority: the app is uncluttered and must stay that way.** Read `app/new/page.tsx`, `app/logo/page.tsx` and `app/admin/settings/page.tsx` first and match them: one screen, numbered stations, one-sentence helper under every heading, one primary button per step with the price on it, no tabs-within-tabs, no badges everywhere, `rz-*` only, no new UI libraries. Screenshot every state at desktop and 390px, LOOK at them yourself (Read tool) and fix anything cramped, overlapping or busy before finishing.

**Ship rules:** `npx tsc --noEmit` and `npx next lint` clean on touched files (no `Date.now()` or other impure calls inside client component bodies — use module-level helpers); commit in sensible steps (co-author `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`); push; wait for `npx vercel ls restylez --scope bot-makers` to show Ready (on Error: `npx vercel inspect <url> --logs`, fix, push). Never print or commit secrets. Don't modify `C:\dev\1 - PrismGraphs`. Note: OpenAI credit may be zero — if generation calls fail with a credit/quota error, build and test everything up to the call, mock the response locally for the UI test, and say so in the report.

---

## Prompt 1 — Art Direction on every maker

Problem: the user picks a look but has no way to say how the final piece should differ from the sample (e.g. "swap the phone on the desk for a notepad", "no people", "use my storefront photo", "more white space"). Add that to New Design (`app/new`), Remake and Restyle (`app/make`), and Slide Decks (`app/deck`), without cluttering them.

### Build
1. **Art direction field.** In each maker, directly under the look/reference section (New Design station 2; Remake's "The look to copy"; Deck's Style step), add one optional multi-line input labelled **"Art direction (optional)"** with helper: *"Anything you want different from the sample: swap the objects, no people, use my photo, more space."* Placeholder shows two short examples. Speak button (reuse `Mic.tsx`).
2. **Guided pills** above the box — clicking a pill inserts a ready sentence into the box (editable): Imagery: *Keep the sample's objects* / *Swap the objects for my photos* / *No objects, just type*. People: *No people* / *Illustrated people* / *Use my photo*. Feel: *More white space* / *More punch* / *Darker* / *Lighter*. Text: *Bigger headline* / *Smaller small print*. Keep it to those four rows, collapsed under a small "Quick choices" link on mobile.
3. **Prompt wiring.** Pass `artDirection` to `app/api/create`, `app/api/remake` (both modes) and the deck routes. In the prompt builders, add a clearly delimited block: `ART DIRECTION FROM THE CUSTOMER (these override the sample where they conflict): …`. Sanitise (max ~600 chars, strip prompt-injection phrases like "ignore previous"). Never let art direction add text to the design that the user didn't put in the words box — say so in the prompt.
4. **"Before you make it" summary.** Immediately above the primary button, a compact one-line-per-item card: Look · Words (first line) · Art direction (or "none") · Size(s) · Price. Read-only, updates live. This replaces any duplicated hints already there — do not add a second summary.
5. **Persistence.** Store `artDirection` on the saved design (`lib/store.ts`), and pass it through automatically to the Editor's fix rounds, Sizes (extra sizes), and "More like this" so every derivative inherits it. Show it read-only on those pages as "Art direction: …" with an "Edit" link back.
6. **Help.** Add one step to the New Design, Remake and Slide Decks guides about art direction (screenshot + close-up via `scripts/help-shots.mjs` pattern), and a FAQ line "Can I say what the picture should be?".
7. **Test.** Playwright as super admin: type art direction "swap the phone on the desk for a notepad, no people" in New Design, confirm the summary card shows it, confirm the API request body carries it (intercept the request; do NOT press Make if credit is zero), open a saved design in the Editor and confirm the read-only line shows. Screenshots to `C:\Users\tdani\AppData\Local\Temp\claude\C--dev-1---PrismGraphs\b49a578b-8a92-4baa-9740-01972f39bb4f\scratchpad\artdir-*.png`.

Report (under 200 words): what changed on each maker, how art direction reaches the prompt, screenshot paths, commits, deployment status, anything untested because of credit.

---

## Prompt 2 — Logo Studio (replaces Logo Maker's flow; $149 / $299)

Problem: $29 and a one-shot grid says "generator". The owner wants a serious, agency-style process priced like one. Rebuild `app/logo` as **Logo Studio** with structured rounds, a project timeline, a presentation page and two tiers. Keep the existing engine pieces (`lib/logo*.ts`, `app/api/logo`, kit/zip/trace, spelling gate, brand save) and rework the flow and UI around them.

### Tiers (add both to admin Prices and the account "What things cost" list)
- **Logo Studio — $149** (`logo_studio`): brief → 9 directions → 3 refinement rounds, each round returns **3 variations** of the chosen direction → final → kit + saved brand + presentation page.
- **Logo Studio Plus — $299** (`logo_studio_plus`): everything above, plus unlimited rounds for 14 days, a second direction explored in parallel, a one-page brand guide (colours with hex, fonts, spacing/clear-space rule, three don'ts) as a PDF, social avatar set + favicons, and a **brand starter set** (one flyer, one business card, one social post made in the new brand through the existing create/sizes engines).
- Extra rounds beyond the plan: **$15** each (`logo_round`). Charge on delivery of each round, never on failure. Keep the famous-name refusal and the trademark note.

### Flow and UI (one screen, a timeline on the left, the current stage on the right)
1. **Timeline** (left rail, sticky): Brief → Directions → Round 1 → Round 2 → Round 3 → Final (Plus shows "Rounds (14 days)" and "Brand guide"). Current stage highlighted; past stages clickable and read-only; each shows its date and a one-line note ("Round 2: heavier ridge line, greener").
2. **Brief** (reuse the current brief card) plus a tier picker as two side-by-side cards with plain bullet lists and one button each ("Start Logo Studio — $149" / "Start Plus — $299"). Only one primary button visible once a tier is picked.
3. **Directions**: the 9-style grid as now, but titled "Nine directions". Buttons per card: "Take this direction" (primary, one at a time) and "Try another take" (regenerates that style once, free). Plus users may mark a second direction to explore in parallel.
4. **Rounds**: heading "Round N of 3" (or "Round N" on Plus). Left: the chosen concept large. Right: "What should change this round?" sentence box + Speak + chips ("Heavier letters", "Simpler symbol", "Try it in green", "More space", "Darker version"). Submit returns **three variations** shown side by side with "Take this one further" and "Keep the previous one". Every variation is kept in the version strip. Round notes are saved as the timeline line.
5. **Final**: "Mark as final" leads to the **presentation page**: the logo shown on a business card, a storefront sign, a phone screen and a t-shirt (compose these in code over static mock images in `public/mock/` — generate those four mock backgrounds once with the image model if missing, or draw simple flat mocks in CSS; never re-draw the logo itself), then the kit downloads (existing), "Save as my brand" (existing, default on), and for Plus the brand guide PDF (build with the existing PDF helper used by Sizes, or `pdf-lib`) and the starter set.
6. **Emails**: when a round is ready (if it runs longer than ~2 minutes) send the existing branded email ("Round 2 is ready") via the Resend helper from the promo feature; skip if not configured.
7. **Library & admin**: the project appears in the Library as one "Logo project" card with its stage; admin Jobs shows "Logo Studio" and the round number; prices editable in Settings.
8. **Help**: rewrite the Logo guide for the new flow (steps: brief & tier, directions, rounds, final & presentation, kit & brand); update the "How to Use" pill.
9. **Migration**: existing Logo Maker jobs/kits keep working and show as "Final" in the new timeline. Sidebar label becomes "Logo Studio".

### Test
Playwright as super admin: brief → pick $149 → directions render (mock the image responses if credit is zero) → take a direction → round 1 with a sentence → three variations → take one → round 2 → mark final → presentation page renders all four mocks → kit zip downloads → brand saved and visible in New Design's brand picker; then a Plus run exercising the second direction and the brand guide PDF. Screenshots (desktop + 390px) to `…\scratchpad\logo-studio-*.png`.

Report (under 300 words): the flow as built, prices and charging points, what the presentation page shows, what was mocked because of credit, screenshot paths, commits, deployment status, anything left undone.
