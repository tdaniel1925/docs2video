// =============================================================================
// Flyer layouts — PROOF OF CONCEPT.
//
// THE WHOLE POINT: the AI makes the ART, the browser sets the TYPE.
//
// Image models still garble lettering, and a flyer is ninety percent words —
// headline, date, doors at nine, twenty dollar cover, a phone number someone
// has to actually dial. An AI-drawn flyer gives you "SATRUDAY NIGTH" and a
// wrong digit on the piece a client is about to print five hundred of.
//
// So a template here is a LAYOUT SKELETON: real fonts at real positions with
// slots for text, over an AI-generated background that contains no lettering
// at all. Two things follow that no image-only tool can match:
//   - spelling is always right, in any language, at any name length
//   - printing goes through the browser, so the text stays VECTOR in the PDF —
//     which is exactly what a commercial printer wants at 8.5x11
//
// Sizes are in inches and the page is laid out in inches, so "8.5 x 11 high
// res" is not a resolution setting — it is the actual size of the artboard.
// =============================================================================

export type FlyerSize = { id: string; label: string; w: number; h: number }

export const FLYER_SIZES: FlyerSize[] = [
  { id: 'letter', label: 'Flyer — 8.5 × 11 in', w: 8.5, h: 11 },
  { id: 'half', label: 'Half page — 5.5 × 8.5 in', w: 5.5, h: 8.5 },
  { id: 'poster', label: 'Poster — 11 × 17 in', w: 11, h: 17 },
  { id: 'square', label: 'Social — 8 × 8 in', w: 8, h: 8 },
  { id: 'story', label: 'Story — 4.5 × 8 in', w: 4.5, h: 8 },
]

/** What the chat fills in. Every field optional — a half-finished flyer must
 *  still render, because the user watches it build up as they talk. */
export type FlyerFields = {
  eyebrow?: string
  headline?: string
  subhead?: string
  date?: string
  time?: string
  venue?: string
  address?: string
  price?: string
  details?: string[]
  cta?: string
  contact?: string
}

export type FlyerLayout = {
  id: string
  name: string
  /** Plain-English vibe, used to steer the art prompt. */
  vibe: string
  /** Category the picker groups by. */
  category: 'nightlife' | 'business' | 'community' | 'realestate' | 'fitness'
}

// Ten skeletons is the whole idea: a small amount of code times endless art
// directions beats hand-building three hundred fixed templates.
export const FLYER_LAYOUTS: FlyerLayout[] = [
  { id: 'bleed-bottom', name: 'Full bleed — type low', vibe: 'moody, high contrast, cinematic', category: 'nightlife' },
  { id: 'bleed-top', name: 'Full bleed — type high', vibe: 'energetic, saturated, night lights', category: 'nightlife' },
  { id: 'band', name: 'Centre band', vibe: 'bold, graphic, punchy', category: 'nightlife' },
  { id: 'split', name: 'Split — art top', vibe: 'clean, editorial, professional', category: 'business' },
  { id: 'frame', name: 'Framed', vibe: 'refined, understated, premium', category: 'business' },
  { id: 'corner', name: 'Corner card', vibe: 'warm, approachable, human', category: 'community' },
  { id: 'stack', name: 'Stacked type', vibe: 'modern, minimal, lots of negative space', category: 'business' },
  { id: 'ticket', name: 'Ticket stub', vibe: 'retro print, textured paper, ink', category: 'nightlife' },
  { id: 'showcase', name: 'Showcase', vibe: 'bright, aspirational, architectural', category: 'realestate' },
  { id: 'impact', name: 'Impact', vibe: 'gritty, powerful, motivational', category: 'fitness' },
]

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Build the art prompt. It BANS lettering — every word on the finished flyer
 *  is set by the browser, and a stray AI-drawn sign in the background is the
 *  fastest way to make the whole thing look fake. */
export function artPrompt(layout: FlyerLayout, subject: string, accent: string): string {
  return [
    `Background artwork for a printed flyer. Subject: ${subject}.`,
    `Mood: ${layout.vibe}.`,
    `Vertical composition. Leave the ${layout.id.includes('bottom') ? 'lower' : layout.id.includes('top') ? 'upper' : 'central'} third visually calm and uncluttered so text can sit over it legibly.`,
    `Colour should sit comfortably next to ${accent}.`,
    'ABSOLUTELY NO text, no letters, no numbers, no words, no signage, no logos, no watermarks, no captions anywhere in the image.',
    'Photographic or richly illustrated. No flat vector clip-art. No borders or frames.',
  ].join(' ')
}

/**
 * Render the flyer as a standalone HTML document.
 *
 * `print` swaps the on-screen scaling for a real @page at the artboard's true
 * inch size, so the browser's own Save-as-PDF produces a print-ready file with
 * live vector text — no screenshot, no resolution ceiling.
 */
export function renderFlyer(opts: {
  layout: FlyerLayout
  size: FlyerSize
  fields: FlyerFields
  artUrl?: string | null
  accent?: string
  logoUrl?: string | null
  print?: boolean
}): string {
  const { layout, size, fields: f, artUrl, accent = '#C0392B', logoUrl, print } = opts
  const L = layout.id

  // Everything scales off ONE unit tied to the artboard width, so a 5.5in half
  // page and an 11x17 poster are the same design, not two hand-tuned ones.
  const u = `(var(--w) / 100)`

  const artLayer = artUrl
    ? `<div class="art" style="background-image:url('${esc(artUrl)}')"></div><div class="scrim"></div>`
    : `<div class="art noart"></div><div class="scrim"></div>`

  const line = (label: string, value?: string) =>
    value ? `<div class="fact"><span class="fl">${esc(label)}</span><span class="fv">${esc(value)}</span></div>` : ''

  const facts = [line('When', [f.date, f.time].filter(Boolean).join(' · ')), line('Where', f.venue), line('Cost', f.price)]
    .filter(Boolean).join('')

  const details = (f.details ?? []).length
    ? `<ul class="details">${(f.details ?? []).map((d) => `<li>${esc(d)}</li>`).join('')}</ul>`
    : ''

  const block = `
    ${f.eyebrow ? `<div class="eyebrow">${esc(f.eyebrow)}</div>` : ''}
    ${f.headline ? `<h1>${esc(f.headline)}</h1>` : ''}
    ${f.subhead ? `<p class="subhead">${esc(f.subhead)}</p>` : ''}
    ${facts ? `<div class="facts">${facts}</div>` : ''}
    ${details}
    ${f.address ? `<p class="addr">${esc(f.address)}</p>` : ''}
    ${f.cta ? `<div class="cta">${esc(f.cta)}</div>` : ''}
    ${f.contact ? `<p class="contact">${esc(f.contact)}</p>` : ''}
    ${logoUrl ? `<img class="logo" src="${esc(logoUrl)}" alt="">` : ''}`

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Inter:wght@400;600;800&family=Playfair+Display:wght@700;900&display=swap" rel="stylesheet">
<style>
:root{--w:${size.w}in;--h:${size.h}in;--accent:${accent};--u:calc(${u})}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:${print ? '#fff' : '#2a2a2e'};display:flex;align-items:center;justify-content:center;min-height:100%}
${print ? `@page{size:${size.w}in ${size.h}in;margin:0}html,body{width:${size.w}in;height:${size.h}in;display:block}` : ''}
.page{position:relative;width:var(--w);height:var(--h);overflow:hidden;background:#0d0d10;color:#fff;
  font-family:Inter,system-ui,sans-serif;${print ? '' : 'box-shadow:0 24px 70px rgba(0,0,0,.55);'}
  ${print ? '' : 'transform-origin:center;'}}
.art{position:absolute;inset:0;background-size:cover;background-position:center;z-index:0}
.art.noart{background:linear-gradient(145deg,#1b1b22,#2c2c36 60%,var(--accent))}
/* The scrim is what makes the type readable no matter what the art turned out
   to be. Never trust a generated image to have a calm area where you need one. */
.scrim{position:absolute;inset:0;z-index:1;background:
  ${L === 'bleed-top'
      ? 'linear-gradient(180deg,rgba(6,6,10,.86) 0%,rgba(6,6,10,.55) 42%,rgba(6,6,10,.15) 70%)'
      : L === 'band'
      ? 'linear-gradient(180deg,rgba(6,6,10,.20) 0%,rgba(6,6,10,.88) 32%,rgba(6,6,10,.88) 68%,rgba(6,6,10,.20) 100%)'
      : 'linear-gradient(0deg,rgba(6,6,10,.90) 0%,rgba(6,6,10,.62) 38%,rgba(6,6,10,.12) 72%)'}}
.inner{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;
  padding:calc(var(--u) * 8);
  ${L === 'bleed-top' ? 'justify-content:flex-start;' : L === 'band' ? 'justify-content:center;' : 'justify-content:flex-end;'}
  ${L === 'stack' || L === 'ticket' ? 'text-align:left;align-items:flex-start;' : 'text-align:center;align-items:center;'}}
${L === 'split' ? '.art{inset:0 0 46% 0}.scrim{inset:0 0 46% 0;background:linear-gradient(0deg,rgba(6,6,10,.55),rgba(6,6,10,.05))}.inner{background:#0d0d10;top:54%;justify-content:flex-start}' : ''}
${L === 'frame' ? '.page::after{content:"";position:absolute;inset:calc(var(--u) * 4);border:calc(var(--u) * .55) solid rgba(255,255,255,.85);z-index:3;pointer-events:none}' : ''}
${L === 'ticket' ? '.page::before{content:"";position:absolute;left:0;right:0;top:64%;border-top:calc(var(--u)*.4) dashed rgba(255,255,255,.5);z-index:3}' : ''}
.eyebrow{font-weight:800;letter-spacing:.22em;text-transform:uppercase;font-size:calc(var(--u) * 2.4);
  color:var(--accent);margin-bottom:calc(var(--u) * 2)}
h1{font-family:${L === 'frame' || L === 'showcase' ? "'Playfair Display',serif" : L === 'stack' ? "Inter,sans-serif" : "Anton,'Bebas Neue',sans-serif"};
  font-weight:${L === 'frame' || L === 'showcase' ? 900 : L === 'stack' ? 800 : 400};
  font-size:calc(var(--u) * ${L === 'stack' ? 9 : 12});line-height:.92;letter-spacing:${L === 'stack' ? '-.03em' : '.005em'};
  text-transform:${L === 'frame' || L === 'showcase' ? 'none' : 'uppercase'};
  text-wrap:balance;text-shadow:0 calc(var(--u)*.3) calc(var(--u)*1.4) rgba(0,0,0,.5)}
.subhead{font-size:calc(var(--u) * 3.1);line-height:1.35;margin-top:calc(var(--u) * 2.4);
  max-width:34ch;color:rgba(255,255,255,.92)}
.facts{display:flex;gap:calc(var(--u) * 5);margin-top:calc(var(--u) * 4.5);flex-wrap:wrap;
  justify-content:${L === 'stack' || L === 'ticket' ? 'flex-start' : 'center'}}
.fact{display:flex;flex-direction:column;gap:calc(var(--u) * .6);text-align:${L === 'stack' || L === 'ticket' ? 'left' : 'center'}}
.fl{font-size:calc(var(--u) * 1.9);letter-spacing:.18em;text-transform:uppercase;color:var(--accent);font-weight:800}
.fv{font-size:calc(var(--u) * 3.2);font-weight:600}
.details{list-style:none;margin-top:calc(var(--u) * 3.4);display:flex;flex-direction:column;gap:calc(var(--u) * 1.2)}
.details li{font-size:calc(var(--u) * 2.5);color:rgba(255,255,255,.9);position:relative;padding-left:calc(var(--u) * 3)}
.details li::before{content:"";position:absolute;left:0;top:calc(var(--u) * 1.1);width:calc(var(--u) * 1.3);height:calc(var(--u) * 1.3);background:var(--accent);border-radius:50%}
.addr{font-size:calc(var(--u) * 2.3);color:rgba(255,255,255,.75);margin-top:calc(var(--u) * 2)}
.cta{margin-top:calc(var(--u) * 4);background:var(--accent);color:#fff;font-weight:800;
  font-size:calc(var(--u) * 3);letter-spacing:.04em;padding:calc(var(--u) * 2) calc(var(--u) * 4.5);
  border-radius:calc(var(--u) * 1);text-transform:uppercase}
.contact{margin-top:calc(var(--u) * 2.2);font-size:calc(var(--u) * 2.3);color:rgba(255,255,255,.85);font-weight:600}
.logo{margin-top:calc(var(--u) * 3.5);height:calc(var(--u) * 7);width:auto;object-fit:contain}
</style></head><body>
<div class="page">${artLayer}<div class="inner">${block}</div></div>
</body></html>`
}
