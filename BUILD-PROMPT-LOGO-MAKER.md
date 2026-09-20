# Build prompt — Restylez Logo Maker (Step 1)

Paste this to a build agent (or run it as a Claude Code task) in `C:\dev\1 - Restylez`.

---

You are a senior full-stack engineer in the Restylez app at `C:\dev\1 - Restylez` (Next.js 15; Supabase schema `restylez`; OpenAI `gpt-image-2` for images and `gpt-4o-mini` for copy; billing via `lib/billing.ts` / `lib/admin.ts` (`chargeJob`, `balanceCents`, prices from admin settings, the "Billing on" switch and super-admin never-blocked rule); Brands in `app/brands` and `lib/store.ts`; CSS classes `rz-*` in `app/globals.css`, radius max 10px; plain-English copy in the app's voice; Title Case sidebar). A dev server runs on http://localhost:3005 (hot reload) — do NOT start another. Super-admin login is `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` in `.env.local` (never print them). Playwright is available from `C:\dev\1 - PrismGraphs` (see `scripts/rz-flow-test.mjs` for login). Read before writing: the New Design page (`app/new`), the Editor (`app/edit`), the Brands page, the remake route, the billing helpers, and the Help section pattern (`lib/help.ts`, `app/help`).

## Build: Logo Maker

A new tool, **Logo Maker**, at `/logo`, first-class in the sidebar ("Logo Maker", after New Design). It makes an ORIGINAL logo for a business that has none. Standing rule unchanged: never redraw a logo a customer already has.

### 1. The brief (one card)
- Business name (required), tagline (optional), what you do (one line, required), mood (pills: Bold, Minimal, Elegant, Playful, Warm, Retro, Modern, Hand-made), colours (two colour swatches with "you choose" default), "must include" (optional free text, e.g. "a coffee bean"), "must avoid" (optional).
- Helper text in the app's voice. Price shown on the button: "Make 9 concepts — $29" (read the `logo` price from admin settings; add it to the admin Prices list with a default of 2900 cents and to the account "What things cost" list).

### 2. Nine concepts
- Route `app/api/logo/route.ts` (POST). It writes nine prompts, one per style: wordmark, monogram, badge/emblem, script, icon + name, stacked, retro, minimal mark, negative-space mark. Each prompt: "Professional logo design, flat vector style, centred on a plain solid background with generous margin, no mockup, no shadows, no gradients, no photo. Brand: … Style: … Spell the name exactly …, no other text." Use `gpt-image-2`, 1024×1024, quality high, run 3 at a time, and never imitate a famous logo (add a line to the prompt).
- A spelling gate: after generation, run `gpt-4o-mini` vision over each concept asking only "Does this image spell the name exactly as '<name>' (and the tagline if present)? Answer yes/no." Regenerate any "no" once. Show only passing concepts; if fewer than six pass, regenerate the misses again.
- Show the nine in a 3×3 grid with the style name under each and two buttons per card: "Refine this" and "More like this" (generates three variations of that style).
- Charge $29 once on success through `chargeJob` (tool `logo`); failed runs charge nothing; log with `jobLog` like the other tools. Respect the "Billing on" switch and the low-balance nudge / 402 pattern the other pages use.

### 3. Refine by sentence
- Picking a concept opens a refine panel like the Editor: a text box ("Make the letters heavier", "Try it in green", "Add a coffee bean"), a Speak button (reuse `Mic.tsx`), and quick chips. Each round is an `images.edit` on the chosen concept with the instruction. First 3 rounds free, then the existing `fix` price. Keep every version; "Keep this version".

### 4. The kit
- On "Use this logo": produce and store the kit in the library as a `logo` item: full colour PNG, black, white (both on transparent), on-dark and on-light previews, a square icon (1024 and 512) cropped to the mark, favicon-size 64, and a traced SVG (use a tracer such as `potrace`/`imagetracerjs` — add the dependency; if tracing quality is poor for a concept, still deliver PNGs and say "vector not available for this one"). Transparent versions: request `background: transparent` from `gpt-image-2` for the final via an edit, or remove the flat background in code.
- Download all as a zip ("Logo kit — Ridgeline Coffee.zip") plus individual downloads.
- "Save as my brand": creates/updates a Brand with this logo and the two main colours (sample them from the logo) so every later piece pins it by code.

### 5. Honesty and limits
- A plain note above the grid: "These are original drawings made for you. We can't promise a mark is unique or trademarkable. If you plan to register it, have a trademark search done first."
- Never generate for names that are famous brands; if the name matches a well-known brand, refuse with a friendly message.

### 6. Help and admin
- Add a Logo Maker guide to Help (`lib/help.ts`): steps with screenshots captured by Playwright, tips, "if something goes wrong". Add the "How to Use" pill.
- Admin: the `logo` price in Settings; jobs show tool "Logo Maker".

### 7. Test
- Playwright as super admin: fill the brief for "Ridgeline Coffee", generate, confirm 9 concepts render and all pass the spelling gate, refine one ("make the letters heavier"), pick it, download the kit zip, open it and confirm files, save as brand, then open New Design and confirm the brand picker lists it. Screenshot the grid and the kit page to `C:\Users\tdani\AppData\Local\Temp\claude\C--dev-1---PrismGraphs\b49a578b-8a92-4baa-9740-01972f39bb4f\scratchpad\logo-maker-*.png`. Clean up test items.
- `npx tsc --noEmit` and `npx next lint` on touched files must pass (no `Date.now()`/impure calls in client component bodies — use module-level helpers). Commit on main (co-author line: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`), push, wait for `npx vercel ls restylez --scope bot-makers` to show Ready (on Error: `npx vercel inspect <url> --logs`, fix, push). Never print or commit secrets. Don't modify `C:\dev\1 - PrismGraphs`.

Report in plain language under 300 words: what was built, prices and charging, the spelling-gate pass rate in the test, screenshot paths, commit hashes, deployment status, anything left undone.

---

# Build prompt — Looks Library (Step 2)

Same header as above (repo, server, login, rules). Read `lib/demo.ts` (the four house looks), `app/new/page.tsx` (station 2), `lib/sizes.ts`, the remake route (`restyle` mode), and the deck builder.

## Build: Looks Library

### 1. Generation run (script, then curation)
- `scripts/looks-generate.mjs`: for each look in `scripts/looks-catalog.json` (write it: ~300 entries, each with `id`, `name`, one-paragraph style description, `occasions[]`, `industries[]`, `moods[]`, `needsPhoto`, `density`), generate a six-piece set with `gpt-image-2` for the sample brand "Ridgeline Coffee": title slide, numbers slide, points slide (16:9), flyer (portrait), business card (landscape), square post — the deck cover first, then the rest as `images.edit` with the cover as the reference, exactly as proven in the samples. Spelling gate with `gpt-4o-mini` vision; regenerate misses once. Save to `public/looks/<id>/<piece>.jpg` (JPG q82, max 1200px long side) plus a 480px thumbnail. Resumable, 4 at a time, prints cost estimate.
- Auto-tagging pass: `gpt-4o-mini` vision writes/validates the tags and the two main colours per look; write back to the catalog. I will skim a contact sheet per batch and delete weak ones.

### 2. Data
- `lib/looks.ts` exports the catalog (import the JSON), `SIZE_GROUPS`-style constants for OCCASIONS, INDUSTRIES, MOODS (use the exact lists from the owner's category map), and helpers `filterLooks`, `lookById`.

### 3. Looks page `/looks`
- Three filter rows as pills (occasion, industry, mood), a search box matching name/tags in plain words, a grid of thumbnails; hover cycles flyer → post → card; click opens a look page `/looks/<id>` showing all six pieces, the tags, and buttons: "Use for a New Design", "Restyle a design of mine with this look", "Build a deck in this look", "Save as my brand look".
- Signed-out readable (add to middleware PUBLIC + sitemap); "Sign in to use" on the buttons.

### 4. Wire into tools
- New Design station 2: replace the four house looks with a "Pick from the library" picker (modal with the same filters) and keep "Copy a design I have".
- Remake (restyle mode) and Slide Decks: same picker where a look image is accepted. The picked look's flyer image is the reference passed to the engine; no own-it checkbox for house looks.
- Brands: "brand look" field (look id); when set, New Design preselects it.

### 5. Test, quality, ship
- Playwright: filter, search, open a look, use it in New Design (do NOT press Make), save as brand look. Screenshots to the scratchpad. tsc/lint clean, commit, push, Vercel Ready. Keep repo images under ~120 MB total; if larger, upload the set images to the Supabase `help`-style public bucket (`looks`) and reference URLs instead.

Report: number of looks generated and kept, spelling-gate pass rate, total generation cost, where Looks appears, screenshot paths, commits, deployment status.
