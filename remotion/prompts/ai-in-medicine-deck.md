# Prompt pack — "AI in Medicine", 12-page infographic deck

A complete, runnable prompt set for generating the artwork of a 12-page
infographic deck. Feed the STYLE block + one SUBJECT line per page to Gemini
(`gemini-3-pro-image-preview`), one image per page.

## Read this first — the division of labor

Gemini generates **illustration only**. It never renders the deck's words.

| Element | Made by | Why |
|---|---|---|
| Slide illustration / infographic art | **Gemini** | this prompt pack |
| Headline, stats, bullets, page numbers | **Code** (`buildPresentationHtml`) | AI-rendered text comes out as gibberish, and it can't be edited or scrubbed |
| Logo on the cover | **Code** — the real uploaded file | project rule: real uploaded logos only, never AI-drawn |
| Presenter photo | **Code** — the uploaded headshot | a generated "person" is a fake human being passed off as your presenter |
| Back-cover contact details | **Code** | a hallucinated phone number is a live business defect |

This is why every prompt below ends in a hard no-text constraint. If you ask
Gemini for "a cover with the logo and contact info," it will invent a plausible
logo and a plausible phone number, and both will be wrong.

---

## STYLE — prepend to every subject

Set `ACCENT` once; it's the only brand variable.

```
ACCENT      = deep clinical teal (#0E7C7B)      ← replace with the brand color
ACCENT_SOFT = pale mint (#DCEFEE)
```

```
Flat modern editorial infographic illustration, premium medical-technology
publication style. Palette: soft off-white background (#FAFAF8), {ACCENT} as the
dominant accent, {ACCENT_SOFT} for fills, one muted slate blue (#5B6B7C) and one
warm sand (#E4D9C8) as supporting tones, charcoal line work (#2C3238). Clean
geometric shapes with generous negative space, subtle paper grain, soft diffused
shadows, thin precise 2px linework. Data-visual motifs — rings, arcs, layered
panels, node graphs, gradient bars — rendered as ABSTRACT SHAPE only, with no
axis labels or readable values. Calm, credible, and clinical rather than sci-fi:
no glowing blue holograms, no circuit-board brains, no robot hands touching
screens, no neon. Centered single subject, generous margins, square composition
on a plain off-white field so it sits inside a rounded card.

CRITICAL: absolutely NO text, NO words, NO letters, NO numbers, NO logos, NO
brand marks, NO readable UI labels, NO watermarks, NO signatures. Pure
illustration only. Do not depict identifiable real people. Do not render any
specific medical device brand, hospital name, or drug name.
```

---

## SUBJECTS — one per page

**01 · Cover** — `cover.png`
> a calm human figure in profile composed of soft overlapping translucent layers, with a gentle arc of light passing through — the meeting of a person and a system that understands them. Wide, uncluttered, with clear empty space on the left third for a headline.

**02 · The moment** — `adoption.png`
> a rising stepped curve made of stacked rounded blocks climbing across the frame, with small clinician figures standing at three of the steps — steady, measured adoption rather than a spike.

**03 · How it works** — `pipeline.png`
> a left-to-right pipeline of three linked rounded panels — a stack of records, a layered processing core, a clinician silhouette — connected by clean flowing lines, with the final arrow pointing back toward the human.

**04 · Imaging** — `imaging.png`
> a soft-edged scan panel on a stand with a faint highlighted region ringed by a delicate circle, a magnifier arc hovering nearby — attention being drawn, not a diagnosis being made.

**05 · Early detection** — `risk.png`
> two diverging paths on a gentle timeline, one branching earlier than the other toward a small sunrise, with a subtle ring gauge beside them — catching something sooner.

**06 · Drug discovery** — `discovery.png`
> a lattice of connected molecular nodes partially resolving out of a cloud of scattered dots into an ordered cluster — search collapsing into a candidate.

**07 · Documentation** — `scribe.png`
> a clinician and patient seated facing each other in conversation, with a soft ambient wave gently forming an ordered stack of paper behind them — the note writing itself while attention stays on the patient.

**08 · Triage & flow** — `triage.png`
> a queue of rounded tokens funneling through a wide sorting gate into three lanes of differing urgency, one lane clearly moving faster.

**09 · Proven vs. promised** — `evidence.png`
> a balance scale where one pan holds a small stack of solid weighted blocks and the other holds light translucent floating shapes — settled evidence against open claims.

**10 · Risks** — `risks.png`
> a warning-toned composition of a skewed dataset shown as an unbalanced ring chart beside a confidently drawn shape whose outline doesn't quite match its fill — bias and confident error.

**11 · Governance** — `governance.png`
> a protective arc over a small system diagram, with three checkpoint markers along the arc and a human hand-shape resting at the final one — oversight with a person at the end.

**12 · Back cover** — `close.png`
> two open hands offering a small softly glowing circular form forward, with a gentle sunrise gradient behind — an invitation to continue the conversation. Leave the right half visually quiet for contact details.

---

## Cover and back cover — what code adds on top

The engine composites these onto pages 01 and 12; do not prompt for them.

- **Cover:** real logo (corner slot), presenter photo or initials monogram in
  the byline, "Prepared for {recipient}" eyebrow, title, subtitle, start button.
- **Back cover:** presenter photo at larger size, name, role, and the contact
  line built by the shared contact-line builder (phone auto-formatted to
  `1-xxx-xxx-xxxx`), plus the brand name as a signature.

---

## Running it

`remotion/scripts/gen-insurance-illos.mjs` is the working template — it already
loads `GEMINI_API_KEY` from `.env.local`, retries 3×, caches by filename, and
takes a locked STYLE constant plus a subject map exactly like the one above.
Copy it, swap in this STYLE and these 12 SUBJECTS, and point `OUT` at a new
folder. Then pass the 12 scenes to `buildPresentationHtml` with
`templateId: 'jordyn'` and the brand `primaryColor` — the accent will already
match, since the same hex drives both the art and the deck chrome.
