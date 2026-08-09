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
//   - Resolution caps at 1536px on the long edge. Perfect for social and fine
//     for a handout; a full-bleed 8.5x11 at 300dpi would want 3300px, so large
//     print gets upscaled and softens. Stated on the page, not hidden.
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

/** gpt-image only offers three shapes; everything else is cropped to fit. */
export function nearestGptSize(s: FlyerSize): '1024x1024' | '1024x1536' | '1536x1024' {
  const r = s.w / s.h
  if (r > 1.15) return '1536x1024'
  if (r < 0.87) return '1024x1536'
  return '1024x1024'
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
  // Wider than gpt-image's widest shape (3:2), so the trim is severe.
  const ultrawide = ratio > 1.62

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
    // WARN THE MODEL ABOUT THE CROP. gpt-image only produces three shapes, so
    // anything else is trimmed to fit — and the first wide ad came back with
    // "FRIDAY NIGHT" sliced off the top, because the picture was composed for
    // the frame it was drawn in rather than the frame it would end up in.
    `LAYOUT: professional composition with clear visual hierarchy — the main title dominant, supporting details grouped and easy to scan. ${
      ultrawide
        ? 'CRITICAL: this will be trimmed top and bottom to a very wide letterbox. Keep EVERY piece of text inside the middle half of the image height, well clear of the top and bottom edges — anything near them will be cut off. Place the text to one side with the imagery to the other.'
        : wide
        ? 'Wide format: place the text block to one side and the imagery to the other, and keep all text clear of the top and bottom edges.'
        : 'Keep all text comfortably inside the edges with generous margins on every side.'
    }`,
    'Do not include any watermark, signature, stock-photo marking, URL or QR code unless one is listed above.',
  ].join('\n')
}

/** Where a template's sample image lives once it has been pre-generated. */
export const thumbUrl = (id: string) => `/flyer-templates/${id}.png`
