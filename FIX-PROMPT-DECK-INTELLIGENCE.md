# PROMPT — Make the deck AI tell a story (run in C:\dev\1 - PrismGraphs)

You are overhauling how Text2Art plans slide decks from pasted/typed content.
The customer verdict on the current output: "a combination of eight slides that
generally talked about information from the deck — not a cohesive presentation.
I told it I wanted an investor's deck and it ignored that. The artwork was
impressive; we're 80% there." Also: the logo wanders to a different spot on
every inside slide (cover and back were fine).

## Verified root causes (do not re-derive; confirmed at these lines)

1. `app/_lib/deck-plan.ts:91` — the brief is truncated to 4,000 chars. Long
   pastes (the investor case) mostly never reach the model.
2. `app/api/flyer-deck/route.ts:31` — slide count defaults to 8, and the words
   step (`app/(dashboard)/design/content/page.tsx` → planTheDeck) never passes a
   count. The planner is then told "EXACTLY ${n}" and `normalise()`
   (`deck-plan.ts:153-155`) PADS with placeholder "Slide N" slides if short.
3. `deck-plan.ts` SYSTEM — strong slide-craft + honesty rules, but ZERO purpose/
   audience/narrative-arc guidance. No instruction to detect "investor deck",
   "sales deck", "training", etc., and no arc to follow. Only "Vary the roles."
4. The planned deck is never SHOWN for review in the new 5-step flow — the chat
   just says "Planned 8 slides" and moves on (content/page.tsx planTheDeck).
5. `app/api/flyer-art/route.ts:238` — the logo is passed TO THE IMAGE MODEL
   ("place it exactly as given") with no position constraint; every slide is an
   independent call, so placement drifts. The pixel-exact compositing that fixes
   this already exists (flyer-edit's overlay mode, `sharp` composite).

`planDeck` powers all three deck paths (wizard, /api/v1/decks, MCP create_deck)
— fix it once, all three improve.

## Ground rules

- Read every file before changing it. Engine prompt rules (verbatim words, no
  invented facts, text-off-edges) must survive — they live in flyerPrompt and
  the SYSTEM's honesty block. The honesty block is sacred; extend, never weaken.
- Keep the PlannedSlide→fields shape (headline/subhead/details/cta/contact) so
  the image engine needs no translation layer. New roles are allowed ONLY if you
  add a matching `roleDirection` entry.
- Per phase: `npx tsc --noEmit` clean → commit → push to `docs2video` remote.
- Prove behavior against the LIVE model (key in .env.local) with a realistic
  long investor brief before calling any phase done. Prove your checker can fail.

## Phase 1 — The planner thinks in stories (deck-plan.ts + flyer-deck route)

Rewrite `planDeck` as a TWO-JOB call (still one request is fine if reliable):

**Job A — understand the material.** Before planning, the model must identify,
from the full brief: (a) the PURPOSE — investor pitch, sales, training, report,
all-hands, other — from explicit words ("investor deck") or inference; (b) the
AUDIENCE; (c) the core message in one sentence; (d) the usable FACTS (real
figures, names, quotes — the only ones allowed on slides).

**Job B — plan the story, not the topics.** The deck must follow a named
narrative arc matched to the purpose. Give the model these arcs (and let it
adapt, not fill-in-the-blank):
- Investor: hook → problem → solution → why now → market size → business model
  → traction → team → the ask
- Sales: their pain → the cost of it → the fix → proof → how it works → next step
- Training/report/all-hands: appropriate equivalents (write them)
Every slide must EARN its place in the arc; the plan must read as one argument,
where each slide sets up the next. Add a per-slide "purpose" note (one line, why
this slide is here) — return it in the JSON and thread it into `roleDirection`'s
art direction so weight follows meaning. Ban generic filler ("Overview",
"Information", "More details") as headlines.

Mechanics:
- Brief cap: 4,000 → 24,000 chars (Sonnet handles it; keep max_tokens ≥ 6,000).
- Count: replace "EXACTLY n" with a RANGE the model fills as the content needs:
  short 5-7, medium 8-14, long 15-24. Raise MAX_SLIDES to 24. Default medium.
- DELETE the placeholder padding in `normalise()` — a short honest deck beats
  "Slide 9". Keep the hard trim at the range max (cost).
- Optional new roles if they earn their keep: 'section' (a divider that names
  the next chapter), 'agenda'. Each needs roleDirection.
- flyer-deck route: accept `{ length: 'short'|'medium'|'long' }` and map to the
  ranges; keep `slides` (a number) working for the API/MCP callers.

Live proof (write a throwaway script, run, then delete): paste a ~10,000-char
investor-style brief (company, problem, market numbers, traction, team, ask).
Assert: purpose detected as investor; slide count lands where content demands
(NOT 8); the order follows the arc; every figure on a slide appears verbatim in
the brief; zero placeholder headlines. Run it twice — arcs should hold, wording
may vary.

## Phase 2 — Length choice + the plan you can SEE (content/page.tsx)

- When kind=deck and the user sends their brief, ask ONE question as three chips
  in the chat: "How long should it run? Short (5-7) · Medium (8-14) · Long
  (15-24)" — then plan. Remember the choice for re-plans.
- Show the PLAN back as a numbered list in the chat/step (title + one-line
  purpose per slide), with per-slide delete and a "replan" affordance, BEFORE
  the user advances to sizes/review. Nobody should pay for 15 images from a
  running order they never saw. (The uploaded-deck path already shows its slide
  list on Step 1 — match that bar.)
- Cost stays visible on the sizes/review steps as today (drawableSlides × unit).

## Phase 3 — The logo stays put (flyer-art + deckGenerate)

- For deck BODY slides (slotId matches /^slide-/ and role='point'|'numbers'|
  'quote'|'section'): do NOT send the logo image to the image model. Instead,
  after the slide renders, composite the logo in CODE at ONE fixed position —
  top-right corner, same fractional x/y/width on every slide (mirror the
  flyer-edit overlay-mode sharp code; do not re-invent it). Transparent-ready
  variant (logo_light_url) preferred, exactly as the existing precedence.
- Cover and closing keep the model's hero placement (the customer liked those).
- The prompt line "place it exactly as given" stays for the cover/closing calls.
- Proof: generate a 6-slide deck with a logo; crop the logo region of every body
  slide and assert the logo's bounding position is identical (pixel-compare the
  corner crops programmatically — this is the checker that must be able to fail;
  prove it fails against a deck generated the OLD way or a shuffled crop).

## Phase 4 — Verify end-to-end, then document

- Full run on the live site after deploy: sentence → deck kind → paste long
  brief → choose Long → review plan → Make → confirm slide count, arc order,
  consistent logo, and that My Library saved it.
- Update TEXT2ART-WORKFLOW.md's deck section and the help article for decks.
- BUILD-STATE.md entry.

## Don'ts

- Don't touch the uploaded-deck RESTYLE path's parsing (deck-split) — its job is
  to preserve the user's existing slides, not to re-author them.
- Don't let arcs invent content: if the brief has no traction numbers, the arc
  SKIPS the traction slide rather than fabricating one. The honesty block wins
  over the arc, always.
- Don't raise costs silently: a Long deck's price must be visible before Make.
