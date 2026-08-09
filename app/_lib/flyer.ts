// =============================================================================
// Flyer engine — the WHOLE flyer is generated, lettering included.
//
// This started as AI-art-plus-typeset-text, on the assumption that image models
// garble letters. That assumption was out of date. Tested against gpt-image-2
// with a full club flyer: "MIDNIGHT SOCIETY", "SAT 23 AUGUST · DOORS 9PM",
// "$20 DOOR" all came back correctly spelled, kerned, and set in gold chrome
// 3D lettering — the maximalist PSD-template look that typesetting over a photo
// cannot reach. So the model does the whole job.
//
// A template here is therefore a PROMPT, not a layout: an art direction for the
// scene plus an art direction for the lettering. That is also why templates can
// look wildly different from one another — nothing is constrained by a shared
// stylesheet any more.
//
// TWO THINGS THIS COSTS, both worth knowing:
//   - Every size is generated at its OWN aspect ratio (see apiSize) so nothing
//     is cropped, but a pixel budget of about 4 MP caps the detail. Social and
//     handouts are native; a full-bleed 11x17 wants 16 MP and gets upscaled.
//   - Exact strings are the model's to get right. It is very good now, but a
//     phone number or an unusual venue name should be READ before it goes to
//     print. The page says so.
// =============================================================================

export type FlyerSize = {
  id: string
  label: string
  group: 'print' | 'social' | 'banner'
  w: number
  h: number
  unit: 'in' | 'px'
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
  { id: 'fb-cover', label: 'Facebook cover 1640 × 624', group: 'banner', w: 1640, h: 624, unit: 'px' },
  { id: 'yt-banner', label: 'YouTube banner 2560 × 1440', group: 'banner', w: 2560, h: 1440, unit: 'px' },
  { id: 'yt-thumb', label: 'YouTube thumbnail 1280 × 720', group: 'banner', w: 1280, h: 720, unit: 'px' },
  { id: 'x-header', label: 'X / Twitter header 1500 × 500', group: 'banner', w: 1500, h: 500, unit: 'px' },
  { id: 'li-banner', label: 'LinkedIn banner 1584 × 396', group: 'banner', w: 1584, h: 396, unit: 'px' },
]

// THE REAL LIMITS, measured against the API rather than assumed.
//
// An earlier version of this file claimed gpt-image offered three fixed shapes
// and everything else had to be cropped. That was wrong, and it made the wide
// sizes far worse than they needed to be. Asking the API directly:
//
//   - any size works, provided BOTH dimensions divide by 16
//   - the aspect ratio may not exceed 3:1 either way
//   - the longest edge may not exceed 3840
//   - and there is a pixel budget: 4.45 MP was accepted, 8.4 MP refused
//
// So almost every size here can be generated at its OWN aspect ratio, natively,
// with no cropping at all. Only a 4:1 LinkedIn strip falls outside, and that
// one only needs a gentle 25% trim from 3:1 instead of 63% from 3:2.
const MAX_RATIO = 3
const MAX_EDGE = 3840
// Comfortably inside the observed ceiling — a rejected generation costs a whole
// round trip, and the difference between 4.19 and 4.45 MP is invisible.
const PIXEL_BUDGET = 4_190_000
// There is a floor too — 1152x384 (0.44 MP) was refused as below minimum.
const MIN_PIXELS = 1_100_000
const PRINT_DPI = 300

/** What to actually ask the API for, so the result needs no crop. */
export function apiSize(s: FlyerSize): { size: string; w: number; h: number; banded: boolean } {
  // What the user really wants, in pixels.
  const wantW = s.unit === 'in' ? s.w * PRINT_DPI : s.w
  const wantH = s.unit === 'in' ? s.h * PRINT_DPI : s.h

  // Clamp the shape. Past 3:1 the API refuses, so the design is composed inside
  // a 3:1 frame and trimmed to the strip — a far gentler cut than before.
  const ratio = wantW / wantH
  const banded = ratio > MAX_RATIO || ratio < 1 / MAX_RATIO
  let r = Math.min(Math.max(ratio, 1 / MAX_RATIO), MAX_RATIO)

  // Fit the pixel budget and the edge limit while holding that shape.
  let w = Math.sqrt(PIXEL_BUDGET * r)
  let h = w / r
  const over = Math.max(w / MAX_EDGE, h / MAX_EDGE, 1)
  w /= over; h /= over
  // Don't generate more pixels than were asked for — a 4x4 handout needs
  // nowhere near 4 MP. Skipped when banded, because there the generated frame
  // is deliberately TALLER than the target: it gets trimmed down to the strip,
  // and matching the target first shrank the LinkedIn request to 1152x384,
  // which the API then refused for being under its minimum.
  if (!banded) {
    const down = Math.max(w / wantW, h / wantH, 1)
    if (down > 1) { w /= down; h /= down }
  }
  // There is a floor as well as a ceiling.
  const up = Math.sqrt(MIN_PIXELS / (w * h))
  if (up > 1) { w *= up; h *= up }

  // Both edges must divide by 16.
  const snap = (n: number) => Math.max(256, Math.floor(n / 16) * 16)
  let W = snap(w)
  const H = snap(h)
  // Rounding BOTH down can push the ratio up: the LinkedIn strip landed on
  // 1184x384, which is 3.08:1, and the API refused it. Shave the long edge
  // until the shape is legal — better here than a round trip later.
  while (W / H > MAX_RATIO && W > 256) W -= 16
  return { size: `${W}x${H}`, w: W, h: H, banded }
}

export type FlyerTemplate = {
  id: string
  name: string
  category: 'nightlife' | 'business' | 'community' | 'realestate' | 'fitness'
  /** The scene: what is actually pictured. */
  scene: string
  /** The lettering: how the words should look. This is what separates a club
   *  flyer from a corporate one far more than the photograph does. */
  lettering: string
}

export const FLYER_TEMPLATES: FlyerTemplate[] = [
  {
    id: 'rnb', name: 'R&B Night', category: 'nightlife',
    scene: 'Luxury R&B night. Black and gold. A glamorous, stylish crowd in a high-end club, warm amber stage haze, gold chains and champagne, cinematic portrait lighting, rich contrast, glossy magazine finish.',
    lettering: 'Main title in bold gold chrome 3D lettering with reflective metallic finish and a subtle bevel. Supporting text in clean high-contrast sans-serif.',
  },
  {
    id: 'retro', name: 'Retro Night', category: 'nightlife',
    scene: 'Eighties synthwave party. Magenta, violet and cyan neon. Chrome grid horizon, retro sunset, VHS grain, portraits lit in split magenta and blue.',
    lettering: 'Main title in glossy chrome italic lettering with a magenta-to-cyan gradient and a neon outer glow, eighties arcade styling.',
  },
  {
    id: 'ladies', name: 'Ladies Night', category: 'nightlife',
    scene: 'Glamorous ladies night. Gold disco ball, champagne sparkle, sequins, warm golden light, elegant and celebratory, high fashion feel.',
    lettering: 'Main title in elegant flowing gold script with a soft glow, paired with clean uppercase sans-serif for details.',
  },
  {
    id: 'vip', name: 'VIP Luxury', category: 'nightlife',
    scene: 'VIP luxury club night. Black and gold, a supercar, deep shadow, dramatic rim light, opulent and exclusive, very high contrast.',
    lettering: 'Main title in heavy gold metallic block capitals with a strong bevel and specular highlights, luxury branding feel.',
  },
  {
    id: 'neonclub', name: 'Neon Club', category: 'nightlife',
    scene: 'Dark club interior packed with dancers, cyan and magenta neon tubes, atmospheric fog, laser beams, energetic and modern.',
    lettering: 'Main title as glowing neon tube lettering in cyan and magenta, with realistic light bloom against the dark background.',
  },
  {
    id: 'halloween', name: 'Halloween', category: 'nightlife',
    scene: 'Halloween party. Eerie green and purple fog, gothic details, skulls and candlelight, moonlit and haunting, cinematic horror poster styling.',
    lettering: 'Main title in dripping horror lettering with a rough edge and an eerie green glow.',
  },
  {
    id: 'tropical', name: 'Tropical Night', category: 'nightlife',
    scene: 'Tropical beach party at sunset. Palms, turquoise water, warm orange and pink dusk sky, cocktails, relaxed and vibrant.',
    lettering: 'Main title in bold rounded lettering with a tropical sunset gradient and a soft drop shadow.',
  },
  {
    id: 'corporate', name: 'Corporate Event', category: 'business',
    scene: 'Modern corporate event. Glass architecture at blue hour, clean professional lighting, sharp and credible, restrained colour palette of navy and white.',
    lettering: 'Main title in confident modern sans-serif, generous spacing, no effects — clean and corporate.',
  },
  {
    id: 'editorial', name: 'Editorial', category: 'business',
    scene: 'Refined editorial still life. Warm neutral light, premium materials, quiet and minimal, lots of negative space, high-end magazine styling.',
    lettering: 'Main title in an elegant high-contrast serif, understated and premium, with fine hairline rules.',
  },
  {
    id: 'launch', name: 'Product Launch', category: 'business',
    scene: 'Bold product launch. Dramatic studio lighting on a saturated gradient backdrop, purple and electric blue, sharp and modern.',
    lettering: 'Main title in heavy geometric sans-serif with a 3D extrude in the accent colour.',
  },
  {
    id: 'community', name: 'Community', category: 'community',
    scene: 'Warm community gathering. Natural daylight, real people together, approachable and genuine, soft greens and warm neutrals.',
    lettering: 'Main title in friendly rounded sans-serif, warm and readable, no harsh effects.',
  },
  {
    id: 'openhouse', name: 'Open House', category: 'realestate',
    scene: 'Bright modern home exterior at golden hour, manicured landscaping, aspirational architecture, clear blue sky.',
    lettering: 'Main title in a clean elegant serif with a slim underline, professional real-estate branding.',
  },
  {
    id: 'listing', name: 'Luxury Listing', category: 'realestate',
    scene: 'Architectural interior with floor-to-ceiling glass, warm evening light, designer furnishings, calm and expensive.',
    lettering: 'Main title in refined gold serif capitals with wide letter spacing, luxury property styling.',
  },
  {
    id: 'gym', name: 'Gym / Bootcamp', category: 'fitness',
    scene: 'Gritty gym. Hard rim lighting, chalk dust in the air, steel and sweat, dark and intense, red accent lighting.',
    lettering: 'Main title in aggressive heavy condensed capitals with a rough distressed edge and a red outline.',
  },
  {
    id: 'race', name: 'Race / Challenge', category: 'fitness',
    scene: 'Runners at dawn on an open road, motion and energy, warm morning light, wide sky, determined and uplifting.',
    lettering: 'Main title in bold italic sports lettering with a forward-motion slant and an amber gradient.',
  },
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

/**
 * Build the prompt for a complete flyer.
 *
 * Every string the user supplied is quoted VERBATIM and the model is told not
 * to substitute — that is what keeps a venue name or a price from drifting into
 * something that merely looks similar. Fields left blank are omitted entirely
 * rather than sent as an empty instruction, because an image model given
 * "Price: " will happily invent one.
 */
export function flyerPrompt(t: FlyerTemplate, f: FlyerFields, size: FlyerSize): string {
  const ratio = size.w / size.h
  const wide = ratio > 1.3
  const square = Math.abs(ratio - 1) < 0.15
  // Wider than gpt-image's widest shape (3:2), so it has to be composed as a
  // band inside that frame. bandPct is how much of the 3:2 frame's height the
  // finished banner occupies — 37% for a 4:1 LinkedIn strip, 57% for a
  // Facebook cover. The model is told the number so it designs to it.
  const ultrawide = ratio > 3
  // Understate the band by 15%. The model fills whatever band it is given
  // edge to edge, so quoting the exact figure leaves zero margin — the first
  // 4:1 LinkedIn strip had its headline touching the top cut line. Asking for
  // a slightly narrower band means the real trim lands in empty space.
  const bandPct = Math.round((3 / ratio) * 88)

  const lines: string[] = []
  if (f.eyebrow) lines.push(`- Small line above the title: "${f.eyebrow}"`)
  if (f.headline) lines.push(`- LARGE MAIN TITLE: "${f.headline}"`)
  if (f.subhead) lines.push(`- Supporting line under the title: "${f.subhead}"`)
  const when = [f.date, f.time].filter(Boolean).join(' · ')
  if (when) lines.push(`- Date and time line: "${when}"`)
  if (f.venue) lines.push(`- Venue name: "${f.venue}"`)
  if (f.address) lines.push(`- Address, small: "${f.address}"`)
  if (f.price) lines.push(`- Price: "${f.price}"`)
  for (const d of (f.details ?? []).slice(0, 4)) lines.push(`- Detail line: "${d}"`)
  if (f.cta) lines.push(`- Call to action bar: "${f.cta}"`)
  if (f.contact) lines.push(`- Contact line at the bottom, small: "${f.contact}"`)

  return [
    `A professional ${wide ? 'wide banner' : square ? 'square social media' : 'portrait poster'} advertisement, print quality, designed by a graphic designer.`,
    '',
    `DESIGN STYLE: ${t.scene}`,
    '',
    lines.length
      ? `TEXT TO RENDER — spell every word EXACTLY as written, no substitutions, no invented text, and do not add any words that are not listed:\n${lines.join('\n')}`
      : 'TEXT: none — artwork only.',
    '',
    `TYPOGRAPHY: ${t.lettering} All text must be sharp, correctly spelled, properly kerned and clearly legible with strong contrast against whatever sits behind it.`,
    '',
    // SAFE MARGINS. Nothing in the prompt used to ask for these, so the model
    // ran headlines flush to the edge and letters came back clipped — on print
    // that is worse than it looks on screen, because trimming takes a few more
    // millimetres off every side.
    'SAFE MARGINS — THIS IS CRITICAL AND NON-NEGOTIABLE:',
    '- Leave a clear, generous empty margin all the way around the design: at least 8% of the width on the left and right, and at least 6% of the height at the top and bottom.',
    '- NO text, letter, number, logo, face or important detail may touch, overlap or sit near any edge of the image. Everything that matters must sit comfortably INSIDE that margin.',
    '- Background imagery, colour and texture may run right to the edges. Only text and key subjects are held back.',
    '- Nothing may be cut off, clipped or run out of frame. If the text does not fit, make the text smaller — never let it reach the edge.',
    '',
    // COMPOSE FOR THE FINAL SHAPE, don't crop a design that was made for a
    // different one. gpt-image offers three frames, so a 4:1 LinkedIn banner
    // cannot be drawn directly — but it CAN be drawn as a wide band inside a
    // 3:2 frame, with the model told exactly which band survives. Everything
    // outside is asked to be empty background, so trimming to the band removes
    // nothing that was ever part of the design.
    //
    // The earlier version cropped a poster composed for a poster, and the
    // Facebook cover lost 43% of its height along with the text in it.
    `LAYOUT: professional composition with clear visual hierarchy — the main title dominant, supporting details grouped and easy to scan. ${
      ultrawide
        ? `THIS IS A WIDE LETTERBOX BANNER. The finished banner is ONLY the central horizontal band of this image — roughly the middle ${bandPct}% of its height. Design the ENTIRE banner inside that central band: all imagery, all text, edge to edge across the full width. Above and below that band, render nothing but plain flat dark background — no imagery, no text, no detail whatsoever. Lay the band out horizontally with the text grouped to one side and the imagery flowing across the rest.`
        : wide
        ? 'Wide format: lay it out horizontally with the text block to one side and the imagery to the other, and keep all text clear of the top and bottom edges.'
        : 'Keep all text comfortably inside the edges with generous margins on every side.'
    }`,
    'Do not include any watermark, signature, stock-photo marking, URL or QR code unless one is listed above.',
  ].join('\n')
}

/** Where a template's sample image lives once it has been pre-generated. */
export const thumbUrl = (id: string) => `/flyer-templates/${id}.png`
