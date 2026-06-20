# Editorial / Newsmagazine design system

The code-rendered magazine styles (no Gemini images) come in two **variants** of
one engine (`remotion/src/editorial/`): a calm **Editorial** and a bold
**Newsmagazine (Time)**. Both are chosen per-video in the wizard's Theme step,
or globally via the admin `video_style` setting.

## Variants

The same engine renders three looks via `theme.variant`. Two are OFFERED in the
wizard (Editorial, Explainer); **Newsmagazine/Time stays in the engine but is no
longer offered** in the picker/admin (it overlapped Editorial too much).

| | Editorial (clean) | Newsmagazine / Time (hidden) | Explainer (friendly) |
|---|---|---|---|
| Feel | Warm, refined, airy | Authoritative red newsmagazine | Modern, educational, approachable |
| Fonts | Serif (DM Serif + Source Serif) | Serif | **Sans** (Space Grotesk + Archivo) |
| Frame | Thin (~5px), brand color | Thick red (~16–18px) | **None** (clean edges) |
| Palette | brand accent + cream | red `#E1251B` + cream | navy `#15233B` + cream `#F5F2EC` |
| Accents | single | single red | **four-color** coral/teal/gold/purple |
| Cards | clean | numbered tiles, square | **rounded** (radius 18) soft panels |
| Numbered items | clean | big serif numeral | **filled accent circle** |
| Offered? | yes | no (engine-only) | yes |

Source of truth: `theme.ts` (`EPOCH_EDITORIAL`, `EPOCH_TIME`, `EXPLAINER`,
`editorialFromBrand(brand, variant)`, `explainerFromBrand()`). Components read
`theme.variant`, `theme.radius`, `theme.accents[]`, and the per-theme font fields.

## Palette (Time)
- accent (red) `#E1251B` · ink `#16110F` · paper `#FBF8F3` · muted `#6E6862` · hairline `#D8CFC1` · paperEdge `#F1E9DC`

Editorial swaps to a cooler ink `#1A1714`, softer hairline `#E6DFD4`, and the
brand primary as accent.

## Fonts (`theme.ts`)
- `FONT_DISPLAY` — DM Serif Display (headlines, masthead, big numerals)
- `FONT_KICKER` — Oswald (condensed caps labels / kickers / folio)
- `FONT_BODY` — Source Serif 4 (article body, deks)
- `FONT_MONO` — IBM Plex Mono (folio, captions, contact)

## Archetypes (`archetype.ts`, `EditorialScenes.tsx`)
The AI tags each scene; `pickArchetype()` validates the tag against the content
shape and falls back deterministically. Available:

- **cover** — masthead + huge headline + dek (+ optional presenter portrait)
- **lede** — narrative intro, drop-cap first letter, optional side figure
- **grid** — 4–6 parallel items (numbered tiles in Time)
- **list** — ordered points / principles / steps (big numerals)
- **stat** — 1–3 oversized figures with rules + labels
- **pullquote** — one isolated statement, oversized serif
- **timeline** — dated milestones on a horizontal line (dots; last = ink)
- **chart** — donut (share of a whole) or bars + legend; segment colors
  accent/ink/muted. SVG, no image.
- **matrix** — decision table (rows × columns; red dot = marked cell)
- **decision** — closing CTA + contact (+ optional presenter portrait)

Only timeline/chart/matrix fire when the input genuinely has that data shape
(real dates / a numeric breakdown / an option-by-criterion table). Never
fabricated.

## Images
- Framed photos use a gallery mat: 6px paper border + 1.5px ink keyline + soft
  shadow (`Figure`, `Portrait`).
- Most archetypes need NO image — that's why a free, no-Gemini **preview** is
  possible (`/preview-editorial` renders page stills with placeholders).

## Preview (free, no Gemini)
- Wizard Theme step → `POST /api/preview-theme` → VPS `POST /preview-editorial`.
- Renders ~3 page stills (cover/content/closing) at scene mid-frames via
  `remotion still EditorialVideo --props=<unique>.json`, NO TTS, NO image gen.
- `EditorialVideo.calculateMetadata` prefers `--props` carrying scenes so the
  preview never clobbers an in-flight `editorial.json`.

## Reference source
Derived from the Time-magazine `.dc.html` decks reviewed in
`_review/time-magazine-copy/` (EPOCH masthead, red frame, drop caps, numbered
tiles, oversized numerals, data viz).
