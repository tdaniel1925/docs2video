// =============================================================================
// Flyer engine — templates, type treatments, and every output size.
//
// THE AI MAKES THE ART; THE BROWSER SETS THE TYPE.
//
// Image models still garble lettering, and a flyer is ninety percent words —
// headline, date, doors at nine, a phone number someone has to dial. An
// AI-drawn flyer gives you "SATRUDAY NIGTH" on the piece a client prints five
// hundred of. So the artwork prompt bans lettering outright and every word is
// set by the browser: correct spelling, any language, any name length, and it
// stays VECTOR when printed.
//
// THE TYPE TREATMENTS ARE WHAT MAKE IT LOOK LIKE A CLUB FLYER. Reference decks
// (ElegantFlyer and friends) get their look from chrome, neon and 3D lettering
// baked into a PSD. All of those are reachable in CSS — gradient fills, stroke,
// stacked shadows, glow — so the headline can look poured out of gold and STILL
// be real, correct, editable text. That is the whole trick: the maximalist look
// without the garbled letters.
//
// ONE DESIGN, EVERY SIZE. Sizes carry their own units (inches for print, pixels
// for social) and everything scales off a single unit tied to the artboard, so
// an 8.5x11 flyer and a YouTube banner are the same design rather than a dozen
// hand-tuned ones. Landscape sizes switch to a side-by-side arrangement,
// because a portrait poster reflowed into a 1500x500 header just crushes.
// =============================================================================

export type FlyerSize = {
  id: string
  label: string
  group: 'print' | 'social' | 'banner'
  w: number
  h: number
  unit: 'in' | 'px'
  /** Fraction of the artboard to keep clear at the edges — YouTube crops its
   *  banner hard on phones and TVs, so type outside the middle band vanishes. */
  safe?: number
}

export const FLYER_SIZES: FlyerSize[] = [
  { id: 'letter', label: 'Flyer 8.5 × 11 in', group: 'print', w: 8.5, h: 11, unit: 'in' },
  { id: 'square4', label: 'Flyer 4 × 4 in', group: 'print', w: 4, h: 4, unit: 'in' },
  { id: 'half', label: 'Half page 5.5 × 8.5 in', group: 'print', w: 5.5, h: 8.5, unit: 'in' },
  { id: 'poster', label: 'Poster 11 × 17 in', group: 'print', w: 11, h: 17, unit: 'in' },
  { id: 'ig-post', label: 'Instagram post 1080²', group: 'social', w: 1080, h: 1080, unit: 'px' },
  { id: 'ig-story', label: 'Instagram story / Reel', group: 'social', w: 1080, h: 1920, unit: 'px' },
  { id: 'fb-post', label: 'Facebook post 1200 × 1500', group: 'social', w: 1200, h: 1500, unit: 'px' },
  { id: 'fb-ad', label: 'Facebook / IG ad 1200 × 628', group: 'social', w: 1200, h: 628, unit: 'px' },
  { id: 'fb-cover', label: 'Facebook cover 1640 × 624', group: 'banner', w: 1640, h: 624, unit: 'px', safe: 0.1 },
  { id: 'yt-banner', label: 'YouTube banner 2560 × 1440', group: 'banner', w: 2560, h: 1440, unit: 'px', safe: 0.3 },
  { id: 'yt-thumb', label: 'YouTube thumbnail 1280 × 720', group: 'banner', w: 1280, h: 720, unit: 'px' },
  { id: 'x-header', label: 'X / Twitter header 1500 × 500', group: 'banner', w: 1500, h: 500, unit: 'px', safe: 0.08 },
  { id: 'li-banner', label: 'LinkedIn banner 1584 × 396', group: 'banner', w: 1584, h: 396, unit: 'px', safe: 0.08 },
]

export type TypeTreatment = 'chrome' | 'neon' | 'outline' | 'extrude' | 'solid' | 'script'

export type FlyerTemplate = {
  id: string
  name: string
  category: 'nightlife' | 'business' | 'community' | 'realestate' | 'fitness'
  /** Where the type block sits on a portrait artboard. */
  anchor: 'bottom' | 'top' | 'centre'
  type: TypeTreatment
  /** Display face for the headline. */
  face: 'anton' | 'bebas' | 'archivo' | 'playfair' | 'script'
  accent: string
  /** Steers the artwork prompt. */
  vibe: string
  /** How hard to darken the art behind the type. Heavier = safer, flatter. */
  scrim: 'light' | 'medium' | 'heavy'
}

// Named looks, not abstract layouts — a user picks "Retro Night", not
// "bleed-bottom with a gradient fill".
export const FLYER_TEMPLATES: FlyerTemplate[] = [
  { id: 'rnb', name: 'R&B Night', category: 'nightlife', anchor: 'bottom', type: 'chrome', face: 'anton', accent: '#E9B44C', vibe: 'gold chains, luxury club, warm amber haze, cinematic portrait lighting', scrim: 'medium' },
  { id: 'retro', name: 'Retro Night', category: 'nightlife', anchor: 'centre', type: 'chrome', face: 'anton', accent: '#E026FF', vibe: 'eighties synthwave, magenta and violet neon, chrome and grid horizon', scrim: 'medium' },
  { id: 'ladies', name: 'Ladies Night', category: 'nightlife', anchor: 'bottom', type: 'script', face: 'script', accent: '#F2C14E', vibe: 'gold disco ball, glamorous champagne light, sequins and sparkle', scrim: 'medium' },
  { id: 'vip', name: 'VIP Luxury', category: 'nightlife', anchor: 'bottom', type: 'chrome', face: 'archivo', accent: '#D4AF37', vibe: 'black and gold luxury, supercar, deep shadow, high contrast', scrim: 'heavy' },
  { id: 'neonclub', name: 'Neon Club', category: 'nightlife', anchor: 'centre', type: 'neon', face: 'bebas', accent: '#22D3EE', vibe: 'dark club interior, cyan and magenta neon tubes, atmospheric fog', scrim: 'medium' },
  { id: 'halloween', name: 'Halloween', category: 'nightlife', anchor: 'top', type: 'outline', face: 'anton', accent: '#7CFC00', vibe: 'eerie green fog, gothic shadows, moonlit and haunting', scrim: 'medium' },
  { id: 'tropical', name: 'Tropical Night', category: 'nightlife', anchor: 'bottom', type: 'extrude', face: 'archivo', accent: '#FF8A3D', vibe: 'sunset beach party, palms, turquoise water, warm tropical dusk', scrim: 'medium' },
  { id: 'corporate', name: 'Corporate Event', category: 'business', anchor: 'bottom', type: 'solid', face: 'archivo', accent: '#2563EB', vibe: 'modern glass architecture, clean professional, blue hour', scrim: 'heavy' },
  { id: 'editorial', name: 'Editorial', category: 'business', anchor: 'bottom', type: 'solid', face: 'playfair', accent: '#B45309', vibe: 'refined minimal still life, warm neutral light, premium and quiet', scrim: 'medium' },
  { id: 'launch', name: 'Product Launch', category: 'business', anchor: 'centre', type: 'extrude', face: 'archivo', accent: '#7C3AED', vibe: 'bold studio lighting, saturated gradient backdrop, dramatic', scrim: 'medium' },
  { id: 'community', name: 'Community', category: 'community', anchor: 'bottom', type: 'solid', face: 'archivo', accent: '#059669', vibe: 'warm human gathering, natural daylight, approachable and real', scrim: 'medium' },
  { id: 'openhouse', name: 'Open House', category: 'realestate', anchor: 'bottom', type: 'solid', face: 'playfair', accent: '#0F766E', vibe: 'bright modern home exterior, golden hour, aspirational architecture', scrim: 'medium' },
  { id: 'listing', name: 'Luxury Listing', category: 'realestate', anchor: 'bottom', type: 'script', face: 'playfair', accent: '#A16207', vibe: 'architectural interior, floor to ceiling glass, warm evening light', scrim: 'medium' },
  { id: 'gym', name: 'Gym / Bootcamp', category: 'fitness', anchor: 'centre', type: 'outline', face: 'anton', accent: '#EF4444', vibe: 'gritty gym, hard rim light, chalk dust, sweat and steel', scrim: 'heavy' },
  { id: 'race', name: 'Race / Challenge', category: 'fitness', anchor: 'bottom', type: 'extrude', face: 'bebas', accent: '#F59E0B', vibe: 'runners at dawn, motion, open road, energetic morning light', scrim: 'medium' },
]

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

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Artwork prompt. Bans lettering — a stray AI-drawn sign in the background is
 *  the fastest way to make the whole piece look fake. */
export function artPrompt(t: FlyerTemplate, subject: string, portrait = true): string {
  return [
    `Background artwork for a printed ${portrait ? 'flyer' : 'banner'}. Subject: ${subject}.`,
    `Style: ${t.vibe}.`,
    portrait
      ? `Vertical composition. Keep the ${t.anchor === 'top' ? 'upper' : t.anchor === 'centre' ? 'central' : 'lower'} third visually calm so text reads over it.`
      : 'Wide horizontal composition with the subject to one side, leaving the other side calm for text.',
    'ABSOLUTELY NO text, letters, numbers, words, signage, logos, watermarks or captions anywhere in the image.',
    'Photographic or richly illustrated, professional quality. No flat clip-art, no borders, no frames.',
  ].join(' ')
}

const FACES: Record<FlyerTemplate['face'], string> = {
  anton: "'Anton', Impact, sans-serif",
  bebas: "'Bebas Neue', Impact, sans-serif",
  archivo: "'Archivo Black', Inter, sans-serif",
  playfair: "'Playfair Display', Georgia, serif",
  script: "'Yellowtail', cursive",
}

/** The CSS that makes real text look like club-flyer lettering. */
function typeCss(t: TypeTreatment, accent: string, u: string): string {
  switch (t) {
    case 'chrome':
      // Gradient fill through background-clip. lineHeight and padding-bottom
      // are load-bearing: a clipped background cuts descenders otherwise.
      return `background:linear-gradient(178deg,#fff 4%,${accent} 34%,#7a5a12 56%,${accent} 74%,#fff 96%);
        -webkit-background-clip:text;background-clip:text;color:transparent;
        -webkit-text-stroke:calc(${u} * .12) rgba(0,0,0,.35);
        filter:drop-shadow(0 calc(${u} * .35) calc(${u} * .5) rgba(0,0,0,.55));
        padding-bottom:.14em`
    case 'neon':
      return `color:#fff;text-shadow:
        0 0 calc(${u} * .6) #fff,
        0 0 calc(${u} * 1.6) ${accent},
        0 0 calc(${u} * 3.2) ${accent},
        0 0 calc(${u} * 6) ${accent}`
    case 'outline':
      return `color:transparent;-webkit-text-stroke:calc(${u} * .28) #fff;
        text-shadow:0 calc(${u} * .5) calc(${u} * 1.2) rgba(0,0,0,.6);
        paint-order:stroke fill`
    case 'extrude':
      return `color:#fff;text-shadow:
        calc(${u} * .18) calc(${u} * .18) 0 ${accent},
        calc(${u} * .36) calc(${u} * .36) 0 ${accent},
        calc(${u} * .54) calc(${u} * .54) 0 rgba(0,0,0,.55),
        0 calc(${u} * 1) calc(${u} * 1.6) rgba(0,0,0,.5)`
    case 'script':
      return `color:${accent};text-shadow:0 calc(${u} * .35) calc(${u} * 1) rgba(0,0,0,.55);
        padding-bottom:.12em`
    default:
      return `color:#fff;text-shadow:0 calc(${u} * .3) calc(${u} * 1.3) rgba(0,0,0,.55)`
  }
}

const SCRIMS: Record<FlyerTemplate['scrim'], Record<string, string>> = {
  light: {
    bottom: 'linear-gradient(0deg,rgba(6,6,10,.78) 0%,rgba(6,6,10,.30) 45%,rgba(6,6,10,0) 75%)',
    top: 'linear-gradient(180deg,rgba(6,6,10,.78) 0%,rgba(6,6,10,.30) 45%,rgba(6,6,10,0) 75%)',
    centre: 'linear-gradient(180deg,rgba(6,6,10,.10),rgba(6,6,10,.62) 35%,rgba(6,6,10,.62) 65%,rgba(6,6,10,.10))',
  },
  medium: {
    bottom: 'linear-gradient(0deg,rgba(6,6,10,.90) 0%,rgba(6,6,10,.58) 40%,rgba(6,6,10,.08) 76%)',
    top: 'linear-gradient(180deg,rgba(6,6,10,.90) 0%,rgba(6,6,10,.55) 42%,rgba(6,6,10,.08) 74%)',
    centre: 'linear-gradient(180deg,rgba(6,6,10,.18),rgba(6,6,10,.84) 32%,rgba(6,6,10,.84) 68%,rgba(6,6,10,.18))',
  },
  heavy: {
    bottom: 'linear-gradient(0deg,rgba(4,4,8,.96) 0%,rgba(4,4,8,.74) 42%,rgba(4,4,8,.26) 80%)',
    top: 'linear-gradient(180deg,rgba(4,4,8,.96) 0%,rgba(4,4,8,.72) 44%,rgba(4,4,8,.24) 78%)',
    centre: 'linear-gradient(180deg,rgba(4,4,8,.34),rgba(4,4,8,.92) 30%,rgba(4,4,8,.92) 70%,rgba(4,4,8,.34))',
  },
}

export function renderFlyer(opts: {
  template: FlyerTemplate
  size: FlyerSize
  fields: FlyerFields
  artUrl?: string | null
  accent?: string
  logoUrl?: string | null
  print?: boolean
}): string {
  const { template: t, size, fields: f, artUrl, logoUrl, print } = opts
  const accent = opts.accent || t.accent
  const W = `${size.w}${size.unit}`
  const H = `${size.h}${size.unit}`

  // Landscape artboards get a side-by-side arrangement: a portrait poster
  // squeezed into a 1500x500 header would crush the type into nothing.
  const wide = size.w / size.h > 1.35
  const anchor = wide ? 'centre' : t.anchor

  // One unit, tied to the SHORT edge on wide boards so a banner's type is sized
  // by its height rather than its enormous width.
  const u = `var(--u)`
  const unitBase = wide ? `(var(--h) / 100)` : `(var(--w) / 100)`

  // Safe area is PER AXIS. Applying a width fraction to all four sides put
  // 768px of padding top and bottom on a 1440-tall YouTube banner — more
  // padding than artboard, and the content spilled 535px out of its own frame.
  // Vertical comes off the height, horizontal off the width.
  const safePad = size.safe
    ? `calc(var(--h) * ${size.safe}) calc(var(--w) * 0.07)`
    : `calc(${u} * 7)`

  // A banner is not a flyer with the same words at a different shape. A
  // YouTube header's guaranteed-visible strip is about 423px tall; the full
  // set of facts, bullets, address and contact cannot live there and trying
  // makes every one of them illegible. Wide boards keep the poster essentials
  // and drop the rest.
  const banner = size.w / size.h > 2.2 || size.group === 'banner'

  const line = (label: string, value?: string) =>
    value ? `<div class="fact"><span class="fl">${esc(label)}</span><span class="fv">${esc(value)}</span></div>` : ''
  const facts = [
    line('When', [f.date, f.time].filter(Boolean).join(' · ')),
    line('Where', f.venue),
    line('Cost', f.price),
  ].filter(Boolean).join('')

  const details = (f.details ?? []).length
    ? `<ul class="details">${(f.details ?? []).slice(0, 4).map((d) => `<li>${esc(d)}</li>`).join('')}</ul>`
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

  // Tiny boards (a 4x4 handout, a LinkedIn strip) cannot carry the whole set —
  // hide the supporting matter rather than shrink it into unreadability.
  const tiny = (size.unit === 'in' ? size.w * size.h : (size.w * size.h) / 9216) < 26

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo+Black&family=Bebas+Neue&family=Inter:wght@400;600;800&family=Playfair+Display:wght@700;900&family=Yellowtail&display=swap" rel="stylesheet">
<style>
:root{--w:${W};--h:${H};--accent:${accent};--u:calc(${unitBase})}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:${print ? '#fff' : '#232327'};min-height:100%;
  ${print ? '' : 'display:flex;align-items:center;justify-content:center;'}}
${print ? `@page{size:${W} ${H};margin:0}html,body{width:${W};height:${H};display:block}` : ''}
.page{position:relative;width:var(--w);height:var(--h);overflow:hidden;background:#0c0c10;color:#fff;
  font-family:Inter,system-ui,sans-serif;${print ? '' : 'box-shadow:0 20px 60px rgba(0,0,0,.5);'}}
.art{position:absolute;inset:0;background-size:cover;background-position:center;z-index:0}
.art.noart{background:linear-gradient(150deg,#16161d,#26262f 55%,var(--accent))}
.scrim{position:absolute;inset:0;z-index:1;background:${SCRIMS[t.scrim][anchor]}}
.inner{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;
  padding:${safePad};
  justify-content:${anchor === 'top' ? 'flex-start' : anchor === 'centre' ? 'center' : 'flex-end'};
  align-items:center;text-align:center}
${wide ? `.inner{align-items:flex-start;text-align:left;width:58%}` : ''}
.eyebrow{font-weight:800;letter-spacing:.24em;text-transform:uppercase;
  font-size:calc(${u} * 2.3);color:var(--accent);margin-bottom:calc(${u} * 2)}
h1{font-family:${FACES[t.face]};
  font-weight:${t.face === 'playfair' ? 900 : t.face === 'archivo' ? 400 : 400};
  font-size:calc(${u} * ${t.face === 'script' ? 11 : wide ? 11 : 13});
  line-height:${t.face === 'script' ? 1.05 : 0.94};
  letter-spacing:${t.face === 'playfair' || t.face === 'script' ? '0' : '.01em'};
  text-transform:${t.face === 'playfair' || t.face === 'script' ? 'none' : 'uppercase'};
  text-wrap:balance;${typeCss(t.type, accent, u)}}
.subhead{font-size:calc(${u} * 2.9);line-height:1.34;margin-top:calc(${u} * 2.2);
  max-width:32ch;color:rgba(255,255,255,.93);font-weight:600}
.facts{display:flex;gap:calc(${u} * 4.5);margin-top:calc(${u} * 4);flex-wrap:wrap;
  justify-content:${wide ? 'flex-start' : 'center'}}
.fact{display:flex;flex-direction:column;gap:calc(${u} * .5)}
.fl{font-size:calc(${u} * 1.8);letter-spacing:.18em;text-transform:uppercase;color:var(--accent);font-weight:800}
.fv{font-size:calc(${u} * 3);font-weight:700}
.details{list-style:none;margin-top:calc(${u} * 3);display:flex;flex-direction:column;gap:calc(${u} * 1.1);
  align-items:${wide ? 'flex-start' : 'center'}}
.details li{font-size:calc(${u} * 2.4);color:rgba(255,255,255,.92);position:relative;padding-left:calc(${u} * 3)}
.details li::before{content:"";position:absolute;left:0;top:calc(${u} * 1);width:calc(${u} * 1.2);height:calc(${u} * 1.2);background:var(--accent);border-radius:50%}
.addr{font-size:calc(${u} * 2.2);color:rgba(255,255,255,.78);margin-top:calc(${u} * 1.8)}
.cta{margin-top:calc(${u} * 3.6);background:var(--accent);color:#0b0b0f;font-weight:800;
  font-size:calc(${u} * 2.9);letter-spacing:.04em;padding:calc(${u} * 1.9) calc(${u} * 4.2);
  border-radius:calc(${u} * .9);text-transform:uppercase}
.contact{margin-top:calc(${u} * 2);font-size:calc(${u} * 2.2);color:rgba(255,255,255,.88);font-weight:700}
.logo{margin-top:calc(${u} * 3);height:calc(${u} * 6.5);width:auto;object-fit:contain}
${tiny ? '.details,.addr,.subhead{display:none}.facts{gap:calc(var(--u) * 3);margin-top:calc(var(--u) * 3)}' : ''}
${banner ? `.details,.addr,.contact,.facts,.logo{display:none}
  h1{font-size:calc(${u} * 15)}
  .subhead{font-size:calc(${u} * 3.4);margin-top:calc(${u} * 1.6);max-width:26ch}
  .cta{margin-top:calc(${u} * 2.4);font-size:calc(${u} * 3);padding:calc(${u} * 1.6) calc(${u} * 3.4)}` : ''}
</style></head><body>
<div class="page">
  <div class="art${artUrl ? '' : ' noart'}"${artUrl ? ` style="background-image:url('${esc(artUrl)}')"` : ''}></div>
  <div class="scrim"></div>
  <div class="inner">${block}</div>
</div>
</body></html>`
}
