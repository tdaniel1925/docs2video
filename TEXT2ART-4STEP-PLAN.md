# Text2Art — 4-page flow (Docs2Video-style wizard) + spot-editing

## The good news, up front

Almost everything the hard parts need **already exists and works** in this repo.
This is not an engine rewrite. It is mostly reorganising working pieces into
four pages, plus a modest amount of new glue.

| Piece | Status |
|---|---|
| AI spot-edit backend (`/api/flyer-edit`) | ✅ EXISTS — mask + instruction → repaint one region, saves as new design, ownership + credits handled |
| Mask-drawing editor UI (`Viewer` in flyer/page.tsx) | ✅ EXISTS — paint a region, type a change, calls flyer-edit |
| Style picker + 105 looks + reference drop | ✅ EXISTS (step-3 picker + styleBrowser) |
| Generate (`/api/flyer-art`) + credits + save | ✅ EXISTS |
| Sizes, logo/photos, brand colours | ✅ EXISTS (rail steps) |
| Docs2Video wizard pattern (layout + progress bar + save-for-later) | ✅ EXISTS at `app/(dashboard)/create/*` — copy the shape |

So the work is: **wire the existing parts into 4 routed pages**, and **lift the
editor out of its modal onto its own page**. No new AI model, no layered-doc
engine, no months.

---

## The 4 pages (your flow)

New route so `/flyer` stays live and untouched until this is proven. Proposed
base: `/design` (or `/make` — your call).

```
/design           STEP 1 · STYLE   — pick a look OR drop a reference; add logo/photos
/design/words     STEP 2 · WORDS   — say what goes on it (type, or drop a doc/URL)
/design/make      STEP 3 · SIZES   — pick sizes, see the cost, press Generate
/design/edit      STEP 4 · EDIT    — see the designs; spot-edit any region on a preview
```

A shared `layout.tsx` (copied from `create/layout.tsx`) draws the progress bar
("STEP 2 OF 4 — WORDS"), the save-for-later, and holds the wizard state.

### STEP 1 — Style  (`/design`)
- The 6-suggested-looks grid + "See all 105" browser (reuse `styleBrowser`),
  and drag/drop-a-reference (reuse `attachReference`).
- Below it: your logo / photos (reuse `PhotoSheet`) + "use my brand colours".
- The chosen look shows in a preview panel (reuse the preview-stage we built).
- "Next: what goes on it →".

### STEP 2 — Words  (`/design/words`)
- One big box: type the words (headline, date, price, phone). Or drop a
  PDF/Word/PPT, or paste a website — reuse `readDoc` / `takeFromUrl`.
- Deck vs flyer wording comes from the existing `contentGuidance(kind)`.
- Shows the brief card of what it understood. "Next: sizes →".

### STEP 3 — Sizes + Generate  (`/design/make`)
- The size list grouped + per-size credit (reuse `sizesPicker`), lead group by
  `orderedGroups(kind)`.
- The cost + "credits left after" line.
- **Generate** → calls `/api/flyer-art` (exists), shows progress, then routes to
  step 4 when the designs are ready.

### STEP 4 — Edit  (`/design/edit`)
- The finished designs in a strip. Click one → it fills a big **preview canvas**.
- **Spot edit (your choice B):** drag a box over any region (the price, a word,
  the logo), type the change ("$25", "make this red"), press Change → calls the
  existing `/api/flyer-edit`, which repaints ONLY that box and saves a new
  version (old one kept, so undo is free). Reuse the `Viewer`'s mask canvas —
  lift it out of the modal onto this page.
- Download · make another size · start another.

---

## What's actually NEW (the real work)

1. **`app/(dashboard)/design/layout.tsx`** — copy `create/layout.tsx`, relabel
   the 4 steps, keep save-for-later. (~1 hr)
2. **Wizard state** — the current page holds everything in one component's
   useState. Split across 4 pages needs shared state that survives navigation.
   Two honest options:
   - **localStorage** (what Docs2Video's wizard uses — `d2v_create`). Simplest,
     matches the pattern. Risk: images are big; store ids/text, not raw image
     data. (recommended)
   - React context in the layout. Cleaner in-memory, lost on refresh.
3. **4 page files** — each is mostly a *move* of an existing block out of
   `flyer/page.tsx` into its own page + a Next/Back button. (~1 day total)
4. **Lift the `Viewer` editor onto `/design/edit`** as a full page instead of a
   modal — same canvas, same flyer-edit call, more room. (~half day)
5. **Nav + entry** — point "Custom Graphics" / the New-design button at
   `/design`. Keep `/flyer` reachable until you flip the switch.

## What is NOT needed (so you know the scope is honest)
- ❌ No new image model. `/api/flyer-edit` already does inpainting via
  `images.edit`.
- ❌ No layered-document engine. Spot-edit works on the flat PNG via masks.
- ❌ No rebuild of generation, credits, storage, ownership — all reused as-is.
- ❌ `/flyer` is not deleted; it stays as the fallback until `/design` is proven.

## Cost & time (honest estimate)
- Steps 1–3 wired as pages: **~1–1.5 days**, mostly moving working code.
- Step 4 editor lifted to a page: **~0.5 day**.
- Testing all four live (Playwright walk-through + screenshots) + a new
  `wizard-check.mjs` that proves each Next/Back works and state survives: **~0.5 day**.
- **Total: ~2–3 focused days.** No new external cost; spot-edits cost the
  customer 1 design's credits each (already priced that way).

## Risks / calls to make
- **State across pages.** The one genuinely new thing. localStorage is the
  proven path here; I'll store text + ids + the round id, never raw images.
- **Route name.** `/design`, `/make`, or replace `/flyer`? (You chose: new
  route, keep `/flyer`.) Pick the word.
- **Both storefronts.** `/flyer` serves Docs2Video and Text2Art. The new
  `/design` route will too — copy stays brand-neutral (`useBrand()`), same as now.
- **The editor is spot-edit (B), not full Canva (C).** Draw a box + describe →
  AI repaints that box. Real, works today. If you later want true drag-the-text
  (C), that IS the months-long engine change — separate project, flagged.

## Verify (same discipline as everything else)
- Typecheck clean.
- New `scripts/wizard-check.mjs`: walk 1→2→3→4, assert each page loads, Next/Back
  move correctly, state (style, words, sizes) survives navigation, and the edit
  page can open a design + reach the flyer-edit call. Proven to fail before trusting.
- Existing checks (`steps-check` etc.) still pass on `/flyer` (untouched).
- Screenshot each of the 4 pages, desktop + phone.
- Commit each page as its own commit; flip the nav last.
