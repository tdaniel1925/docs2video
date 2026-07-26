// FULL-PAGE GEMINI SLIDES — a capability test.
//
// Gemini renders each entire 16:9 slide as a single image: headings, body copy,
// numbers, charts, layout, spacing. Nothing is composited in code. The point is
// to find out how well the current image model holds a design system across a
// 12-slide deck — consistent palette, margins, type scale, and legible text.
//
// Every prompt repeats the SYSTEM block verbatim; only the LAYOUT and COPY
// change. That is the control: if slides drift, the model is not holding the
// system, not the prompt varying.
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { GoogleGenAI } from '@google/genai'

const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', '.gem-slides'); mkdirSync(OUT, { recursive: true })
const env = {}
for (const f of ['.env.local', '.env']) {
  const p = join(ROOT, f); if (!existsSync(p)) continue
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim()
  }
}
const genai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
const MODEL = env.IMAGE_MODEL || 'gemini-3-pro-image-preview'
const SIZE = process.env.SIZE || '2K'

// ── The design system, repeated verbatim on every slide ───────────────────
const SYSTEM = `You are rendering ONE COMPLETE PRESENTATION SLIDE as a finished 16:9 image.
This is a real slide for a professional audience, not an illustration of a slide.

DESIGN SYSTEM — follow exactly and identically on every slide:
• Canvas: 16:9 landscape. Background #FAFAF8 unless the layout says otherwise.
• Margins: a strict 7% safe margin on all four edges. NOTHING may touch or cross
  the canvas edge except a deliberate full-bleed colour panel called for by the layout.
• Palette, use ONLY these: deep teal #0E7C7B (primary accent), bright teal #14A08E
  (secondary accent), near-black ink #12202A (all body text and headings),
  warm grey #6B7780 (captions and secondary text), off-white #FAFAF8 (background),
  pale mint #DCEFEE (fills and panel tints), warm sand #E4D9C8 (a single supporting tone).
  No other colours. No gradients except a single subtle teal one where specified.
• Typography: one clean geometric sans-serif family throughout (Inter / Helvetica Now
  character). Headline weight 700, body weight 400, figures weight 800.
  Type scale: slide headline is by far the largest text; section label is tiny and
  uppercase with wide letter-spacing; body copy is clearly smaller than the headline
  and set at a comfortable reading size. Left-aligned unless the layout says centred.
• Spacing: generous, consistent white space. Elements aligned to a clean grid.
  Equal gutters between repeated elements. Never crowd the margins.
• Tone: calm, credible, clinical, editorial. Like a McKinsey or Financial Times
  data page. Not sci-fi, not neon, no glowing holograms, no robot imagery.

TEXT RENDERING — this is the most important requirement:
• Every word of the copy below must be spelled EXACTLY as written, correctly and
  legibly, with correct letter spacing and no duplicated, garbled, warped or
  invented characters.
• Do NOT add any text that is not specified below. No lorem ipsum, no filler
  paragraphs, no invented statistics, no extra labels, no page furniture.
• Do NOT render any logo, brand mark, company name, or watermark.
• Numbers must be exactly as given, including symbols like % and <.

Render the finished slide now.`

// ── The 12 slides: layout + exact copy ────────────────────────────────────
const SLIDES = {
  '01-cover': `LAYOUT: Title slide. Left 55% carries the text on the off-white background,
right 45% is a full-bleed deep teal #0E7C7B panel running to the top, right and bottom
edges, containing a simple abstract line-art motif of a human profile formed from thin
concentric arcs, drawn in bright teal and off-white. A thin bright-teal rule sits above
the title. At the very bottom of the left column, a single horizontal row of four small
statistics separated by thin vertical dividers.

COPY — render exactly:
Small uppercase label above the rule: A FIELD BRIEFING · 2026
Headline, very large, two lines: "AI in Medicine"
Subheading below: "What works, what doesn't, and what it takes to adopt it safely."
Bottom stat row, four items, figure above label:
"1,000+" / "cleared devices"
"66%" / "physicians using AI"
"<5%" / "reach patients"
"1 hr/day" / "time returned"`,

  '02-adoption': `LAYOUT: Three equal columns filling the lower two thirds, each a rounded
rectangle card with a thin border. The middle card is filled deep teal #0E7C7B with its
text in off-white; the outer two are off-white with a thin grey border. Each card holds a
very large figure at the top, a simple donut chart beneath it, then a bold label and a
small caption. Headline and section label sit above the cards on the left.

COPY — render exactly:
Section label: 01
Headline: "It already left the lab"
Subheading: "Adoption is broad but shallow — most of it is documentation, not diagnosis."
Card 1: figure "1,000+", donut roughly three-quarters filled, label "FDA-cleared AI devices", caption "Three quarters are radiology"
Card 2 (teal): figure "66%", donut roughly two-thirds filled, label "Physicians using AI", caption "Up from 38% a year earlier"
Card 3: figure "3x", donut fully filled, label "Growth in one year", caption "Fastest in documentation tools"`,

  '03-pipeline': `LAYOUT: Full-bleed dark ink #12202A background covering the entire canvas.
All text off-white. Three equal panels side by side across the middle, each a rounded
rectangle with a subtle lighter fill and thin border, connected left to right by two thin
bright-teal arrows pointing right. Each panel has a small teal number at top, a large
title, then two lines of body copy. A single centred line of teal text sits below.

COPY — render exactly:
Section label: 02
Headline: "Three steps, every time"
Subheading: "Underneath the branding, every clinical model does the same three things."
Panel 1: "01" / "Learn" / "Patterns extracted from millions of prior records and images."
Panel 2: "02" / "Score" / "A new patient measured against those patterns."
Panel 3: "03" / "Surface" / "A ranked suggestion handed to a clinician — never an order."
Centred teal line at the bottom: "The model proposes. The clinician disposes."`,

  '04-imaging': `LAYOUT: Vertical split. Left 52% is a full-bleed dark ink #12202A panel
running to the top, left and bottom edges. On it: a small teal section label, an enormous
bright-teal figure, a bold off-white line beneath it, then three thin horizontal progress
bars each with a left label and a right value, then a small grey paragraph. Right 48% is a
pale mint #DCEFEE field containing a clean abstract line-art motif of a medical scan panel
on a stand with a magnifier arc and a small highlighted region ringed by a circle.

COPY — render exactly:
Section label: 03
Enormous figure: "20%"
Line beneath: "more cancers detected"
Bar 1 label "AI-supported reading", value "+20%"
Bar 2 label "Reading workload", value "-44%"
Bar 3 label "Trial population", value "80k"
Paragraph: "Screening mammography — where volume is high and the signal is subtle. It flags attention; the radiologist still makes the call."`,

  '05-earlier': `LAYOUT: A single horizontal timeline running across the full width of the
middle of the slide: a thin grey axis line with two circular markers on it, the left marker
solid teal and the right marker grey. Between the two markers, a dashed teal rounded
rectangle spans the gap with a small uppercase label inside it. Each marker has a bold
label above and a small grey time caption below. Beneath the timeline, two figure cards on
the left and a paragraph on the right.

COPY — render exactly:
Section label: 04
Headline: "Buying back hours"
Subheading: "Risk models running against the chart surface deterioration before it would be noticed."
Left marker: "Model flags risk" / "T - 6 hrs"
Right marker: "Noticed clinically" / "T"
Label inside the dashed band: 6 HOURS OF RUNWAY
Card 1: "6 hrs" / "Typical early warning"
Card 2: "18%" / "Lower sepsis mortality"
Paragraph: "Value comes from earlier action, not a more accurate label. A warning nobody routes to a human is a warning that did nothing."`,

  '06-discovery': `LAYOUT: Mirror of slide 04. Left 48% is a pale mint #DCEFEE field holding a
clean abstract line-art motif of scattered dots resolving into an ordered lattice of
connected nodes. Right 52% is off-white and carries the text: section label, headline, then
two large figures each on its own row with a thin divider line between them and a small grey
descriptor to the right of each figure, then a paragraph.

COPY — render exactly:
Section label: 05
Headline: "Narrowing the search"
Row 1: "200M+" / "protein structures predicted"
Row 2: "~30 mo" / "discovery to first trial"
Paragraph: "It shrinks the candidate space; it does not shorten the trial. Clinical validation remains the long, expensive, unavoidable part."`,

  '07-documentation': `LAYOUT: Full-bleed deep teal #0E7C7B background covering the entire
canvas, all text off-white. Left two thirds: an enormous figure, a bold line beneath it,
then a horizontal row of exactly 24 small equal rounded squares in a single line — 23 of
them semi-transparent white and exactly ONE of them solid white — with a small caption
below. A thin vertical divider separates this from the right third, which holds two
stacked figures with small labels and a short paragraph beneath a thin rule.

COPY — render exactly:
Section label: 06
Enormous figure: "1 hr"
Line beneath: "returned to the clinician, every day"
Caption under the 24 squares: "one hour of a 24-hour day, back in the room with the patient"
Right figure 1: "-30%" / "burnout scores"
Right figure 2: "0" / "clinical decisions touched"
Paragraph: "The quietest success is the biggest. It fixes the keyboard, not the medicine — which is the point."`,

  '08-triage': `LAYOUT: A centred funnel diagram. At the top, a compact grid of small teal
rounded squares representing a queue. Below it, a narrower solid dark ink #12202A bar with
a small uppercase off-white label centred inside. Below that, three equal-width rounded
rectangle lanes side by side spanning the full content width: the first filled deep teal
with off-white text, the second filled pale mint with ink text, the third off-white with a
thin grey border. Each lane has a bold title and a small caption.

COPY — render exactly:
Section label: 07
Headline: "Sorting the queue"
Subheading: "Where AI touches the most patients and draws the least attention."
Label inside the dark bar: TRIAGE
Lane 1: "Critical" / "read first"
Lane 2: "Routine" / "scheduled"
Lane 3: "Deferred" / "batched"
Centred teal line at the bottom: "Unglamorous, high-volume, and consistently profitable."`,

  '09-evidence': `LAYOUT: Full-bleed dark ink #12202A background covering the entire canvas,
text off-white. Left half: section label, a very large two-line headline, then one enormous
bright-teal figure with a small descriptor beside it, then a smaller grey figure with its
own descriptor, then a paragraph. Right half: a precise grid of exactly 100 evenly spaced
circular dots arranged 10 across and 10 down, of which exactly 5 dots in the top-left are
filled bright teal and the remaining 95 are dark grey. A small legend sits under the grid.

COPY — render exactly:
Section label: 08
Headline, two lines: "Most models never reach a patient"
Large figure: "<5%" with descriptor "reach clinical use"
Smaller figure: "2%" with descriptor "externally validated"
Paragraph: "The failure is rarely the math. A model trained in one health system quietly degrades in the next. Ask for external validation — not the internal test set."
Legend under the dot grid: "reached a patient" and "did not"`,

  '10-risks': `LAYOUT: The headline sits in a band across the top on the off-white
background. Below it, three equal full-height vertical panels run edge to edge with NO gaps
between them and NO margin at the left, right or bottom of the canvas. Panel 1 is dark ink
#12202A with off-white text, panel 2 is deep teal #0E7C7B with off-white text, panel 3 is
warm sand #E4D9C8 with ink text. Each panel holds a small simple geometric icon at the top,
then a large title, then two lines of body copy, positioned in the vertical centre.

COPY — render exactly:
Section label: 09
Headline: "Three ways it fails"
Panel 1: "Bias" / "A model trained on one population underserves another. The gap is invisible in aggregate accuracy."
Panel 2: "Confident error" / "Fluent, well-formatted, and wrong. Confidence is not a measure of accuracy."
Panel 3: "Accountability" / "When a model contributes to harm, the liability question has no settled answer yet."`,

  '11-governance': `LAYOUT: Four equal columns across the full content width. A single thin
horizontal grey line runs behind them, passing through the centre of four solid deep-teal
circles, one at the top of each column, each containing a white numeral. Below each circle
sits a bold short title and two lines of small grey body copy. Everything aligned to a
strict shared baseline.

COPY — render exactly:
Section label: 10
Headline: "What good adoption looks like"
Subheading: "The organisations doing this well are boring about it."
Column 1, numeral "1": "Start low-stakes" / "Documentation before diagnosis — where a mistake is recoverable."
Column 2, numeral "2": "Human sign-off" / "A clinician approves anything that touches care."
Column 3, numeral "3": "Monitor for drift" / "Models decay as your population changes. Watch after go-live."
Column 4, numeral "4": "Be able to explain" / "Any decision, to the patient it affected."`,

  '12-close': `LAYOUT: Closing slide, mirroring the title slide. Left 55% on off-white
carries the text; right 45% is a full-bleed deep teal #0E7C7B panel running to the top,
right and bottom edges containing a simple abstract line-art motif of two open hands
offering a circular form, drawn in bright teal and off-white. In the left column: a small
uppercase label, a very large two-line headline, then a thin horizontal rule, then a row of
three contact items each with a tiny uppercase grey label above a bold teal value.

COPY — render exactly:
Small uppercase label: THANK YOU
Headline, two lines: "Let's talk it through."
Contact item 1: label "PHONE" value "1-555-014-2200"
Contact item 2: label "EMAIL" value "hello@example.com"
Contact item 3: label "WEB" value "example.com"`,
}

// ── Generate ──────────────────────────────────────────────────────────────
async function gem(prompt, outPath) {
  for (let a = 0; a < 3; a++) {
    try {
      const r = await genai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseFormat: { image: { aspectRatio: '16:9', imageSize: SIZE } } },
      })
      for (const p of (r.candidates?.[0]?.content?.parts ?? [])) {
        if (p.inlineData) { writeFileSync(outPath, Buffer.from(p.inlineData.data, 'base64')); return true }
      }
      throw new Error('no image in response')
    } catch (e) {
      console.log('  retry', a, String(e.message || e).slice(0, 100))
      if (a < 2) await new Promise((s) => setTimeout(s, 3000))
    }
  }
  return false
}

const entries = Object.entries(SLIDES)
let next = 0
async function worker() {
  for (;;) {
    const i = next++; if (i >= entries.length) return
    const [key, layout] = entries[i]
    const out = join(OUT, `${key}.png`)
    if (existsSync(out) && process.env.FORCE !== '1') { console.log('[slide] cached', key); continue }
    const ok = await gem(`${SYSTEM}\n\n${layout}`, out)
    console.log('[slide]', key, ok ? 'done' : 'FAILED')
  }
}
await Promise.all(Array.from({ length: 3 }, worker))
console.log('\nwrote', OUT)
