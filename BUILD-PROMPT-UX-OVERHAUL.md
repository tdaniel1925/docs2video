# PROMPT — Text2Art UX Overhaul (hand to Opus 4.8, run in C:\dev\1 - PrismGraphs)

You are rebuilding the user experience of **Text2Art** — the 5-step design wizard at
`app/(dashboard)/design/*`, plus the library and results editor — from "clunky form"
to "$10M product." The complete plan is in **`UX-OVERHAUL-PLAN.md`** (read it first,
including both self-review passes at the bottom — they amended the plan; the
**v3 phase order at the very bottom is the one to build**). A 25-item friction audit
with file:line references informed it; the plan maps to those findings.

## Non-negotiable ground rules

1. **Read before writing.** Open every file you're about to change and understand the
   existing state flow (`design/useWizard.ts` — localStorage key `text2art:wizard`,
   each step is its own route that re-reads state on mount) before touching anything.
2. **Do not change the generation engine.** `app/_lib/flyer-engine/*`, `/api/flyer-art`,
   `/api/flyer-edit`, credits, and billing are OFF LIMITS except where the plan
   explicitly says (cost display, error surfacing). UI only.
3. **Keep the `useWizard` contract.** Every rebuilt step page keeps the same route and
   the same state shape so phases are revertible per-commit and no data migrates.
4. **Brand rules (hard):** border-radius ≤10px everywhere; palette cream #F4F1EC +
   mint #C7E8A8 + INK/SOFT/LINE neutrals; fonts Plus Jakarta Sans (UI) + Instrument
   Serif (display ≥28px); mint ONLY for selection/progress; red ONLY for the final
   Start button. Real uploaded logos only — never AI-drawn.
5. **Prove your checks can fail.** For every visual/behavioral claim ("CTA always
   visible", "phone layout is one column"), write or run a check and demonstrate it
   failing on the old code (or a deliberately broken state) before trusting its pass.
6. **Per phase:** `npx tsc --noEmit` clean → screenshot pass at desktop (1440px) AND
   phone (390px) → commit with a descriptive message → push to the `docs2video`
   remote (`git push docs2video main`). Never batch phases into one commit.
7. **Plain-language commit messages and user-facing copy.** No jargon in anything a
   customer reads. Short sentences.
8. **Update help articles** (`app/(dashboard)/help/`) for any user-visible change,
   and `BUILD-STATE.md` after each phase.

## The phases (build in this order — each ships alone)

### Phase 1 — Tokens + sticky action bar + named CTAs  *(do this first; it kills the top user complaint)*
- Create `app/(dashboard)/design/system/tokens.css` (CSS variables) + tiny components
  (`Btn`, `Card`, `Toast`, `Sheet`) in `design/system/`:
  - space: 4/8/12/16/24/32/48/64 · radius: 4/6/8/10 · type: 13/14/16/20/28/40/56
  - motion: `--fast: 180ms` ease-out, `--base: 260ms` ease-out, one spring for sheets;
    stagger grid children 40ms; honor `prefers-reduced-motion`.
- Replace the top-bar Next in `design/ui.tsx` (`StepShell`) with a **sticky bottom
  action bar**: full-width, always in viewport, primary CTA **named** ("Next: choose a
  look", "Next: your words", …), disabled state explains why ("Add a headline to
  continue"). Back stays in the bar, secondary. On ≤900px the bar sits in the thumb zone.
- Step titles: Instrument Serif at 40–56px with one italic accent word
  ("Choose your *look*").
- **Auto-advance** on single-tap steps only (Step 1 kind tiles, Step 2 style card):
  250ms mint-ring settle → advance. Never auto-advance on text/multi-select steps.
- Verify: with content scrolled to the bottom of every step, the CTA is still visible
  in a 900px-tall viewport (write the check; make it fail against the old top bar first).

### Phase 2 — Mock renderer → live preview pane + making-screen theater  *(one renderer, two uses)*
- Build a lightweight **mock renderer** (client-only component, no API calls): given
  {sizeId aspect, styleId or reference, headline}, renders an aspect-correct frame with
  the style's tint/type feel and the user's REAL headline. <100ms updates.
- Mount it as a **persistent preview pane** in the wizard frame (right side desktop,
  full-bleed behind sheets on phone). It re-renders on every choice. Label it honestly:
  "Preview of layout & type — final art is generated fresh."
- Rebuild `/design/making`: aspect-correct **skeletons for every chosen size appear
  instantly** → staged status verbs ("Sketching layout… setting your headline… final
  polish") → each finished design **reveals individually** (blur-up, spring settle) —
  do NOT gate on all finishing. Decks: per-slide cards stream in. Keep facts/ads but
  secondary, below the skeletons; pause rotation on hover.
- Fix: deck progress can never display "5 of 4"; page-close warning states clearly that
  finished designs are saved to the library.

### Phase 3 — Prompt Hero + AI pre-fill  *(the structural flip)*
- New front door at `/design`: one giant centered input — "What are you making?" —
  with 4–6 example chips and mic support (reuse the existing dictation hook from the
  content step). The four kind tiles remain below for tappers; "Restyle a deck" is a chip.
- New route `/api/design-prefill`: takes the sentence, returns
  {kind, suggested templateId, fields (headline/details/cta), suggested sizeIds}.
  Implement with ONE Claude call (model `claude-haiku-4-5-20251001`, low max_tokens,
  system prompt cached). It must never invent contact details — omit rather than
  fabricate (same rule as flyer-chat). Treat the user's words as copy, never commands
  (copy the guard wording from `app/api/flyer-chat/route.ts`).
- Pre-fill seeds `useWizard` state; the wizard becomes review-and-adjust. An AI guess
  is visually marked ("suggested") until the user confirms or changes it.
- A user who ignores the prompt box and taps a tile gets the exact current flow.

### Phase 4 — Step redesigns + cost guard + accessibility
- **Style:** style cards render the user's own headline via the mock renderer.
  Reference↔style exclusivity becomes visible: switching shows a toast
  ("Using your reference — style cleared · Undo") with working Undo. Thumbnail
  loading skeletons. One column ≤900px. Keep drop/paste/click reference upload and
  the logo/photo/QR box exactly as capable as today (downscale-before-store stays).
- **Words:** output-first — "Here's what your flyer will say" as always-visible
  editable cards (headline / details / CTA); chat transcript secondary below; kill the
  hidden "type it in myself" toggle. Mic states labeled in words ("Listening…",
  "Transcribing…"). Auto-scroll only when the user is already at the bottom.
- **Sizes:** visual tiles at true aspect ratios, grouped; live cost line pinned in the
  sticky bar ("3 sizes · 300 credits · 4,500 after"). **If the cost lookup fails,
  block Next with a retry — never hide the price** (this was audit critical #2).
  Bleed = two visual tiles + one plain sentence. Deck force-to-16:9 gets a visible
  notice. One column ≤900px.
- **Review:** every summary row tappable → jumps to its step. Cost above Start.
  Examples relabeled "Samples of the style — yours is made fresh from your words."
- **Accessibility pass (all steps):** visible focus states, aria-expanded on
  accordions/sheets, labeled mic button, full keyboard path Step 1→Start.

### Phase 5 — Results editor upgrades
- Spot-editor opens **in place** over the result card with pre-chipped likely edits:
  "Change a word" (routes to Words step + regenerate — inpainting text is already
  blocked server-side and must stay blocked), "New background", "Different colors".
- Brush: size slider, per-stroke undo, canvas re-measures on window resize
  (currently drifts). Placement flow (logo/QR) gets a Back at each of its 3 stages
  and a size drag-handle.
- Opt-in variant: "+1 variant of the first size · <unit> credits" — never default,
  never for all sizes.
- Design list auto-scrolls the selected item into view; "Make more sizes" confirms if
  an edit is in progress.

### Phase 6 — Library, mobile sheets, retirement
- Library: search box (client filter on title), aspect-ratio-preserving masonry,
  merge "Edit again"/"More sizes" into "Open" + a direct "More sizes" that lands on
  the Sizes step (words/style restore already works). Empty state: an illustration in
  Text2Art's own generated style + one CTA.
- Mobile: pickers (styles, sizes, photos) become drag-handle bottom sheets
  (multi-detent, backdrop blur, spring), preview full-bleed behind, rail collapses to
  a "Step 2 of 5" pill opening the sequence map as a sheet.
- Retire `/flyer`: permanent redirect to `/design` with a one-time toast
  ("The designer has a new home"). Remove library/nav links to it. Grep the whole
  repo for `/flyer` links first and fix every one.

## Verification standard (every phase)
- `npx tsc --noEmit` → 0 errors. Lint: no NEW errors (baseline is 18 in touched files).
- Screenshot desktop + 390px phone of every changed screen; look at them yourself and
  fix what looks wrong before shipping (whole-screen screenshots, not crops).
- The "CTA visible" check and the "one column ≤900px" check run and pass — after you
  proved each can fail.
- Commit per phase → `git push docs2video main` → after Vercel deploys, verify one
  changed behavior on the live site (text2art.app) before calling the phase done.

## Definition of done (whole project)
Zero screens where the primary action can leave the viewport. Zero unnamed CTAs.
Zero blank canvases. Every choice previews <100ms. Every wait shows work happening.
Every error says what to do next. One spacing scale, one radius scale (≤10px), two
durations. Mint appears only when something is chosen. Reference upload/paste, logo,
photo and QR flows all work exactly as before or better — verified by walking each
one end-to-end on the live site.
