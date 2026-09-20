# Build prompt — Brand presets: saved recipes, not one look

Paste to a build agent in `C:\dev\1 - Restylez`.

---

You are a senior full-stack engineer in the Restylez app at `C:\dev\1 - Restylez` (Next.js 15; Supabase schema `restylez`; the browser library is IndexedDB via `lib/store.ts`; brands live in `app/brands/page.tsx` with the `Brand` type in `lib/store.ts`; looks in `lib/looks.ts`; the makers are `app/new`, `app/thumbnails`, `app/make`, `app/deck`; CSS `rz-*` in `app/globals.css`, radius max 10px). Dev server already runs on http://localhost:3005 — do NOT start another. Super-admin login: `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` in `.env.local` (never print them). Playwright + sharp from `C:\dev\1 - PrismGraphs`.

**UX priority:** the app is uncluttered and must stay that way. Match `app/new/page.tsx` and `app/logo/page.tsx`. `rz-*` classes only, one primary button per step, one-sentence helpers, plain English, no new UI libraries, no tabs-within-tabs. Screenshot every changed state desktop + 390px, LOOK at them yourself, fix anything cramped before finishing.

**Ship rules:** `npx tsc --noEmit` and `npx next lint` clean on touched files (no impure calls in client component bodies). `git pull --rebase` before pushing. Commit in steps (co-author `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`), push, wait for `npx vercel ls restylez --scope bot-makers` Ready. Never print or commit secrets. Don't modify `C:\dev\1 - PrismGraphs`. Do NOT run `next build` against the running dev server.

## The problem

A brand today holds one logo, some colours and ONE look (`lookId`). But a real business has two or three modes it uses again and again — the one with the owner's photo, the one that is just logo and tagline, the one built around a product shot. Today the customer rebuilds those choices from scratch every time. The tenth piece should be as fast as typing the words.

## What to build

### 1. Data (`lib/store.ts`)

Extend `Brand`:

```ts
/** Pictures this brand reuses — a headshot, a storefront, product shots. */
type BrandPicture = { id: string; label: string; blob: Blob; kind: 'person' | 'product' | 'place' | 'other' }

/** A saved recipe: everything except the words. */
type BrandPreset = {
  id: string
  name: string                 // the customer's own name for it, e.g. "With my photo"
  lookId?: string              // from the Looks library
  pictureIds: string[]         // which brand pictures to place (max 4, same cap as New Design)
  useLogo: boolean
  logoCorner?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  useTagline: boolean
  artDirection?: string        // standing instructions, e.g. "no people, more white space"
  sampleThumb?: Blob           // a small picture of a real piece made with it
  updatedAt: number
}
```

Add `pictures: BrandPicture[]`, `presets: BrandPreset[]` and `tagline?: string` to `Brand`. Everything optional so existing brands keep working untouched — a brand with no presets behaves exactly as it does today.

### 2. The Brands page

Under each brand, a **Presets** section: the saved recipes as small cards, each showing its sample thumbnail (or a neutral placeholder), its name, and a one-line summary built from the recipe — *"Neon Night · your photo · logo bottom-right"*. Actions per card: **Use it** (goes to New Design with it applied), **Rename**, **Delete**. One **Add a preset** button opens a compact editor: name, look (the existing picker), which pictures, logo on/off and corner, tagline on/off, art direction. Keep it to one card; do not add a second page.

Also add a **Pictures** section to the brand: upload, label, and set a kind. These are the pictures presets can place. Same paste-anywhere behaviour as New Design.

### 3. Save a preset from a finished piece — the important half

People do not know what they want until they see it. On any finished piece in New Design (and in the Library's design view), add a quiet **"Save this as a preset"** link. It opens a one-field prompt for the name and captures the look, pictures used, logo setting, tagline and art direction from that piece, plus a thumbnail of the result. This is the primary way presets should get created; the Brands-page editor is for tidying them up afterwards.

### 4. Using a preset

In New Design station 2, when a brand is selected, show its presets first as a row of small cards, then *"or pick any look"* leading to the existing picker. Choosing a preset sets the look, the pictures, the logo and tagline flags and the art direction in one click — all still editable afterwards. The "Before you make it" summary must name the preset it came from.

Do the same in Thumbnails (station 3). Slide Decks and Remake should accept a preset's look and art direction where they already accept those; do not force presets into flows that have no place for pictures.

### 5. Rules that keep it honest

- A preset is a starting point, never a lock: everything it sets stays editable.
- No preset is applied automatically. The customer picks one, or picks a look, exactly as they do now. (The owner has just removed default looks; do not reintroduce a default by the back door.)
- Real logos and pictures are always placed by code, never redrawn — unchanged from today.
- Cap presets at 12 per brand and pictures at 12, with a plain message at the limit.

### 6. Help

Add a step to the Brands guide (or a short new guide if that reads better) covering presets: what they are, saving one from a piece you liked, and using one. Screenshots via the existing `scripts/help-shots.mjs` pattern.

## Test

Playwright as super admin: create a brand with a logo and two pictures; make one piece; save it as a preset named "With my photo"; confirm the card shows the right summary and thumbnail; start a new piece, apply the preset, and confirm the look, pictures, logo and art direction are all set; confirm nothing is applied until the preset is clicked; confirm an existing brand with no presets behaves exactly as before. Screenshots to `C:\Users\tdani\AppData\Local\Temp\claude\C--dev-1---PrismGraphs\b49a578b-8a92-4baa-9740-01972f39bb4f\scratchpad\preset-*.png`. Keep live generation to one piece.

Report under 250 words: what a preset stores, how one gets created from a finished piece, where they appear, what happens for a brand with none, screenshot paths, commits, deployment status, anything left undone.
