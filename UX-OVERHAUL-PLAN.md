# Text2Art UX Overhaul Plan
### v1 draft — pending two self-review passes (see bottom)

**The verdict from the audit:** the bones are right (5 steps, chat content, spot-edit, library) but the app *authors like a form and looks homemade*. 25 concrete frictions found (full audit on file), the worst being: CTAs live in a top bar while choices live below the fold (your "scroll back up to click Next" complaint — it's structural, on every step); no live preview so every choice is a gamble; a spinner-and-facts wait instead of watching the work happen; inline styles with one-off spacing everywhere, which is the #1 tell of amateur UI.

**The research verdict:** the winning pattern for AI-creation tools (Gamma, Canva Magic, Ideogram) is **prompt-first, review-second**. The user says one sentence; the AI drafts everything; the wizard becomes a fast *review of visible guesses* instead of a questionnaire. That's the difference between a form and a $10M product.

---

## 1. North star

> **"Describe it once. Watch it get made. Fix anything with a tap."**

- The user never authors from scratch; they **react** to drafts.
- Every choice shows its consequence **live** before it costs anything.
- One primary action, always visible, always named ("Next: pick sizes"), never behind a scroll.
- The wait is **theater** (watch the design assemble), not a spinner.
- Results are **variants to choose from**, not one verdict to accept.

## 2. Foundation first: a real (tiny) design system

Everything else fails without this. One file, zero exceptions:

| Token | Values |
|---|---|
| Space | 4, 8, 12, 16, 24, 32, 48, 64 (px) — no other values allowed |
| Radius | 4, 6, 8, 10 (10 max, per brand rule) |
| Type scale | 13, 14, 16, 20, 28, 40, 56 — Instrument Serif ≥28 (display), Plus Jakarta <28 (UI); −2% tracking on display |
| Color roles | cream #F4F1EC (canvas), white (card), warm hairline border, INK (text/primary), mint #C7E8A8 **only** for selection + progress, red **only** for final Start |
| Elevation | flat + 1px hairline default; soft large-blur shadow **only** on hover/drag |
| Motion | `fast: 180ms ease-out`, `base: 260ms ease-out`, one spring (sheets/settles); stagger grids 40ms/child; honor `prefers-reduced-motion` |

Ship as CSS variables + a `<Btn>`/`<Card>`/`<Sheet>`/`<Toast>` set in `app/(dashboard)/design/system/`. Then **delete every inline one-off** as screens are rebuilt. This alone removes "amateurish."

## 3. The new flow

### 3.0 Entry — the Prompt Hero (NEW screen, replaces Step 1 as the front door)
One giant centered input (Ideogram pattern): *"What are you making?"* — with example chips underneath ("A grand-opening flyer for my salon", "An Instagram post for a listing"). User types/speaks one sentence → AI pre-fills **all five steps** (kind, style suggestion, headline+copy, likely sizes). The four kind tiles remain below the prompt for people who prefer tapping. Deck-restyle upload lives here as a chip ("Restyle a deck ↑").
**Result:** the wizard downstream becomes review-and-adjust. Nobody ever faces a blank form.

### 3.1 The frame (every step)
- **Persistent live preview** (center or right): correct aspect frame, style-tinted mock, the user's real headline set in the chosen style's type. Re-renders <100ms on every tap. Choices become comparisons, not gambles.
- **Editable-summary rail** (left): each completed step shows the *choice made* ("Style: Retro Poster"), one tap to reopen. Ticks only when truly done (already fixed).
- **Sticky action bar** (bottom, full-width): named CTA ("Next: your words"), disabled state says *why* ("Add a headline to continue"). On mobile it sits in the thumb arc. **This kills the scroll-back-up problem everywhere, permanently.**
- **Auto-advance** on single-tap steps (kind, style card): 250ms mint-ring settle, then advance. Explicit CTA kept on open-ended steps (words, sizes).

### 3.2 Step redesigns (mapped to audit findings)
- **Style:** style cards render *the user's own headline* in each style's look (Recraft try-before-you-buy). Reference-vs-style exclusivity made visible: picking one visibly ejects the other with a toast ("Using your reference — style cleared · Undo"). Fix silent thumbnail loading, accordion scroll-jump, mobile 1-column.
- **Words:** keep the chat, but surface the OUTPUT as the hero — "Here's what your flyer will say" as editable cards (Gamma outline pattern), transcript secondary. Mic gets a labeled state ("Listening…"). Manual fields always visible as the cards themselves (no hidden "type it myself" mode).
- **Sizes:** picker becomes visual tiles at true aspect ratios with live cost math ("3 sizes · 300 credits · 4,500 left") that **cannot silently vanish** (audit #2: if cost fails to load, block with a retry, don't hide). Bleed becomes a 2-tap visual choice with a one-line explanation. Deck force-to-16:9 announced, not silent.
- **Review:** every row tappable to jump back (rail already supports it). Cost shown above Start. "Examples" labeled honestly ("Samples of the style — yours is made fresh from your words").
- **Making → theater:** aspect-correct skeletons for every size appear instantly → staged verbs ("Sketching layout… setting your headline… final polish") → each design **reveals as it lands** (blur-up), no gating on all → spring settle. Facts/ads remain *behind* the skeletons as secondary. Deck: per-slide cards stream in Gamma-style.
- **Results:** variants + gallery grid; spot-editor opens **in place** with pre-chipped likely edits ("Change a word" → routes to words+regenerate, "New background", "Different colors"); brush gets a size slider + undo-per-stroke + resize-safe canvas (audit #5, #16, canvas bug #8). Placement flow gets a back button.
- **Library:** search box, aspect-ratio-preserving masonry, merge "Edit again"/"More sizes" into one "Open" + a direct "More sizes" that goes straight to the sizes step (words now restore — already fixed). Empty state illustrated **in Text2Art's own generated art style** with one CTA.

### 3.3 Mobile
Preview full-bleed; all pickers become drag-handle bottom sheets (Vaul-style, multi-detent, backdrop blur); sticky CTA in thumb zone; rail collapses to a "Step 2 of 5" pill that opens the sequence map as a sheet.

## 4. Kill list
- Retire `/flyer` (old builder) — redirect to `/design` with a banner. Two flows = double bugs (this week proved it).
- Delete the hidden "type it in myself" toggle (fields become the visible cards).
- Delete top-bar Next (replaced by sticky bar).
- Delete all one-off inline spacing/colors as each screen is rebuilt.

## 5. Build phases (each ships alone and typechecks)
1. **Tokens + sticky action bar + named CTAs** (kills the #1 complaint everywhere; smallest change, biggest relief)
2. **Live preview pane** (mock renderer: aspect frame + style tint + real headline)
3. **Prompt Hero + AI pre-fill** (one new route + one API that maps a sentence to wizard state)
4. **Making-screen theater** (skeletons, staged verbs, progressive reveal)
5. **Step redesigns** (style cards w/ live headline, words-as-cards, visual sizes+cost guard, honest review)
6. **Results editor upgrades** (in-place editor, brush slider/undo, placement back, variants)
7. **Library + mobile sheets + empty states; retire /flyer**

Each phase: typecheck + screenshot pass on desktop *and* 390px phone before ship (the one-column check must be able to fail).

## 6. What "done" looks like
- Zero screens where the primary action is off-viewport. Zero unnamed CTAs. Zero blank canvases.
- Every choice previews within 100ms. Every wait shows work happening. Every error says what to do next.
- One spacing scale, one radius scale, two durations. Mint appears only when something is chosen.

---

## Self-review pass 1 (critique of v1)
**Found and fixed in v2 below:**
- **A. Feasibility of "AI pre-fill":** risky as phase 3? No — it reuses the existing flyer-chat model call; the mapping API is one route. Kept, but moved *after* preview so pre-filled guesses have somewhere to show.
- **B. The plan ignored credits/trust:** cost must be on the sticky bar from the sizes step onward, not only at review. Added to §3.2.
- **C. Variants cost real money:** 2-variant generation doubles spend. Amended: variants only for the FIRST size, opt-in ("+1 variant · 100 credits"), never default.
- **D. Accessibility was missing:** added to Definition of Done: focus states on every interactive element, aria-expanded on accordions/sheets, labeled mic states, keyboard path through the wizard.
- **E. Migration risk:** rebuilding screens in place can break the working flow. Amended phases: each step page gets rebuilt behind the same route with the same `useWizard` contract — no data migration, no flag needed, phases stay revertible per-commit.
- **F. Preview honesty:** a style-tinted mock could over-promise. Label it "preview of layout & type — final art is generated." Added.

## Self-review pass 2 (critique of the critique)
- **Pass 1 kept all 7 phases — too many?** Collapsed: phase 2+4 share the mock-renderer; build it once (phases now 6). Sticky bar (phase 1) is a 1-2 day change; do it immediately regardless of the rest.
- **Does auto-advance fight the sticky bar?** No — auto-advance covers tap-once steps; the bar is still there as the escape hatch and the named "what's next" signal. Verified consistent.
- **Is prompt-first right for THIS audience** (non-designer small-business owners)? Yes — stronger than for pros: this user knows *what they want* ("BBQ fundraiser Saturday") but not design vocabulary. One sentence beats four form steps. The tiles remain for tappers, so nothing is lost.
- **Constraint check:** every proposal honors max-10px radius, cream+mint palette, the two brand fonts, real-logos-only, and the existing engine APIs (no engine changes required anywhere in this plan). ✓
- **The one thing pass 1 still missed:** *sound of quality* on the results reveal — a single subtle settle animation is enough; rejected confetti/sound as off-brand. Final.

**Final phase order (v3):**
1. Sticky action bar + named CTAs + tokens file *(days, kills the top complaint)*
2. Mock-renderer → live preview pane + making-screen theater *(one renderer, two uses)*
3. Prompt Hero + AI pre-fill *(the structural flip)*
4. Step redesigns w/ cost guard + a11y pass
5. Results editor upgrades (brush slider, undo, in-place chips, opt-in variant)
6. Library search/masonry/empty-state + mobile sheets + retire /flyer
