# Can Gemini render a whole slide? — test findings

**Test:** 12 full-page 16:9 slides, "AI in Medicine". Gemini renders each entire
slide as one image — headings, body copy, figures, charts, layout, spacing.
Nothing composited in code. Model `gemini-3-pro-image-preview`, `imageSize: 2K`.

**Method:** one SYSTEM block (palette, 7% margins, type scale, spacing rules,
text-accuracy rules) repeated **verbatim** on all 12 prompts. Only the LAYOUT
description and the exact COPY changed. If slides drift, it's the model failing
to hold the system — not the prompt varying.

Generate: `node remotion/scripts/gen-gemini-slides.mjs`
View: `node remotion/scripts/build-gemini-deck.mjs` → `out/ai-in-medicine-gemini.html`

---

## What it got right

**Text accuracy — effectively perfect.** This is the headline result and it's a
real change from a year ago. Across 12 slides of dense copy: every headline,
subheading, body paragraph, figure and caption rendered exactly as specified.
No garbled glyphs, no duplicated letters, no invented words, no lorem ipsum.

It rendered these correctly, character for character:
- `1-555-014-2200`
- `hello@example.com`
- `<5%` (including the less-than sign)
- `1,000+`, `~30 mo`, `-30%`, `T - 6 hrs`
- `"What works, what doesn't, and what it takes to adopt it safely."`

**Palette discipline — held on all 12.** Only the seven specified hex values
appear. No invented colours, no stray gradients.

**Type system — held.** Same geometric sans across all 12, consistent weights,
consistent relative type scale. A viewer would read these as one deck.

**Counting, sometimes.** The 100-dot grid on slide 09 came back with exactly
100 dots in a clean 10×10 and exactly 5 filled teal. That's a task image models
have historically failed outright.

**Full-bleed instructions.** Slide 10's three edge-to-edge colour bands with no
gutters and no bottom margin came out exactly as described.

---

## Where it failed

**Counting, other times.** Slide 07 asked for *"a horizontal row of exactly 24
small squares, in a single line, exactly ONE of them solid white."* It produced
**two rows of about 17**. It got the "exactly one filled" part right and the
count and arrangement wrong. So counting is not reliable — it succeeded at 100
and failed at 24, which means you can't predict it.

**Margin rule drift.** The SYSTEM block specifies a strict 7% safe margin. On
slide 05 the timeline axis runs the full canvas width, edge to edge.

**Alignment drift.** SYSTEM says left-aligned unless the layout says centred.
Slide 10's three panels came back centre-aligned.

**Format surprise.** The API returns **JPEG bytes** regardless of the `.png`
filename. Worth knowing before you write a content-type header.

**Resolution ceiling.** `imageSize: '2K'` returned **1376×768** — a 1.7917
aspect ratio, not exactly 16:9 (1.7778), and well under 2K. Fine on screen,
thin for print or a 4K display.

---

## What this means

For a **first-draft or single marketing slide**, this is now genuinely usable —
faster and better-looking than templating, and the text is trustworthy.

For a **production deck**, three things still block it:

1. **Nothing is editable.** A typo, a price change, or a compliance scrub means
   regenerating the whole slide and accepting a new layout. The compliance
   pipeline can't scrub a word that only exists as pixels.
2. **Counting is unreliable**, so any slide whose meaning depends on an exact
   quantity (5 of 100, 1 of 24) has to be checked by a human every time.
3. **Layout rules are honoured ~80%.** Good enough to look intentional, not
   good enough to guarantee a brand's margin or alignment spec.

**The likely right architecture is a hybrid**, and it's close to what the
existing engine already does — Gemini for the artwork and the visual
composition, code for anything that must be exact, editable, or scrubbable:
figures, contact details, disclaimers, logos. The gap that just closed is that
Gemini can now be trusted with *decorative* text and complex compositional
layout, which it couldn't before.

**Worth re-testing when:** the model exposes a true 4K/print size, or a
seed/reference-image parameter for locking style across a batch.
