# Deck Restyle — upload a full PowerPoint/PDF deck → get the same content back, slide-for-slide, in a brand-new look

This is the prompt I'd give myself to build it. Reuse what exists; do NOT invent a
new generator or a new results page. Plain language throughout — Trent is not a
coder. Build phase-by-phase, each shippable, each verified with a check proven to
fail first. Both storefronts share the code.

## What the user gets
Drop in a full deck (`.pptx` / `.ppt` / `.pdf`). The app reads it **slide by
slide**, keeps each slide's words, and **redraws every slide in a style the user
picks**. Out comes a matching set of finished slide images + a downloadable PDF,
on the SAME `/design/results` page (download all / each, share, spot-edit).
Decided scope: images + PDF, NOT an editable `.pptx`. "Same content, brand-new
look" (keep each slide's content; discard the old visual design).

## What already exists — REUSE, don't rebuild
- `app/_lib/office-text.ts` → `extractPptxText()` ALREADY splits a PPTX into
  ordered, labelled blocks (`Slide 1:\n…`, `Slide 2:\n…`). This is the whole
  reason the feature is realistic. Parse those blocks; don't merge them.
- `/api/extract` reads PDFs via Claude's native PDF support (per-page possible).
- `/api/flyer-art` already takes `templateId` (the look), `sizeIds`, and per-call
  `fields` (headline/details/…). It saves a round + charges per image. The size
  `slide-16x9` (1920×1080) exists in `FLYER_SIZES`.
- `/design/results` already does preview + download all/each + share + spot-edit,
  and reads a round by `chatId`/`roundId`. The wizard's `useWizard` store + the
  `clearInputsKeepJob` finish-cleanup already work.
- The `deck` kind already exists in the wizard.

## The three genuinely-new pieces
1. **Split, don't merge.** A parser that turns the uploaded deck into an ORDERED
   LIST of slides, each `{ n, heading, bullets[] }`:
   - PPTX: split `extractPptxText()` output on the `Slide N:` markers (already
     there). Map each block's first line → heading, the rest → bullets.
   - PDF: ask Claude to return `{ slides: [{ heading, bullets }] }` — one entry
     per page/slide — instead of the current flattened `{title, sections}`. New
     system prompt variant; keep the old one for the single-design path.
   - Cap slides (e.g. 40) and TELL the user if the deck was longer (no silent
     truncation).
   - Detect **image-only / text-empty** slides (scanned PDFs, chart-as-picture):
     a slide whose block has almost no text. Flag these to the user ("3 slides
     look like pictures — we can only restyle slides that have text") rather than
     shipping a blank restyle.
2. **Draw one styled slide per slide.** Feed the list through `/api/flyer-art`:
   one design per slide, all with `sizeId: 'slide-16x9'`, the SAME `templateId`
   (chosen look) and `brandId`, so the deck is visually consistent. Pass each
   slide's `{ heading→headline, bullets→details }` as that call's `fields`.
   Preserve order (results already renders round.designs in order). It's one
   round of N designs → lands on `/design/results` unchanged.
3. **An entry point.** The `deck` kind in the wizard gains an "Upload a deck to
   restyle" path:
   - Step 1 (What): the "slide deck" card offers "Start from a deck I already
     have" → upload.
   - After upload + parse: show the slide list read back ("We found 12 slides")
     so the user can confirm/trim before spending. Then the normal Style step
     (pick the new look) and a Sizes step fixed to `slide-16x9`.
   - Skip the per-slide chat; the content came from the file. (They can still
     spot-edit any slide afterwards on results.)

## Flow (fits the existing 5 steps)
1. **What** → "A slide deck" → "Restyle a deck I have" → upload `.pptx`/`.pdf`.
2. **Parse + confirm** → "We found N slides" list; drop any; warn on image-only.
   Store the parsed slides in wizard state (a new `deckSlides` field).
3. **Style** → pick the new look (reference or premade). Logo/photos optional
   (placed on every slide's corner if given — reuse role:'logo').
4. **Sizes** → fixed to `slide-16x9` (skip or auto-select; no bleed for slides).
5. **Review** → "12 slides, restyled in <look>. ~N credits, ~M min." → red Start.
6. **Wait screen** → unchanged (facts + ads), but the generate call loops the
   slide list into ONE round of N designs.
7. **Results** → unchanged, PLUS a "Download as PDF" that stitches the slide
   images in order (client-side jsPDF or a small server route). Spot-edit per
   slide already works.

## Guardrails / rules
- Real uploaded logos only; never AI-draw a logo (existing rule).
- Cost + time shown BEFORE Start (N slides = N generations).
- No silent caps: warn if the deck was truncated or had image-only slides.
- Charge per slide via the existing per-design credit path in flyer-art.
- A slide with no text → skip it and tell the user, don't ship a blank.
- Typecheck clean; extend `scripts/wizard-check.mjs` (or a new deck-check) to:
  parse a fixture deck → assert N slides found → assert N designs requested in
  order. Prove the parser can FAIL first (feed it a merged/empty doc).

## Phases (each shippable)
1. **Parser** — `app/_lib/deck-split.ts`: PPTX block-split + PDF per-page (Claude
   variant) → ordered `{n, heading, bullets}[]`; image-only detection; cap+warn.
   Unit-test with a real fixture deck (prove it splits, prove it flags empty).
2. **Generate loop** — a route/helper that takes the slide list + look + brand
   and fires `/api/flyer-art` as ONE round of N `slide-16x9` designs in order.
3. **Wizard entry** — deck-upload on Step 1; parse+confirm screen; thread
   `deckSlides` through state; Sizes fixed to slide; Review shows slide count +
   cost; Start → wait → results.
4. **PDF download** — "Download as PDF" on results that stitches the slides in
   order.
5. **Verify** — deck-check script (parse→count→order), typecheck, live smoke on a
   real 5–10 slide deck, screenshots. Update help article.
