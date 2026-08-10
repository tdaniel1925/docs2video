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
  group: 'print' | 'social' | 'banner' | 'card' | 'slide'
  w: number
  h: number
  unit: 'in' | 'px'
  /**
   * Dots per inch for a printed piece. 300 is what a commercial printer asks
   * for and is right for anything held in the hand. Large-format work — a yard
   * sign read from across a lawn — is printed at 150 and asking for 300 would
   * quadruple the pixels for detail no eye will ever resolve.
   */
  dpi?: number
}

/**
 * Bleed: the extra margin of artwork that gets cut off.
 *
 * A commercial printer cannot cut to the exact millimetre, so anything meant to
 * reach the edge of the paper must be printed slightly OVERSIZE and trimmed
 * into. Without it, a fraction of a millimetre of drift leaves a white sliver
 * down one side — the single most common reason a print job is rejected.
 *
 * An eighth of an inch per edge is the near-universal standard.
 */
export const BLEED_IN = 0.125

/**
 * Print resolution for a size — 300 unless the size says otherwise.
 *
 * A size measured in PIXELS is never printed, so it gets 72: the screen
 * convention. Returning 300 for an Instagram post is the kind of answer that
 * looks harmless and then gets written into a file as its density, telling
 * print software the image is a third of its real size. The first thing that
 * called this fell into exactly that, so the trap is closed here rather than
 * left for each caller to remember.
 */
export const dpiFor = (s: FlyerSize): number => (s.unit === 'in' ? s.dpi ?? PRINT_DPI : 72)

/** Can this size be printed, and therefore have bleed added? */
export const canBleed = (s: FlyerSize): boolean => s.unit === 'in'

/**
 * The finished pixel dimensions — what the customer downloads.
 *
 * With bleed the artwork is BIGGER than the piece: an 8.5x11 flyer becomes
 * 8.75x11.25 inches of image, and the printer trims an eighth off every edge.
 */
export function printPixels(s: FlyerSize, bleed = false): { w: number; h: number; dpi: number } {
  if (s.unit === 'px') return { w: s.w, h: s.h, dpi: 72 }
  const dpi = dpiFor(s)
  const extra = bleed ? BLEED_IN * 2 : 0
  return {
    w: Math.round((s.w + extra) * dpi),
    h: Math.round((s.h + extra) * dpi),
    dpi,
  }
}

export const FLYER_SIZES: FlyerSize[] = [
  { id: 'letter', label: 'Flyer / sell sheet 8.5 × 11 in', group: 'print', w: 8.5, h: 11, unit: 'in' },
  { id: 'square4', label: 'Flyer 4 × 4 in', group: 'print', w: 4, h: 4, unit: 'in' },
  { id: 'half', label: 'Half page 5.5 × 8.5 in', group: 'print', w: 5.5, h: 8.5, unit: 'in' },
  { id: 'poster', label: 'Poster 11 × 17 in', group: 'print', w: 11, h: 17, unit: 'in' },
  { id: 'postcard-6x4', label: 'Postcard 6 × 4 in', group: 'print', w: 6, h: 4, unit: 'in' },
  { id: 'postcard-5x7', label: 'Postcard 5 × 7 in', group: 'print', w: 5, h: 7, unit: 'in' },
  { id: 'rack-card', label: 'Rack card 3.5 × 8.5 in', group: 'print', w: 3.5, h: 8.5, unit: 'in' },
  { id: 'door-hanger', label: 'Door hanger 4.25 × 11 in', group: 'print', w: 4.25, h: 11, unit: 'in' },
  { id: 'table-tent', label: 'Table tent 4 × 6 in', group: 'print', w: 4, h: 6, unit: 'in' },
  { id: 'a4', label: 'A4 flyer 8.27 × 11.69 in', group: 'print', w: 8.27, h: 11.69, unit: 'in' },
  // Read from across a lawn, not from the hand. 150 dpi is the trade standard
  // for large format; at 300 this would be a 39-megapixel file for detail
  // nobody standing on the pavement can see.
  { id: 'yard-sign', label: 'Yard sign 24 × 18 in', group: 'print', w: 24, h: 18, unit: 'in', dpi: 150 },
  // A six-foot banner is read from ten feet away or more, and the trade prints
  // these at 72 dpi or less at full size — asking for 150 would demand a
  // 10,000-pixel file to carry detail nobody can stand close enough to see.
  { id: 'banner-3x6', label: 'Vinyl banner 6 × 3 ft', group: 'print', w: 72, h: 36, unit: 'in', dpi: 72 },
  { id: 'ig-post', label: 'Instagram post 1080²', group: 'social', w: 1080, h: 1080, unit: 'px' },
  { id: 'ig-story', label: 'Instagram story / Reel', group: 'social', w: 1080, h: 1920, unit: 'px' },
  { id: 'fb-post', label: 'Facebook post 1200 × 1500', group: 'social', w: 1200, h: 1500, unit: 'px' },
  { id: 'fb-ad', label: 'Facebook / IG ad 1200 × 628', group: 'social', w: 1200, h: 628, unit: 'px' },
  { id: 'fb-cover', label: 'Facebook cover 1640 × 624', group: 'banner', w: 1640, h: 624, unit: 'px' },
  { id: 'yt-banner', label: 'YouTube banner 2560 × 1440', group: 'banner', w: 2560, h: 1440, unit: 'px' },
  { id: 'yt-thumb', label: 'YouTube thumbnail 1280 × 720', group: 'banner', w: 1280, h: 720, unit: 'px' },
  { id: 'x-header', label: 'X / Twitter header 1500 × 500', group: 'banner', w: 1500, h: 500, unit: 'px' },
  { id: 'li-banner', label: 'LinkedIn banner 1584 × 396', group: 'banner', w: 1584, h: 396, unit: 'px' },
  // Standard UK/US business card. Small enough that the pixel FLOOR applies
  // rather than the ceiling — apiSize scales the request up to the API's
  // minimum and the result is scaled back down to 1050x600 for print, which is
  // why a card comes out unusually crisp.
  { id: 'biz-card-front', label: 'Business card — front 3.5 × 2 in', group: 'card', w: 3.5, h: 2, unit: 'in' },
  { id: 'biz-card-back', label: 'Business card — back 3.5 × 2 in', group: 'card', w: 3.5, h: 2, unit: 'in' },
  // Presentation slides. 1920x1080 is what a projector, a TV and PowerPoint all
  // expect; the 4:3 size is still what a lot of older meeting-room screens run.
  { id: 'slide-16x9', label: 'Slide 1920 × 1080', group: 'slide', w: 1920, h: 1080, unit: 'px' },
  { id: 'slide-4x3', label: 'Slide 1600 × 1200 (4:3)', group: 'slide', w: 1600, h: 1200, unit: 'px' },
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

/**
 * What to actually ask the API for, so the result needs no crop.
 *
 * `bleed` matters here as well as at export time: the SHAPE changes. An 8.5x11
 * flyer with bleed is 8.75x11.25, a slightly different ratio, and generating at
 * the wrong one would mean cropping the design after all — which is exactly the
 * thing this function exists to avoid.
 */
export function apiSize(s: FlyerSize, bleed = false): { size: string; w: number; h: number; banded: boolean } {
  // What the user really wants, in pixels — including the bleed margin that
  // will be trimmed away.
  const want = printPixels(s, bleed)
  const wantW = want.w
  const wantH = want.h

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
  category:
    | 'business' | 'sale' | 'food' | 'services'
    | 'realestate' | 'fitness' | 'community' | 'music' | 'nightlife'
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
  {
    id: 'workshop', name: 'Workshop', category: 'business',
    scene: 'Bright daytime training room. Pale oak table, blank sticky notes in mint and coral on a whiteboard, ceramic coffee cups and open blank notebooks, tall windows with soft diffused daylight, airy white and warm teal palette, friendly and hands-on, natural matte finish, no glare.',
    lettering: 'Main title in a rounded geometric sans, medium weight with wide open counters, set in flat marker-ink colour with a hand-drawn highlighter swipe behind it. Supporting text in light rounded sans.',
  },
  {
    id: 'law-firm', name: 'Law & Finance', category: 'business',
    scene: 'Traditional professional-services interior after hours. Dark walnut panelling, deep forest green leather chair, brass desk lamp casting one low warm pool of light, rows of unmarked bound volumes, shallow depth of field, heavy falloff into shadow, subtle film grain.',
    lettering: 'Main title in engraved small-caps serif, tight letterspacing, soft letterpress deboss with a thin brushed-brass edge. Supporting text in restrained roman capitals, wide tracked.',
  },
  {
    id: 'blowout-sale', name: 'Blowout Sale', category: 'sale',
    scene: 'Explosive discount energy. Flat screaming red and lemon yellow, hard black diagonal slashes, burst starbursts and torn price-tag shapes, no photograph — pure vector poster, matte print finish, zero gradients, maximum contrast.',
    lettering: 'Enormous ultra-heavy italic capitals in white with a thick black outline and a hard yellow drop shadow, slightly skewed forward for speed.',
  },
  {
    id: 'clean-retail', name: 'Modern Retail', category: 'sale',
    scene: 'Bright product promotion shot straight down. Everyday items arranged in a neat grid on a saturated cobalt-blue surface, hard midday sunlight casting crisp offset shadows, tangerine and white accents, punchy saturated colour, glossy finish.',
    lettering: 'Geometric sans-serif in two weights: the number tight and bold, the words light with wide letter-spacing. No outlines, no shadows.',
  },
  {
    id: 'holiday-sale', name: 'Holiday Sale', category: 'sale',
    scene: 'Cosy seasonal promotion. Warm lamplight over deep pine green and cranberry red, brushed kraft paper texture, evergreen sprigs, twine, cinnamon sticks and cut orange, soft golden bokeh behind, tactile matte finish with a faint sheen.',
    lettering: 'Warm hand-drawn script for the lead word paired with small friendly rounded sans capitals, both in soft antique gold foil.',
  },
  {
    id: 'quiet-luxury-sale', name: 'Luxury Sale', category: 'sale',
    scene: 'Restrained upscale markdown. Cool bone-white and pale stone, a single draped silk swatch on a brushed-nickel rail, low raking window light, long soft shadows, muted sand and charcoal palette, still and expensive, subtle film grain.',
    lettering: 'Sparse thin serif capitals with very wide tracking and a hairline rule beneath; no bold anywhere, the number set in the same thin serif at large size.',
  },
  {
    id: 'rustic-kitchen', name: 'Farmhouse Kitchen', category: 'food',
    scene: 'Rustic artisan kitchen table. Flour-dusted scarred oak, crumpled linen cloth, cast-iron pan and torn sourdough, single window of soft north light raking across, deep shadow, muted palette of wheat, butter cream and forest green, matte film-grain finish.',
    lettering: 'Main title in a warm hand-brushed script with slightly uneven ink weight and dry-brush tails, paired with small letterspaced woodblock capitals in charcoal.',
  },
  {
    id: 'fresh-menu', name: 'Fresh Menu', category: 'food',
    scene: 'Bright modern food photography on a seamless pale mint backdrop. Overhead flat-lay of colourful bowls, citrus halves and scattered herbs, crisp studio softbox light, tiny hard shadows, saturated palette of lime, coral and white, clean glossy commercial finish.',
    lettering: 'Main title in rounded geometric sans-serif, extra-bold, cheerful and tightly kerned, with a soft coral drop shadow and no texture or outline.',
  },
  {
    id: 'street-food', name: 'Street Food', category: 'food',
    scene: 'Loud street-food illustration. Flat vector poster art of a busy food truck at dusk, halftone dot shading, thick black linework, riso-print colour of chilli red, hot yellow and cobalt, steam curls and paper trays, screen-printed poster finish.',
    lettering: 'Main title in chunky slab capitals with a hard black outline and a yellow offset shadow, tilted for energy, edges showing slight ink misregistration.',
  },
  {
    id: 'cocktail-lounge', name: 'Cocktail Bar', category: 'food',
    scene: 'Art Deco cocktail bar after midnight. Coupe glass on a polished black marble counter, fluted chrome column and mirrored back wall, cool jade and emerald light, condensation beads, citrus twist, silver-grey shadows, crisp glass-and-metal reflections, sharp modern finish.',
    lettering: 'Main title in tall Art Deco geometric capitals, widely spaced, polished silver chrome with a fine engraved inline stripe through each letter; subtitle in ivory letterspaced small caps.',
  },
  {
    id: 'salon-luxe', name: 'Salon & Beauty', category: 'services',
    scene: 'Polished salon interior. Blush pink walls and warm brass fittings, soft diffused beauty lighting with a ring-light catch, veined marble counter, clear glass bottles, a dusty-rose velvet chair, glossy skin and glossy hair, clean editorial retouch.',
    lettering: 'Main title in a delicate high-contrast serif with long tapered strokes, filled with brushed rose-gold foil, joined by a fine looping monoline script accent word and wide-tracked thin capitals. No shadows.',
  },
  {
    id: 'home-services', name: 'Home Services', category: 'services',
    scene: 'Bright suburban home exterior on a clear morning. Fresh-cut lawn, tidy white siding, an unmarked plain white work van at the curb with a ladder on its roof rack, cloudless blue sky, even sunny daylight, royal blue, white and grass green.',
    lettering: 'Main title in sturdy rounded sans-serif capitals, solid navy with a thin white keyline and a flat inline stripe through each letter. Supporting text plain, wide and legible.',
  },
  {
    id: 'grease-trade', name: 'Auto & Repair', category: 'services',
    scene: 'Working garage bay at night. Bare caged shop lights and a hanging work lamp, oil-stained concrete floor, red steel toolbox, stacked tyres, deep near-black shadows cut by orange sodium spill, gloved hands on a wrench, gritty and hands-on.',
    lettering: 'Main title in heavy slab-serif capitals, chipped and worn at the edges, hand-painted burnt-orange fill with a hard black drop shadow and faint paint-flake texture.',
  },
  {
    id: 'friendly-flat', name: 'Friendly & Simple', category: 'services',
    scene: 'Cheerful flat vector illustration, no photography. Soft cream background, simple rounded shapes — a wagging dog, a broom, a stacked moving box and a little house — in teal, mustard and coral, thick even outlines, gentle paper-grain texture.',
    lettering: 'Main title in a chunky friendly rounded sans-serif with a slightly bouncy baseline, solid teal, plus one small handwritten marker-style accent word in coral.',
  },
  {
    id: 'agent-brand', name: 'Agent Brand', category: 'realestate',
    scene: 'Confident agent-brand portrait. A well-dressed real estate professional, arms folded, standing in a bright studio against a deep forest-green seamless backdrop, soft key light with clean falloff, crisp white shirt, a single brass key on a leather fob in hand, polished matte finish.',
    lettering: 'Main title in tall condensed sans-serif capitals, tight tracking, warm brass foil fill with a thin white keyline. Secondary text in small letterspaced uppercase.',
  },
  {
    id: 'acreage', name: 'Land & Acreage', category: 'realestate',
    scene: 'Wide open countryside parcel. Rolling grass fields in sage and wheat tones, a weathered split-rail fence line, distant treeline, big overcast sky with soft diffused daylight, elevated drone-height perspective, natural muted colour, gentle film grain.',
    lettering: 'Main title in a sturdy slab serif with slightly rounded corners, earthy cream fill, embossed letterpress texture. Details in a plain typewriter-style mono.',
  },
  {
    id: 'yoga-calm', name: 'Yoga & Wellness', category: 'fitness',
    scene: 'Serene sunrise yoga studio. Pale oak floor, sheer linen curtains, soft diffused daylight, a calm figure mid-stretch, palette of sand, sage and warm off-white, matte airy finish, long soft shadows and generous stillness.',
    lettering: 'Main title in a light airy serif, thin strokes, wide letter-spacing, all lowercase, no effects, soft ink-grey printed on cream.',
  },
  {
    id: 'boxing-ring', name: 'Boxing Night', category: 'fitness',
    scene: 'Vintage letterpress fight poster. Thick uncoated mustard-ochre paper with visible fibre, one heavy black ink pass, coarse halftone dots, a boxer\'s taped gloves rendered in rough screenprint, ink bleed at the edges, faded and slightly foxed, flat matte print — no photography.',
    lettering: 'Main title in fat slab-serif wood-type capitals, ink pressed unevenly so strokes break up, tight leading, a thick black rule above and below.',
  },
  {
    id: 'faith-gathering', name: 'Faith Gathering', category: 'community',
    scene: 'Sunlit sanctuary interior. Long dusty light beams slant through tall stained glass, honey-toned oak pews, cream plaster walls, a congregation standing together, dust motes hanging in the air, soft reverent amber glow, fine film grain.',
    lettering: 'Main title in a warm humanist serif with slightly rounded terminals and a soft letterpress emboss, wide letterspacing, thin gold hairline rule under the baseline.',
  },
  {
    id: 'bake-sale', name: 'Bake Sale', category: 'community',
    scene: 'Cheerful outdoor bake sale table. Red and white gingham cloth, glass domes over cupcakes and cookies, triangular paper bunting strung overhead, flat bright midday sun, pastel palette of strawberry pink, lemon yellow and mint, crisp candy-bright finish.',
    lettering: 'Main title in a chunky rounded sans, extra bold, thick white outline plus a second mint offset outline, flat soft drop shadow, no gradient — friendly and sugary.',
  },
  {
    id: 'festival-day', name: 'Outdoor Festival', category: 'music',
    scene: 'Outdoor daytime music festival. Wide grass field, a crowd with hands up, a scaffold stage under an open sky, golden late-afternoon sun and drifting dust haze, palette of sky blue, sun yellow and warm green, punchy saturated photographic finish.',
    lettering: 'Main title in inflated glossy sans-serif capitals with a rounded 3D extrude, a yellow-to-orange gradient face and a crisp white keyline. Supporting text in plain bold sans.',
  },
  {
    id: 'gospel-night', name: 'Gospel Night', category: 'music',
    scene: 'Uplifting gospel and worship night. A robed choir mid-song inside a church hall, light shafts falling through stained glass, palette of deep purple, warm gold and ivory, gentle glow, reverent and joyful, soft filmic grain.',
    lettering: 'Main title in a flowing hand-lettered script with a soft gold gradient and a thin ivory outline. Supporting text in a small-caps serif with wide letter spacing.',
  },
  {
    id: 'open-mic', name: 'Open Mic', category: 'music',
    scene: 'Intimate acoustic open-mic night. A single stool, an acoustic guitar and a vintage microphone in a small room, one warm lamp, textured cream paper stock with visible fibre, two-ink riso print look in burnt orange and slate blue, grainy halftone.',
    lettering: 'Main title in tall wooden-type letterpress capitals with worn edges and visible ink misregistration. Supporting text in a small typewriter monospace face.',
  },
  {
    id: 'business-early-start', name: 'Early Start', category: 'business',
    scene: 'Dawn over a glass office district, shot wide from a rooftop. Cool steel blue and pale silver, mist drifting between towers, first sun catching one edge of glass. Crisp digital capture, calm and spacious, matte finish.',
    lettering: 'Main title in thin uppercase sans-serif with very wide letter spacing, pale silver, razor-sharp edges. Supporting text in small light grey capitals.',
  },
  {
    id: 'business-now-hiring', name: 'Open Office', category: 'business',
    scene: 'Bright open-plan office at midday, tall windows, oak desks, potted greenery, a friendly mixed team mid-conversation. White, warm oak and soft sage green, airy daylight, pastel grade, low contrast, clean digital.',
    lettering: 'Main title in friendly rounded bold sans-serif capitals in coral, thick even strokes, no effects. Supporting text in medium-weight rounded sans, charcoal.',
  },
  {
    id: 'business-desk-flatlay', name: 'Desk Flat Lay', category: 'business',
    scene: 'Overhead flat-lay on a linen-covered desk: blank cream paper, a brass fountain pen, folded reading glasses, a small espresso cup, one dried eucalyptus sprig. Soft diffused window light, sand and ivory palette, matte paper texture.',
    lettering: 'Main title in fine-weight letterspaced capitals, ink black, quietly refined. Supporting text in small caps with a thin hairline rule feel and generous spacing.',
  },
  {
    id: 'business-awards-night', name: 'Awards Night', category: 'business',
    scene: 'Black-tie ballroom at night. Deep burgundy velvet drapes, round tables lit by candles, a narrow warm spotlight falling on an empty stage step. Low-key moody light, deep shadow, burgundy, brass and near-black, glossy finish.',
    lettering: 'Main title in engraved classical serif capitals with a brushed-gold foil fill and a fine inner shadow. Supporting text in small spaced serif capitals, cream.',
  },
  {
    id: 'business-webinar-live', name: 'Live Stream', category: 'business',
    scene: 'Night home studio: a tidy desk, ring light on a face turned to camera, monitor glow washing the wall, teal and magenta LED strip behind. Dark room, high contrast, slight lens bloom, clean digital, modern tech mood.',
    lettering: 'Main title in tight geometric sans capitals with a soft cyan neon glow and a thin magenta edge. Supporting text in condensed uppercase, cool white.',
  },
  {
    id: 'business-industry', name: 'Industry', category: 'business',
    scene: 'Working warehouse at midday, wide environmental lens. Concrete floor, steel racking, stacked pallets and a forklift, hard shafts of daylight through high windows with dust in the beams. Concrete grey, safety orange, gunmetal, documentary grade.',
    lettering: 'Main title in heavy condensed stencil capitals with a slight ink-spread edge, safety orange. Supporting text in blocky uppercase sans, gunmetal grey.',
  },
  {
    id: 'business-riso-summit', name: 'Riso Print', category: 'business',
    scene: 'Two-colour riso print on oatmeal paper. Flat simplified figures around a long table under pendant lamps, printed in fluorescent coral and deep teal, ink slightly misregistered, visible paper tooth, grainy screen texture, matte finish.',
    lettering: 'Main title in chunky geometric sans capitals printed in fluorescent coral with a teal offset shadow a millimetre off, ink mottling and soft edges. Support text in small typewriter mono.',
  },
  {
    id: 'business-woodtype-hiring', name: 'Wood Type', category: 'business',
    scene: 'Letterpress broadside on thick cotton stock. Carved wood ornaments, thick rules and pointing-hand cuts in oxblood red and coal black, deep bite pressing into cream paper, ink slightly starved at the edges, 1890s print-shop feel.',
    lettering: 'Enormous vintage wood-type capitals mixing slab and fat-face at different sizes, oxblood and black, ink-starved with visible wood grain and a debossed impression.',
  },
  {
    id: 'business-collage-network', name: 'Cut Paper', category: 'business',
    scene: 'Cut-paper collage. Torn and scissor-cut shapes of a mingling crowd holding glasses, built from mustard, sage, terracotta and sky-blue construction paper on off-white, soft real drop shadows under each layer, handmade matte craft finish.',
    lettering: 'Title hand-cut from paper in soft rounded capitals with slightly wobbly scissor edges, casting a small shadow. Secondary text in neat handwritten pencil.',
  },
  {
    id: 'business-midcentury-awards', name: 'Retro Poster', category: 'business',
    scene: 'Mid-century lithograph poster. Stylised figures in evening dress beside a ribboned trophy shape, flat planes of champagne gold, ink navy and warm ivory, limited spot colours, fine texture speckle, elegant 1959 travel-poster mood, matte litho finish.',
    lettering: 'Elegant high-contrast modern serif capitals in champagne gold, wide letterspacing, hairline thin strokes, printed flat with a faint litho speckle.',
  },
  {
    id: 'business-blueprint-consult', name: 'Blueprint', category: 'business',
    scene: 'Technical drafting on blueprint paper. White ink line drawing of gears, node diagrams and a rising bar chart over Prussian blue ground, faint grid, dimension arrows and compass arcs, cool and precise, flat drafting-paper finish.',
    lettering: 'Title in white drafting stencil capitals, thin uniform strokes, wide tracking, with a fine underline rule. Support text in small engineer hand-lettering.',
  },
  {
    id: 'business-embroidery-team', name: 'Team Patch', category: 'business',
    scene: 'Embroidered patch on heather-grey wool felt. Satin-stitch handshake and pennant motifs in forest green, cream and burnt orange, visible thread direction, raised merrowed border, chain-stitch details, tactile craft look, soft studio light.',
    lettering: 'Title in thick satin-stitch script with raised glossy thread and visible needle direction, edged in cream chain stitch. Smaller words in flat cross-stitch capitals.',
  },
  {
    id: 'business-halftone-webinar', name: 'Comic Panel', category: 'business',
    scene: 'Halftone comic-book panel. Bold black ink outlines of a presenter gesturing at a chart, exaggerated perspective, benday dot shading in cyan and hot pink over yellow, speed lines and a starburst, pulpy 1960s newsprint texture.',
    lettering: 'Title in inflated comic capitals with a thick black outline, yellow fill and a hot-pink drop shadow, slight tilt and a hand-inked wobble.',
  },
  {
    id: 'business-swiss-grid', name: 'Swiss Grid', category: 'business',
    scene: 'International-style graphic panel. Flat warm white paper field divided by a strict column grid of hairline black rules, one saturated vermilion rectangle anchoring the lower third, a single thin diagonal bar, generous empty space, even flat light, matte print finish.',
    lettering: 'Main title in tight lowercase grotesque sans, medium weight, very close letterspacing, flush left, flat black. Supporting text small, same family, light weight, wide tracking.',
  },
  {
    id: 'business-glass-stack', name: 'Glass Panels', category: 'business',
    scene: 'Frosted glass panels floating over a pale ice-blue to mint gradient, soft blurred lavender and peach light blooms behind them, hairline white panel edges, gentle inner glow, light drop shadows, bright airy ambient light, smooth digital sheen.',
    lettering: 'Main title in clean geometric sans, semi-bold, pure white with a faint outer glow. Supporting text light weight, translucent white, wide even tracking.',
  },
  {
    id: 'business-concrete', name: 'Concrete', category: 'business',
    scene: 'Brutalist poster surface. Raw concrete grey ground with photocopy grain and toner speckle, oversized solid black rectangles butted edge to edge, one acid-yellow block off-centre, thick heavy borders, harsh flat scanner light, deliberately crude and unpolished.',
    lettering: 'Main title in extremely heavy condensed capitals cropped tight to the block, black on yellow, with xerox degradation on the edges. Supporting text in small typewriter mono.',
  },
  {
    id: 'business-deco-brass', name: 'Deco Brass', category: 'business',
    scene: 'Art-deco geometric panel. Deep midnight navy ground with symmetrical brass line fans, stepped ziggurat borders, thin concentric arcs and a fluted column motif, brushed-metal sheen on the gold, low warm side light, lacquered finish.',
    lettering: 'Main title in high-contrast deco capitals with hairline serifs and a brass gradient fill, letters widely spaced. Supporting text in small engraved capitals between thin gold rules.',
  },
  {
    id: 'business-soft-clay', name: 'Soft Clay', category: 'business',
    scene: 'Three-dimensional clay render. Rounded matte objects in pale mint, blush and cream floating on a soft beige backdrop, isometric arrangement of stacked blocks, tubes and discs, gentle studio light from upper left, long soft shadows, velvety no-gloss surfaces.',
    lettering: 'Main title in rounded geometric sans, bold, extruded as a soft matte three-dimensional solid in cream with the same clay shading. Supporting text flat, medium weight, warm grey.',
  },
  {
    id: 'business-service-call', name: 'On Call', category: 'business',
    scene: 'Bright suburban driveway at midday. A plain white work van with rear doors open, neat tool cases, coiled hose, a technician in clean navy workwear and hi-vis, sharp blue sky, green lawn edge, crisp commercial photography, high clarity, natural sun.',
    lettering: 'Main title in bold italic condensed sans capitals, royal blue with a thin white outline and a hard drop shadow. Supporting text in solid uppercase sans, safety yellow.',
  },
  {
    id: 'business-watercolour', name: 'Watercolour', category: 'business',
    scene: 'Loose watercolour on cold-pressed paper. Soft washes of blush, sage and ochre bleeding into each other, a faint pencil under-sketch of a handshake and a coffee cup showing through, granulating pigment, white paper breathing at the edges, gentle daylight.',
    lettering: 'Main title in flowing brush-lettered script with tapering wet strokes and pigment pooling at the ends. Supporting text in a small even hand-drawn serif, sepia.',
  },
  {
    id: 'sale-grand-opening', name: 'Grand Opening', category: 'sale',
    scene: 'Bright midday storefront on a city sidewalk. Clear blue sky, crisp white awning, a wide satin ribbon stretched across plain unmarked glass doors, paper confetti mid-air, potted geraniums on the step. Wide clean digital capture, high key, cherry-red and white.',
    lettering: 'Main title in tall rounded sans capitals, glossy cherry-red with a thin white keyline and a soft drop shadow. Supporting text in light grey sans-serif.',
  },
  {
    id: 'sale-flash-neon', name: 'Flash Deal', category: 'sale',
    scene: 'Rain-slick shopping street at night. Wet asphalt mirrors cyan and magenta neon tubes, steam curling from a grate, a shopper hurrying past with paper bags, moody low-key exposure, deep blacks, cinematic anamorphic flare, glossy reflective finish.',
    lettering: 'Main title in italic heavy sans capitals with a glowing magenta neon-tube outline and a slight motion-blur streak. Supporting text in thin cyan uppercase.',
  },
  {
    id: 'sale-warehouse-floor', name: 'Clearance Floor', category: 'sale',
    scene: 'Cavernous concrete warehouse at noon. Hard daylight shafts fall through roof skylights onto steel pallet racks, stacked unmarked cardboard cartons, a yellow forklift, safety-orange floor stripes. Wide industrial lens, high-contrast editorial, cool grey and orange, matte finish.',
    lettering: 'Main title in heavy stencil capitals, safety-orange with chipped paint edges and a hard black shadow. Supporting text in narrow grey uppercase sans.',
  },
  {
    id: 'sale-spring-pastel', name: 'Spring Savings', category: 'sale',
    scene: 'Early dawn boutique interior. Pale mint walls, peach morning light through sheer curtains, linen garments on a blond wood rail, tulips in a glass jar, dust motes drifting. Soft diffusion, low contrast, airy matte finish.',
    lettering: 'Main title in an airy high-waisted serif with fine hairlines, warm peach ink. Supporting text in widely letter-spaced light sans small capitals.',
  },
  {
    id: 'sale-market-day', name: 'Market Day', category: 'sale',
    scene: 'Open-air weekend market at mid-morning. Striped canvas awnings in red and cream, trestle tables of second-hand wares, wicker baskets, leafy trees behind, dust hanging in low golden sun. Sun-bleached film stock, soft grain, relaxed browsing crowd.',
    lettering: 'Main title in cheerful hand-painted brush capitals, cream with a leaf-green shadow and slight paint wobble. Supporting text in a friendly rounded sans.',
  },
  {
    id: 'sale-coupon-kraft', name: 'Coupon Clip', category: 'sale',
    scene: 'Tight macro on a kitchen table under a warm tungsten lamp. Kraft-paper tickets with perforated edges, steel scissors, a thumb smudge, visible paper fibre and torn corners, shallow depth of field, 35mm film grain, brown and faded-red.',
    lettering: 'Main title in chunky woodblock capitals with ink-bleed edges and slight letterpress deboss. Supporting text in a typewriter monospace, faded red.',
  },
  {
    id: 'sale-last-days', name: 'Last Days', category: 'sale',
    scene: 'Emptying shop interior at dusk. Bare hanging bulbs, half-stripped shelves, stacked wooden crates, one folding table left behind, long amber shadows across a dusty plank floor. Sepia-leaning film grain, moody warm low-key, soft vignette.',
    lettering: 'Main title in tall condensed slab capitals, chalk-white with dry brush texture and faint smudging. Supporting text in loose handwritten marker script.',
  },
  {
    id: 'sale-members-club', name: 'Members Only', category: 'sale',
    scene: 'Evening members lounge. Deep burgundy walls, walnut panelling, amber table lamps pooling light, oxblood leather armchairs, a relaxed well-dressed group mid-conversation. Portrait lens, shallow focus, rich low-key colour, editorial polish, soft sheen on leather.',
    lettering: 'Main title in an engraved high-contrast serif with fine copper-foil edges and a soft inner glow. Supporting text in cream small-caps sans, widely spaced.',
  },
  {
    id: 'sale-riso-pop', name: 'Riso Pop', category: 'sale',
    scene: 'Two-colour risograph print on off-white newsprint. Fluorescent orange and deep teal only, deliberately misregistered by a hair, coarse grain and roller smudge. Chunky simplified shopping bags, tags and thick arrows, flat matte ink finish.',
    lettering: 'Main title in fat rounded seventies capitals, printed orange with a teal offset shadow slipped sideways. Supporting text in small grainy mono type.',
  },
  {
    id: 'sale-wood-type', name: 'Letterpress', category: 'sale',
    scene: 'Letterpress broadside pressed into thick cream cotton stock. Ink in barn red and near-black, edges showing the bite of the press and the grain of the blocks, hairline rules and small pointing-hand cuts. Matte, slightly dented paper.',
    lettering: 'Main title in tall condensed slab-serif wood type, heavy and slightly uneven, with visible ink bite and worn edges. Supporting text in wide-spaced small caps.',
  },
  {
    id: 'sale-paper-cut', name: 'Paper Cutout', category: 'sale',
    scene: 'Cut-paper collage shot from above under hard raking light. Layered card in navy, rust, ochre and bone on a slate-grey ground, crisp scissor edges, thick cast shadows, simple paper tags, coins and a folded bag. Matte fibre texture.',
    lettering: 'Main title cut from card by hand, chunky rounded shapes in bone with visible scissor nicks and long hard shadows. Supporting text in neat lowercase sans.',
  },
  {
    id: 'sale-chalkboard', name: 'Chalk Board', category: 'sale',
    scene: 'Hand-drawn chalkboard, deep charcoal slate with faint eraser smears. White chalk line art of ribbons, laurels, arrows and a scalloped border, dusty accents in soft yellow and blush. Warm shop light from the left, powdery matte finish.',
    lettering: 'Main title hand-lettered in chalk: bouncy brush script with thick downstrokes, dusty edges and a doubled outline. Supporting text in narrow chalk capitals.',
  },
  {
    id: 'sale-blueprint', name: 'Cyanotype', category: 'sale',
    scene: 'Cyanotype blueprint sheet. Prussian-blue drafting paper with a faint white graph grid, precise white line drawings of boxes, tags, gears and dimension arrows, a coffee-ring stain in one corner, flat matte finish under even light.',
    lettering: 'Main title in drafting-stencil capitals, thin uniform white strokes with ticked corners and wide spacing. Supporting text in small white engineering monospace.',
  },
  {
    id: 'sale-comic-blast', name: 'Comic Blast', category: 'sale',
    scene: 'Vintage comic-book page in halftone. Loud primary red, cyan and yellow over visible Ben-Day dot screens, thick black ink outlines, speed lines and a jagged explosion burst. Slight off-register colour on yellowed newsprint, flat pulp finish.',
    lettering: 'Main title in bold italic comic capitals with thick black outline, white inline and a hard yellow drop shadow, tilted. Supporting text in hand-inked comic caps.',
  },
  {
    id: 'sale-stitched', name: 'Stitched Patch', category: 'sale',
    scene: 'Embroidered textile flat lay. Felt in oatmeal and denim blue with satin-stitch shapes in tomato red and cream, merrowed patch borders, French knots and a running-stitch frame. Soft raking daylight raises every thread, fuzzy matte finish.',
    lettering: 'Main title embroidered in raised satin-stitch varsity capitals with a chain-stitch outline. Supporting text in fine back-stitch lowercase, thread slightly uneven.',
  },
  {
    id: 'sale-swiss-grid', name: 'Red Block', category: 'sale',
    scene: 'Flat Swiss poster graphic. Pure white paper field, one enormous red rectangle anchored off-centre, thin black rule lines dividing a strict column grid, generous empty space, matte offset-print finish, cool even light, no photography.',
    lettering: 'Tight grotesque sans in black and red, flush left, very tight tracking, mixed light to extra-bold weights, no effects, crisp ink edges.',
  },
  {
    id: 'sale-clay-3d', name: 'Clay Pop', category: 'sale',
    scene: 'Soft 3D clay render. Rounded matte shapes in bubblegum pink, butter yellow and mint, floating balloons and thick chunky arrows, soft global-illumination light with gentle contact shadows on a pale peach backdrop, toy-like finish.',
    lettering: 'Chunky rounded 3D extruded letters in matte clay, soft bevelled corners, gentle drop shadow, cream face with a pink side wall.',
  },
  {
    id: 'sale-memphis', name: 'Memphis Pop', category: 'sale',
    scene: 'Postmodern Memphis graphic. Cream background scattered with squiggles, confetti triangles and black-and-white checkerboard strips in tomato red, cobalt and turmeric yellow, playful asymmetry, flat vector finish, bright even daylight.',
    lettering: 'Fat geometric sans capitals in cobalt with a tomato-red offset shadow layer, slight tilt, dotted halftone infill on select letters.',
  },
  {
    id: 'sale-glass-panel', name: 'Glass Panel', category: 'sale',
    scene: 'Glassmorphism graphic. Frosted translucent rounded panels stacked over a blurred violet-to-teal gradient mesh, faint white edge highlights, soft light leaks, tiny floating spheres, airy weightless mood, polished digital finish.',
    lettering: 'Thin-to-medium geometric sans in white, slight letter-spacing, soft glass blur behind, delicate hairline underline, subtle inner glow.',
  },
  {
    id: 'sale-brutalist', name: 'Brutal Tape', category: 'sale',
    scene: 'Brutalist photocopy poster. Raw concrete-grey field with heavy toner grain, black boxed borders, safety-orange highlight bars, torn tape strips, hard flat shadows, deliberately crude spacing, matte xerox finish under flat light.',
    lettering: 'Oversized monospace mixed with heavy grotesque, black on orange highlight blocks, underlined, some letters knocked out of solid boxes, rough toner edges.',
  },
  {
    id: 'sale-deco-lines', name: 'Platinum Deco', category: 'sale',
    scene: 'Art-deco geometric graphic. Midnight-navy field with fine platinum sunburst rays, stepped fan arches and slim concentric circles, strict symmetry, soft directional sheen across the metal lines, velvet matte ground, 1920s printed-poster finish.',
    lettering: 'High-waisted deco display capitals in brushed platinum with thin inline stripes, wide letter spacing, small hairline serifs, subtle cool sheen.',
  },
  {
    id: 'food-late-night-diner', name: 'Late Night Diner', category: 'food',
    scene: 'Roadside diner booth after midnight. Rain-slick asphalt outside, magenta and cyan neon tubing reflecting off chrome trim and glass, a stacked burger and fries under hard tabletop light, deep blue shadows, high-contrast photography, wet glossy finish.',
    lettering: 'Main title in glowing neon-tube script with a soft pink halo and thin cyan outline. Supporting text in tight condensed uppercase sans-serif.',
  },
  {
    id: 'food-morning-bakery', name: 'Morning Bakery', category: 'food',
    scene: 'Bakery bench at first light. Flour dust drifting through a low dawn sunbeam, torn sourdough crust and butter croissants on scorched steel trays, oat, cream and burnt caramel palette, tight macro lens, warm 35mm film grain, matte finish.',
    lettering: 'Main title in a warm hand-drawn serif with slightly uneven ink weight and soft edges. Supporting text in letterspaced small capitals, thin sans-serif.',
  },
  {
    id: 'food-brunch-table', name: 'Brunch Table', category: 'food',
    scene: 'Overhead brunch spread on pale marble at midday. Poached eggs, halved avocado, berries, iced glasses, linen napkin and brass cutlery, soft diffused window daylight, pastel mint and blush palette, clean flat-lay, airy bright finish.',
    lettering: 'Main title in a light modern serif with high-contrast thick-thin strokes and generous letterspacing. Supporting text in hairline sans-serif capitals.',
  },
  {
    id: 'food-smokehouse', name: 'Smokehouse', category: 'food',
    scene: 'Barbecue pit at dusk. Thick woodsmoke lit orange by open coals, glistening bark on brisket and ribs, blackened steel grates, embers rising, charcoal-black and ember-orange palette, wide environmental lens, moody low-key contrast, rich matte finish.',
    lettering: 'Main title in heavy rough-cut carved wooden capitals with charred edges and a burnt orange inner glow. Supporting text in sturdy slab-serif, all caps.',
  },
  {
    id: 'food-coffee-house', name: 'Coffee House', category: 'food',
    scene: 'Small coffee bar on a rainy evening. Warm tungsten lamplight on brass and dark walnut, steam curling off a poured flat white, fogged window and blurred street lights beyond, espresso-brown and honey palette, portrait lens, soft cinematic low-key finish.',
    lettering: 'Main title in a rounded lowercase script with a smooth painted finish and gentle drop shadow. Supporting text in friendly geometric sans-serif, medium weight.',
  },
  {
    id: 'food-market-fresh', name: 'Market Fresh', category: 'food',
    scene: 'Open-air produce market at high noon. Crates of tomatoes, lemons, chard and radishes under crisp white sunlight, striped canvas awnings, woven baskets and worn wooden stalls, saturated green-red-yellow palette, wide editorial lens, sharp digital, punchy contrast.',
    lettering: 'Main title in bold rounded sans-serif capitals with a thick white outline and flat colour fill. Supporting text in wide-tracked uppercase sans-serif.',
  },
  {
    id: 'food-wine-cellar', name: 'Wine Cellar', category: 'food',
    scene: 'Stone wine cellar at night. Candle flames on a dark oak table, poured red glasses catching the light, aged barrels and damp limestone walls in shadow, burgundy, slate and antique gold palette, portrait lens, deep chiaroscuro, painterly low-light finish.',
    lettering: 'Main title in an elegant engraved serif with fine hairline flourishes and a soft antique gold foil sheen. Supporting text in small letterspaced roman capitals.',
  },
  {
    id: 'food-sushi-slate', name: 'Sushi Minimal', category: 'food',
    scene: 'Quiet Japanese counter. Charcoal slate stone, a single bare branch, ash grey and warm oatmeal tones with one vermilion accent, sliced fish and rice set with wide empty space, soft even overhead light, ink-wash restraint, matte fine-art finish.',
    lettering: 'Main title in fine vertical-stroke brush characters with dry-bristle texture and tapering ends. Supporting text in very light widely spaced sans-serif capitals.',
  },
  {
    id: 'food-seafood-shack', name: 'Seafood Shack', category: 'food',
    scene: 'Coastal seafood counter at midday. Crushed ice glittering under bright sea light, prawns, oysters and lemon halves, blue-and-white checked cloth, weathered pale timber, sea-glass blue and chalk white palette, crisp daylight, cool clean bright finish.',
    lettering: 'Main title in hand-painted signwriter capitals with a rope-twist inline and a navy shadow. Supporting text in a jaunty condensed serif with small painted swash tails.',
  },
  {
    id: 'food-riso-pizza', name: 'Pizza Night', category: 'food',
    scene: 'Two-colour riso print. Fluorescent pink and warm orange ink on rough off-white paper, a hand tossing dough and a wedge of pizza drawn in loose outlines, visible ink misregistration, grainy paper texture, matte unvarnished finish.',
    lettering: 'Main title in chunky rounded sans capitals printed in fluorescent pink with a deliberately misregistered orange offset shadow. Supporting text in small typewriter mono.',
  },
  {
    id: 'food-woodtype-bbq', name: 'BBQ Broadside', category: 'food',
    scene: 'Letterpress broadside on thick cotton stock. Antique wood-type ornaments, a hog and a smoking grill inked in soot black and brick red, deep visible bite into the paper, cream ground, flecked ink and worn edges, matte tactile finish.',
    lettering: 'Main title in tall condensed slab wood type, ink-heavy with worn broken edges and deep press impression. Supporting text in narrow Victorian gothic capitals.',
  },
  {
    id: 'food-watercolour-brunch', name: 'Watercolour Brunch', category: 'food',
    scene: 'Loose watercolour illustration. Soft peach, butter yellow and sage washes on cold-press paper, a table of poached eggs, pastries and a jug of juice painted with bleeding edges and bare white paper gaps, pale morning light, airy matte finish.',
    lettering: 'Main title in a fluid brush script with wet tapering strokes and slight pigment pooling. Supporting text in a light hand-lettered serif with irregular spacing.',
  },
  {
    id: 'food-chalkboard-coffee', name: 'Chalkboard Cafe', category: 'food',
    scene: 'Hand-drawn chalkboard. Matte black slate ground with white and pale mint chalk drawings of a pour-over cone, beans and steam curls, smudged eraser ghosts, dusty flourishes and blank ribbon banners, low warm cafe light, powdery chalk finish.',
    lettering: 'Main title in ornate chalk script with thick-and-thin strokes and a doubled outline. Supporting text in blocky chalk capitals with sketchy hatched shading.',
  },
  {
    id: 'food-halftone-burger', name: 'Comic Burger', category: 'food',
    scene: 'Halftone comic panel art. Bold black ink outlines with visible dot shading in cherry red, teal and mustard on newsprint-yellow paper, a stacked burger and milkshake drawn with speed lines and starbursts, flat pulp-print finish.',
    lettering: 'Main title in inflated comic-book capitals with a thick black outline, dot-shaded fill and a hard offset drop shadow. Supporting text in inked comic hand lettering.',
  },
  {
    id: 'food-tile-tapas', name: 'Tile Tapas', category: 'food',
    scene: 'Painted ceramic tile panel. Cobalt blue and white glazed tiles with hand-painted olives, lemons and small plates, ochre and terracotta accents, grout lines dividing the panel, glossy fired glaze catching soft reflected light.',
    lettering: 'Main title hand-painted in cobalt brush capitals with slight glaze bleed at the stroke ends. Supporting text in a small painted serif with painterly imperfections.',
  },
  {
    id: 'food-swiss-grid', name: 'Menu Grid', category: 'food',
    scene: 'Swiss International poster design. Flat white paper field split by a strict modular grid, one enormous scarlet rectangle, thin black rules, a single cropped duotone photograph of coffee and citrus, no gradients, no shadow, matte offset flatness, cool neutral daylight.',
    lettering: 'Main title in tight lowercase grotesque sans, heavy weight, very close letter spacing. Supporting text small and light with generous leading, pure black on white.',
  },
  {
    id: 'food-deco-supper', name: 'Deco Supper', category: 'food',
    scene: 'Art-deco geometry. Deep emerald and oxblood panels, fanned sunburst arcs and stepped chevrons in brushed brass, thin gold pinstripe borders, symmetrical mirrored composition, lacquered black ground, soft theatrical glow, luxurious enamel-and-metal finish.',
    lettering: 'Main title in high-contrast deco capitals with hairline serifs, wide letter spacing and a gold foil finish carrying a fine engraved inline stripe. Supporting text in small spaced capitals.',
  },
  {
    id: 'food-memphis-pop', name: 'Sprinkle Pop', category: 'food',
    scene: 'Memphis postmodern playground. Sherbet pink, cyan, lemon and grape blocks, squiggles, confetti dashes and terrazzo speckle, tilted checkerboard bands, hard drop shadows, no depth, joyful chaotic balance, flat vinyl-sticker finish.',
    lettering: 'Main title in chunky rounded bouncy capitals, each letter slightly rotated, filled candy yellow and offset by a thick violet shadow. Supporting text in playful wide sans-serif.',
  },
  {
    id: 'food-clay-3d', name: 'Clay Kitchen', category: 'food',
    scene: 'Soft 3D clay render. Matte pastel putty shapes on a warm sand backdrop, rounded utensils, bowls and cups modelled in dough-like material, gentle studio key light, long soft shadows, subtle ambient occlusion, tactile toy-like plasticine finish.',
    lettering: 'Main title as extruded rounded 3D letters in matte pastel clay with thick soft-cornered strokes, gentle top light and a soft contact shadow. Supporting text in small rounded sans-serif.',
  },
  {
    id: 'food-paper-feast', name: 'Paper Feast', category: 'food',
    scene: 'Maximalist cut-paper collage. Torn magazine scraps, halftone newsprint fragments and sepia clippings layered over hot coral and mustard blocks, snipped scalloped edges, visible tape and staple marks, dense busy layering, tactile scrapbook finish.',
    lettering: 'Main title in mismatched ransom-note capitals cut from different papers, varying sizes and baselines, some inked by hand. Supporting text in typewriter face on a paper strip.',
  },
  {
    id: 'food-icecream-sun', name: 'Ice Cream Day', category: 'food',
    scene: 'Summer ice-cream stop in blazing afternoon sun. Turquoise painted wall, hard-edged shadows, dripping cones and sprinkles held up against a deep blue sky, sherbet coral and mint accents, saturated slide-film colour, glossy high-key photography.',
    lettering: 'Main title in fat glossy bubble capitals with a white highlight streak, thick cream outline and a hard turquoise cast shadow. Supporting text in bold rounded sans-serif.',
  },
  {
    id: 'services-dawn-yard', name: 'Dawn Yard', category: 'services',
    scene: 'First light over a freshly cut suburban lawn. Wet grass, long low shadows, mist hanging at the hedge line, striped mowing lines curving away. Wide environmental photograph, dew-green and pale gold, clean digital capture, crisp and calm.',
    lettering: 'Main title in rounded heavy sans capitals, matte white with a soft drop shadow. Supporting text in a light humanist sans, generously letterspaced.',
  },
  {
    id: 'services-night-call', name: 'Night Call', category: 'services',
    scene: 'Emergency call-out after dark. A work van\'s open rear doors spill amber light across wet asphalt, a headlamp beam cutting through drizzle, tools glinting on the tailgate. Deep navy blacks with amber and cold blue reflections, moody low-key cinematic photography.',
    lettering: 'Main title in bold condensed capitals, glowing amber with a subtle outer glow. Supporting text in clean uppercase sans, cool light grey.',
  },
  {
    id: 'services-bright-clean', name: 'Bright Clean', category: 'services',
    scene: 'Sunlit empty room mid-morning. Bare windows, glossy pale floorboards, a bucket and folded cloths, dust motes drifting in a hard shaft of sun. High-key white, sky blue and lemon, clean digital photograph, airy blown-out edges.',
    lettering: 'Main title in geometric bold sans capitals, sky blue with a crisp white keyline. Supporting text in medium-weight sans, tight and tidy.',
  },
  {
    id: 'services-tool-bench', name: 'Tool Bench', category: 'services',
    scene: 'Overhead flat-lay on a scarred walnut workbench. Wrenches, a torque driver, coiled cable, a stripped-open small appliance, brass screws in a tin. Single low lamp from one side, espresso brown with steel grey and oxblood, warm film grain.',
    lettering: 'Main title in industrial slab-serif capitals, cream with a lightly worn stencil edge. Supporting text in monospaced uppercase, small and precise.',
  },
  {
    id: 'services-porch-groom', name: 'Porch Groomer', category: 'services',
    scene: 'Late afternoon on a wooden porch. A groomer kneels with a fluffy dog mid-brush, golden backlight flaring through a screen door, chipped mint paint, terracotta pots. Cream, dusty rose and sun-gold, portrait lens with creamy blur, warm film grain.',
    lettering: 'Main title in a friendly handwritten script with natural ink weight and a slight upward lilt. Supporting text in a soft rounded sans, sentence case.',
  },
  {
    id: 'services-roof-dusk', name: 'Roof Dusk', category: 'services',
    scene: 'Drone view over a shingled roofline at dusk. Crew silhouettes on the ridge, an extension ladder against the eave, violet and burnt-orange sky behind bare trees. Slate grey and charcoal against fiery sky, high-contrast editorial photography, sharp and dramatic.',
    lettering: 'Main title in tall extended sans capitals, chalk white with a hard black offset shadow. Supporting text in thin uppercase sans, strictly aligned.',
  },
  {
    id: 'services-marble-desk', name: 'Marble Desk', category: 'services',
    scene: 'Corner of a polished white marble desk in a quiet office. A brass fountain pen, folded reading glasses, a navy suit cuff resting at the edge, a stack of plain paper. Cool north-window daylight, grey-white with navy and brass, sharp editorial photograph.',
    lettering: 'Main title in a stately transitional serif with fine bracketed serifs, deep navy. Supporting text in small-cap sans, widely tracked and understated.',
  },
  {
    id: 'services-riso-yard', name: 'Riso Yard', category: 'services',
    scene: 'Two-colour riso screen print of a trimmed lawn, hedge and pruned tree, printed in fluorescent green and warm ink-blue on oatmeal paper. Visible misregistration, grainy ink texture, flat daylight, no shading, matte uncoated finish.',
    lettering: 'Main title in chunky rounded geometric sans capitals printed in fluorescent green ink, slightly off-register with a soft blue ghost edge. Supporting text in small clean sans.',
  },
  {
    id: 'services-press-sheet', name: 'Workshop Press', category: 'services',
    scene: 'Letterpress broadside on thick cotton stock with a deep bite into the paper. Pipe wrenches, a spirit level and hand tools inked in indigo and coal black, plus rule lines and printer\'s ornaments. Ink smudge, visible fibre, tactile debossed finish.',
    lettering: 'Main title in tall wooden slab-serif capitals with visible ink squeeze and worn broken edges, pressed deep into the sheet. Supporting text in narrow spurred grotesque.',
  },
  {
    id: 'services-comic-garage', name: 'Comic Garage', category: 'services',
    scene: 'Halftone comic-book panel art of a car on a lift and a gloved hand gripping a socket wrench, drawn in heavy black ink outlines with visible Ben-Day dot shading, printed in cyan, hot red and yellow on newsprint. Action speed lines, bold flat colour.',
    lettering: 'Main title in bold slanted comic capitals with a thick black outline, yellow fill and a hard offset red drop shadow, like a sound-effect burst.',
  },
  {
    id: 'services-watercolour', name: 'Soft Watercolour', category: 'services',
    scene: 'Loose watercolour illustration on cold-press paper: a tidy kitchen corner with a kettle, a jug of cut flowers and a linen cloth. Wet washes of teal, lemon and lavender bleeding at the edges, pencil underdrawing showing, wide white space, matte paper.',
    lettering: 'Main title in a flowing hand-painted brush script with dry-brush tails and translucent pigment bleed. Supporting text in a light airy serif, widely letterspaced.',
  },
  {
    id: 'services-paper-cut', name: 'Teal Cutout', category: 'services',
    scene: 'Cut-paper collage on a deep teal ground built from matte coloured card: a ladder, a broom, a watering can and a simple gabled house in terracotta, navy, ochre and blush, torn edges visible, small shadows between layers. Even soft studio light, craft-paper texture.',
    lettering: 'Main title in friendly rounded sans capitals cut from ochre card, each letter slightly tilted with a soft paper shadow beneath. Supporting text in plain thin sans.',
  },
  {
    id: 'services-woodcut', name: 'Old Woodcut', category: 'services',
    scene: 'Antique woodcut engraving in black ink on aged ivory paper: a straight razor, shaving brush, comb and scissors arranged with cross-hatched shading and fine parallel line work. Ornamental hairline border, faded sepia stain, dry matte finish.',
    lettering: 'Main title in engraved high-contrast didone capitals with fine hairline serifs and a delicate inline groove. Supporting text in small caps with wide tracking.',
  },
  {
    id: 'services-tile-panel', name: 'Tile Pattern', category: 'services',
    scene: 'Hand-painted ceramic tile panel in the Portuguese manner: glazed square tiles in cobalt blue on white, painted with scrolling vines, lotus blooms and a bathing bird, framed by a repeating border. Glossy glaze highlights, faint crazing, cool even light.',
    lettering: 'Main title in painted blue brush-drawn serif capitals following the glaze, with slight bleed into the ceramic and a wet glossy sheen. Supporting text in hand-painted italics.',
  },
  {
    id: 'services-swiss-grid', name: 'Crimson Bar', category: 'services',
    scene: 'Flat International-style poster. Cool paper-white ground, one thick crimson horizontal bar, thin black rules dividing a strict column grid, generous empty space, a single small black circle as accent. Even diffuse light, matte print finish, calm and exact.',
    lettering: 'Neo-grotesque sans in tight ranged-left blocks, medium weight for body copy, one heavy black setting for the headline, crisp matte, no effects at all.',
  },
  {
    id: 'services-clay-3d', name: 'Soft 3D', category: 'services',
    scene: 'Clay-render composition. Rounded matte shapes floating on a warm peach backdrop, a chunky wrench, spray bottle and paint roller modelled in putty-like plastic, soft studio light from upper left, gentle long shadows, velvety no-gloss finish.',
    lettering: 'Rounded geometric sans extruded in soft-plastic 3D with a matte clay surface, thick friendly weight, subtle contact shadow beneath each letter.',
  },
  {
    id: 'services-neon-dark', name: 'Neon Night', category: 'services',
    scene: 'Dark graphic panel. Near-black charcoal ground, glowing electric-cyan and hot-magenta outline shapes drawn in thin light strokes, soft bloom haze around every line, wet-glass reflection along the lower edge, cool, technical and luminous.',
    lettering: 'Thin uppercase sans drawn as glowing tube outlines in cyan with a magenta secondary glow, wide letterspacing and faint halo bleed.',
  },
  {
    id: 'services-memphis-pop', name: 'Pop Shapes', category: 'services',
    scene: 'Postmodern pattern field. Mint, tangerine and cobalt confetti shapes — squiggles, checkerboards, zigzags and dots — scattered on cream, flat vector fills, one oversized off-kilter triangle, playful and busy, screen-print texture, flat even light.',
    lettering: 'Chunky bouncy sans with an alternating baseline, flat two-tone offset fill in cobalt and tangerine, thick black outline.',
  },
  {
    id: 'services-deco-lines', name: 'Brass Deco', category: 'services',
    scene: 'Art-deco geometry. Deep forest green ground with fine brass line inlay, fanned sunburst arcs, stepped ziggurat frames and slender fluted columns, symmetrical composition, warm low-angle glow on metal, lacquered satin finish, elegant and formal.',
    lettering: 'High-waisted deco capitals with a thin brass inline stripe, sharp geometric spurs, tight tracking and a satin metallic sheen.',
  },
  {
    id: 'services-glass-panel', name: 'Frosted Glass', category: 'services',
    scene: 'Glassmorphism composition. A blurred aqua-to-violet gradient mesh behind translucent frosted rectangles with hairline white edges, soft coloured light bleeding through the panels, faint noise grain, floating depth, airy modern digital finish.',
    lettering: 'Light-weight geometric sans in semi-transparent white with a fine bright edge highlight, wide spacing and a soft outer glow.',
  },
  {
    id: 'services-brutal-block', name: 'Bold Blocks', category: 'services',
    scene: 'Brutalist colour blocking. A raw concrete-grey field split by hard rectangles of safety yellow and ink black, thick offset drop shadows, exposed registration marks, coarse halftone dots, harsh flat light, unpolished photocopy finish.',
    lettering: 'Ultra-heavy condensed capitals in ink black with a hard yellow offset shadow and slight photocopy roughness eating the edges.',
  },
  {
    id: 'realestate-just-sold', name: 'Just Sold', category: 'realestate',
    scene: 'Midday suburban front lawn under a bright blue sky. Crisp white siding, emerald grass, a red front door, wide environmental lens, clean digital capture, hard noon sun with sharp shadows, saturated and cheerful.',
    lettering: 'Main title in heavy rounded sans capitals, flat white with a thick emerald outline and a hard offset shadow. Secondary text in tight uppercase sans.',
  },
  {
    id: 'realestate-apartments', name: 'Apartment Living', category: 'realestate',
    scene: 'Dusk at a modern apartment courtyard. Lit turquoise pool water, palms, string bulbs, coral and lavender sky, residents lounging, soft pastel grade, gentle haze, low-contrast dreamy finish, eye-level medium lens.',
    lettering: 'Main title in light geometric sans with wide letter spacing, soft coral-to-lavender gradient fill. Supporting text in thin uppercase with hairline rules.',
  },
  {
    id: 'realestate-commercial', name: 'Commercial Space', category: 'realestate',
    scene: 'Dawn drone view over a glass and steel office block, empty parking decks, cold blue mist between towers, graphite concrete, a thin gold sunrise line on the horizon, high-contrast editorial grade, sharp architectural detail.',
    lettering: 'Main title in tall narrow serif capitals, ice-white with fine hairline strokes. Supporting text in small letterspaced grey sans.',
  },
  {
    id: 'realestate-first-home', name: 'First Home', category: 'realestate',
    scene: 'Evening interior lit by one table lamp. Cardboard moving boxes, two people sitting on bare floorboards with takeaway cups, amber glow, cream walls, warm film grain, shallow depth of field, cosy and quiet.',
    lettering: 'Main title in a friendly handwritten script with slightly uneven strokes in warm cream. Supporting text in small humanist sans, lowercase.',
  },
  {
    id: 'realestate-investment', name: 'Investment Deal', category: 'realestate',
    scene: 'Overhead flat-lay on a dark walnut desk. Brass keys, a folded blueprint, reading glasses, a leather notebook and a coffee cup, moody low-key side light, deep shadows, muted browns and brass, matte editorial finish.',
    lettering: 'Main title in refined serif capitals with high thick-thin contrast and a brushed brass foil finish. Supporting text in small caps with wide tracking.',
  },
  {
    id: 'realestate-lending', name: 'Home Loans', category: 'realestate',
    scene: 'Early morning kitchen with a large window. Sheer curtains diffusing pale sunlight, sage cabinetry, white marble counter, a mug and loose paperwork, airy clean digital capture, soft shadows, calm and reassuring, light and bright.',
    lettering: 'Main title in medium-weight grotesque sans, deep ink navy, generous spacing and clean flat edges. Supporting text in the same family at light weight.',
  },
  {
    id: 'realestate-staging', name: 'Staged & Styled', category: 'realestate',
    scene: 'Overcast midday light through tall windows. Tight macro of a styled living-room vignette: linen cushion weave, dried stems in a stoneware vase, plaster wall, greige and bone palette, muted matte grade, soft directional shadow.',
    lettering: 'Main title in elegant thin italic serif, warm taupe, with a delicate underline. Supporting text in tiny widely tracked uppercase sans.',
  },
  {
    id: 'realestate-rent-ready', name: 'Rent Ready', category: 'realestate',
    scene: 'Two-colour risograph print. Burnt orange and navy ink on oatmeal stock, coarse halftone dots, deliberate misregistration, blocky cut-paper rooftops and stair shapes, visible paper tooth, flat matte zine finish.',
    lettering: 'Heavy slab-serif capitals in navy with an orange ink offset behind, halftone speckle showing through the letterforms, small typewriter-style caption text.',
  },
  {
    id: 'realestate-retro-apartments', name: 'Retro Apartments', category: 'realestate',
    scene: 'Mid-century lithograph travel poster of an apartment community: stacked balconies, kidney-shaped pool, palm fronds, long flat sun shadows. Mustard, sky blue, cream and burnt orange, screened flat colour, faint press texture, optimistic 1950s calm.',
    lettering: 'Main title in wide extended mid-century capitals, burnt orange with a thin cream inline stripe down each stroke. Supporting text in light italic sans.',
  },
  {
    id: 'realestate-paper-house', name: 'Paper House', category: 'realestate',
    scene: 'Cut-paper collage of a small starter house built from layered construction paper, felt lawn, torn-edge clouds and a paper key, real drop shadows between layers, sage, butter yellow and blush, bright even studio light.',
    lettering: 'Main title cut from thick paper with visible scissor edges and a soft layered shadow. Supporting text in a friendly handwritten marker script.',
  },
  {
    id: 'realestate-engraved-office', name: 'Engraved Office', category: 'realestate',
    scene: 'Fine-line copperplate engraving of a brick and glass commercial building, dense crosshatch and stipple, sepia-black ink on ivory laid paper, thin ruled border, cool restrained finish like an old stock certificate.',
    lettering: 'Main title in engraved high-contrast serif capitals with hairline flourishes and fine crosshatch shading. Supporting text in small letterspaced roman caps.',
  },
  {
    id: 'realestate-watercolour-home', name: 'Watercolour Home', category: 'realestate',
    scene: 'Loose watercolour and ink illustration of a styled living room: linen sofa, ceramic vase with eucalyptus, sunlit rug, washes bleeding past pencil outlines, blush and sage, white paper breathing through, gentle morning light.',
    lettering: 'Main title in an elegant thin-stroke script with damp brushy edges. Supporting text in a small airy serif with generous letterspacing.',
  },
  {
    id: 'realestate-letterpress-deal', name: 'Letterpress Deal', category: 'realestate',
    scene: 'Letterpress broadside on thick cotton paper: a row of duplex rooftops and chimneys carved as a wood-block silhouette, oxblood red and charcoal ink, heavy plate impression denting the sheet, ruled ornament borders, no gloss.',
    lettering: 'Main title in giant slab wood-type capitals, ink-starved and mottled, pressed deep into the sheet. Supporting text in condensed gothic caps on ruled lines.',
  },
  {
    id: 'realestate-comic-loans', name: 'Comic Loans', category: 'realestate',
    scene: 'Retro halftone comic panel: a cheerful buyer shaking hands across a lender\'s desk, thick black outlines, benday dot shading, primary red, yellow and blue, radiating speed lines behind, newsprint yellowing, off-register dots.',
    lettering: 'Main title in bouncy bold comic capitals with a thick black outline, yellow fill and a hard drop shadow. Supporting text in inked comic caps.',
  },
  {
    id: 'realestate-sold-grid', name: 'Sold Grid', category: 'realestate',
    scene: 'Swiss international poster. Flat white paper, a strict column grid ruled in hairline black, one large scarlet rectangle and one small black square set low. No photograph, no texture, matte print, cool even studio light.',
    lettering: 'Titles in tight grotesque sans, all lowercase, flush left in tall stacked lines. Supporting text in small black caps with one word knocked out white.',
  },
  {
    id: 'realestate-deco-tower', name: 'Deco Tower', category: 'realestate',
    scene: 'Art-deco geometry. Stepped ziggurat arches and radiating sunburst fans in brushed brass and deep emerald over a midnight ink ground, thin gold rules, strictly symmetrical, soft warm sheen like an old elevator door.',
    lettering: 'Main title in tall narrow deco capitals with fine inline stripes down each stroke, brass gradient fill, wide letterspacing, thin gold rules above and below.',
  },
  {
    id: 'realestate-retro-shapes', name: 'Retro Shapes', category: 'realestate',
    scene: 'Memphis postmodern playground on cream. Bubblegum pink, lemon yellow, mint and cobalt shapes scattered loose: squiggles, dotted grids, striped triangles, floating circles. Flat 1980s vector, zero shading, cheerful and light, crisp matte finish.',
    lettering: 'Chunky rounded sans capitals in cobalt with a yellow drop shadow, each word on its own tilted baseline, small mint outline text beneath.',
  },
  {
    id: 'realestate-clay-keys', name: 'Clay Keys', category: 'realestate',
    scene: 'Soft 3D clay render. A pastel matte gable house, a rounded key and a small door arch modelled in putty peach, sage and cloud grey, floating on lavender with gentle shadow, diffuse studio light, velvety toy finish.',
    lettering: 'Rounded soft-edge sans in matte clay with the same putty finish as the shapes, gentle extrusion and a soft ambient shadow. Small clean grey caption text.',
  },
  {
    id: 'realestate-neon-rentals', name: 'Neon Rentals', category: 'realestate',
    scene: 'Neon on black. A wireframe skyline of glowing cyan and magenta lines over a dark grid horizon, purple haze, thin light streaks, chromatic glow bleeding into the black, high-gloss synthwave screen finish.',
    lettering: 'Main title in glowing tube-neon script with a magenta halo and a visible glass highlight. Supporting text in thin cyan uppercase with wide tracking.',
  },
  {
    id: 'realestate-glass-panels', name: 'Indigo Glass', category: 'realestate',
    scene: 'Frosted translucent panels with soft white borders floating on a smooth indigo-to-teal gradient blur, faint blurred spheres behind, cool diffused light, weightless high-end app-screen polish, glossy and edgeless.',
    lettering: 'Clean geometric sans in white, semibold title over light supporting lines, slight frosted transparency and a faint soft glow at the edges.',
  },
  {
    id: 'realestate-new-build', name: 'New Build', category: 'realestate',
    scene: 'Cyanotype blueprint. White technical linework of a house elevation, framing studs and dimension arrows on deep prussian blue, faint coffee-ring stain and folded creases across the sheet, cool chemical wash, flat matte drafting paper.',
    lettering: 'Main title in precise drafting stencil capitals, chalk white, wide tracking, thin ruled leader lines. Supporting text in small hand-drafted uppercase.',
  },
  {
    id: 'fitness-pool-lane', name: 'Pool Lanes', category: 'fitness',
    scene: 'Indoor lap pool at dawn. Overhead wide view down the lane ropes, swimmers mid-stroke, turquoise water and white tile, pale blue skylight glow, frozen splash droplets, cool clean digital finish with high clarity.',
    lettering: 'Main title in tall clean sans-serif capitals with a wet glass shine and a thin white outline. Supporting text in light widely spaced letterforms.',
  },
  {
    id: 'fitness-spin-night', name: 'Spin Class', category: 'fitness',
    scene: 'Night indoor cycling studio with the lights out. Rows of riders standing on the pedals in silhouette, magenta and electric violet strip lighting, mirrored back wall, thin haze, sweat highlights, low-key digital with deep blacks.',
    lettering: 'Main title in italic heavy sans-serif capitals with a magenta neon glow and a slight motion-blur trail. Supporting text in narrow uppercase.',
  },
  {
    id: 'fitness-climb-gym', name: 'Climbing Gym', category: 'fitness',
    scene: 'Bouldering gym after dark. Tungsten spotlights on plywood overhangs, scattered orange, lime and blue holds, a climber reaching high, chalk cloud drifting, thick padded floor, warm amber and charcoal palette, gritty photographic contrast.',
    lettering: 'Main title in heavy rounded slab capitals with a chalky matte texture and a hand-scuffed edge. Supporting text in compact bold uppercase.',
  },
  {
    id: 'fitness-dojo-dusk', name: 'Karate Class', category: 'fitness',
    scene: 'Traditional martial arts hall at dusk. Worn wooden floor, white uniforms and coloured belts, low sun through paper screens, dust drifting in the light shafts, warm sepia and oxblood palette, 35mm film grain, quiet and disciplined.',
    lettering: 'Main title in sharp brush-stroke serif capitals with dry ink edges and split hairline strokes. Supporting text in small letterspaced sans-serif.',
  },
  {
    id: 'fitness-studio-light', name: 'Barre Class', category: 'fitness',
    scene: 'Barre and reformer studio at midday. Tall windows throwing sunlight across pale oak floor and mirrors, wooden barre, resistance bands, blush pink, cream and sage palette, soft pastel grade, airy and calm with gentle lens flare.',
    lettering: 'Main title in a thin high-contrast serif with elongated letterforms and fine hairlines. Supporting text in small lowercase sans-serif with wide spacing.',
  },
  {
    id: 'fitness-field-day', name: 'Field Day', category: 'fitness',
    scene: 'Youth team sports on a grass field at golden hour. Drone-high wide view, long shadows across chalked lines, children and coaches mid-drill, emerald green and amber sunlight, orange cones, punchy warm digital with crisp detail.',
    lettering: 'Main title in chunky rounded sans-serif capitals with a thick white outline and a soft drop shadow. Supporting text bold, friendly and upright.',
  },
  {
    id: 'fitness-fuel-flat', name: 'Fuel Up', category: 'fitness',
    scene: 'Overhead flat-lay on white marble. Grilled chicken and rice bowls, berries, spinach, a shaker bottle, a tape measure and a small dumbbell, cut citrus and ice, bright even studio light, crisp shadows, fresh green and white palette.',
    lettering: 'Main title in confident geometric sans-serif capitals in solid black. Supporting text in a light weight sitting on thin horizontal rules.',
  },
  {
    id: 'fitness-easy-start', name: 'Easy Start', category: 'fitness',
    scene: 'Community hall morning class for older adults. Soft window light plus warm lamp glow, chairs, light hand weights and stretch bands, relaxed smiles, oatmeal, dusty teal and soft gold palette, gentle portrait lens, low contrast.',
    lettering: 'Main title in a friendly humanist serif with generous weight and rounded terminals. Supporting text in large plain readable sans-serif.',
  },
  {
    id: 'fitness-spin-riso', name: 'Cycle Studio', category: 'fitness',
    scene: 'Two-colour riso screen print of an indoor cycling room. Flat fluorescent orange and deep navy inks on warm off-white paper, visible misregistration and grainy ink texture, silhouetted riders leaning over handlebars, radiating speed lines.',
    lettering: 'Main title in chunky rounded sans capitals printed in solid navy with an orange offset shadow that slips out of register. Small text in typewriter mono.',
  },
  {
    id: 'fitness-dance-paper', name: 'Dance Recital', category: 'fitness',
    scene: 'Cut-paper collage of dancers mid-turn. Torn and scissor-cut shapes in coral, mustard, deep teal and cream, soft drop shadows under each paper layer, matte construction-paper texture, buoyant and playful, clean pale background.',
    lettering: 'Main title hand-cut from paper in loose brush-script capitals, each letter slightly uneven with a soft paper shadow. Details in tidy geometric sans.',
  },
  {
    id: 'fitness-trail-watercolour', name: 'Hiking Club', category: 'fitness',
    scene: 'Loose watercolour painting of walkers on a ridge trail. Wet-on-wet olive, ochre and slate washes, pine shapes bleeding at the edges, bare paper left as mist and path, cold-press cotton grain, calm open morning air.',
    lettering: 'Main title in a flowing wet brush script with soft bleeding edges and pigment pooling at stroke ends. Supporting text in light airy sans.',
  },
  {
    id: 'fitness-schedule-chalk', name: 'Class Schedule', category: 'fitness',
    scene: 'Hand-drawn chalkboard on slate green-black. Dusty white chalk drawings of dumbbells, trainers, a skipping rope and a wall clock, soft smudged shading, faint eraser streaks, a few strokes in pale yellow and mint chalk.',
    lettering: 'Main title in ornate chalk-drawn slab capitals with white outline flourishes and hatched shadowing. Secondary lines in casual chalk cursive with visible dust.',
  },
  {
    id: 'fitness-dojo-woodcut', name: 'Judo Class', category: 'fitness',
    scene: 'Japanese-style woodcut print. Black carved linework on aged ivory paper with a single vermilion ink block, figures in belted training uniforms locked in a throw, crashing wave motif behind, visible chisel marks and wood grain.',
    lettering: 'Main title in carved brush-stroke capitals with rough chiselled edges and ink-starved gaps. Supporting text in narrow upright serif printed in vermilion.',
  },
  {
    id: 'fitness-kids-embroidery', name: 'Kids Sports', category: 'fitness',
    scene: 'Embroidered felt patch artwork. Stitched running children, a ball and a whistle in kelly green, orange and cream thread on a navy felt ground, raised satin-stitch fills, chain-stitch outlines, merrowed edge, tactile and handmade.',
    lettering: 'Main title in bold varsity block capitals rendered in dense satin stitch with a contrasting chain-stitch outline. Small text in simple back-stitch lettering.',
  },
  {
    id: 'fitness-senior-litho', name: 'Golden Years', category: 'fitness',
    scene: 'Mid-century lithograph poster. Flat limited palette of burnt orange, sage, cream and charcoal, simplified rounded figures walking and stretching among park trees, printed halftone dot shading, slight ink overlap, optimistic 1950s travel-poster mood.',
    lettering: 'Main title in wide friendly mid-century sans capitals with generous letter spacing and a soft ink-bleed edge. Supporting text in a light modern serif.',
  },
  {
    id: 'fitness-pilates-swiss', name: 'Pilates Studio', category: 'fitness',
    scene: 'Swiss International style layout. Warm off-white paper, one large flat sage circle and two thin slate rules, generous empty space, a single duotone silhouette of a stretching figure in dusty rose, calm and precise, matte print finish.',
    lettering: 'Main title in lowercase grotesque, medium weight, tight tracking, flat slate ink. Supporting text in small even-weight sans, no effects, strictly aligned.',
  },
  {
    id: 'fitness-awards-deco', name: 'Club Awards', category: 'fitness',
    scene: 'Art-deco geometry for a sports club awards evening. Symmetrical fan rays and stepped chevrons in brushed gold on deep lacquer black and oxblood, thin concentric borders, a stylised laurel and cup shape centred, foil-on-card finish.',
    lettering: 'Main title in tall art-deco capitals with hairline inner stripes and thin gold rules above and below. Supporting text in spaced small caps, gold on black.',
  },
  {
    id: 'fitness-kids-memphis', name: 'Kids Camp', category: 'fitness',
    scene: 'Memphis postmodern playground graphics. Bright blocks of tomato red, sunflower yellow and cobalt on cream, squiggles, confetti triangles and dotted arcs scattered at playful angles, flat shapes with hard offset shadows, matte poster finish.',
    lettering: 'Main title in chunky rounded bubble capitals, each letter a different flat colour with a thick cream outline and a hard offset shadow. Supporting text in rounded sans.',
  },
  {
    id: 'fitness-nutrition-clay', name: 'Nutrition Plan', category: 'fitness',
    scene: 'Soft 3D clay render. Rounded matte objects — an apple, a water bottle, a small dumbbell, a bowl — modelled in pastel mint, peach and cream, floating on a seamless blush backdrop with soft studio shadows, velvety finish, no reflections.',
    lettering: 'Main title in rounded extrabold sans extruded as matte 3D clay in cream with a soft shadow. Supporting text in light rounded sans, flat pastel grey.',
  },
  {
    id: 'fitness-dance-collage', name: 'Dance Class', category: 'fitness',
    scene: 'Maximalist cut-and-paste zine collage. Torn magazine paper, coarse halftone textures and photocopied hands layered over acid green and purple, scribbled marker arcs, tape strips and stickers, deliberately messy, high-contrast photocopy grain.',
    lettering: 'Main title in ransom-note mixed typefaces, some letters cut from halftone print, some hand-marker, slightly rotated with heavy black outline. Supporting text in typewriter monospace.',
  },
  {
    id: 'fitness-training-glass', name: 'Personal Training', category: 'fitness',
    scene: 'Glassmorphism on a dark gradient mesh. Deep indigo blending into teal and plum, frosted translucent rounded panels floating with soft blur and thin bright edges, small line icons of a stopwatch and a barbell, glossy digital finish.',
    lettering: 'Main title in clean geometric sans, semibold, pure white with a faint frosted glow. Supporting text in a light weight white at reduced opacity.',
  },
  {
    id: 'community-market-dawn', name: 'Farmers Market', category: 'community',
    scene: 'Open-air produce market at first light. Wooden trestle tables, crates of tomatoes and peaches, canvas awnings, dew on greens, vendors setting up. Wide environmental lens, pale blue and butter-yellow dawn light, soft pastel film grain, gentle matte finish.',
    lettering: 'Main title in a friendly rounded slab serif, chalk-white with a soft drop shadow. Supporting text in a small handwritten script with slightly uneven strokes.',
  },
  {
    id: 'community-benefit-gala', name: 'Benefit Night', category: 'community',
    scene: 'Charity dinner in a wood-panelled hall after dark. Round tables, white linen, candle flames, silver bidding paddles, a stylish crowd mid-applause. Low-key portrait lighting, deep navy shadows against warm candle gold, high-contrast editorial finish.',
    lettering: 'Main title in a high-contrast engraved serif with thin hairlines, brushed champagne-gold. Supporting text in widely letterspaced small capitals.',
  },
  {
    id: 'community-parade-day', name: 'Parade Day', category: 'community',
    scene: 'Small-town parade at high noon. Brass instruments catching hard sun, paper bunting strung across the street, confetti in the air, families lining the kerb. Tight telephoto compression, crimson and cream against blue sky, punchy saturated digital finish.',
    lettering: 'Main title in bold vintage circus capitals with an inline stripe and a thin cream keyline. Supporting text in condensed uppercase gothic.',
  },
  {
    id: 'community-craft-fair', name: 'Craft Fair', category: 'community',
    scene: 'Overhead flat-lay of handmade goods on raw linen: knitted scarves, thrown pottery, beeswax candles, dried lavender, pressed-flower cards. Soft north-window daylight, terracotta, oatmeal and sage palette, shallow macro detail, natural matte paper finish.',
    lettering: 'Main title in a warm hand-lettered serif with inked, uneven strokes. Supporting text in a light typewriter face with visible ribbon texture.',
  },
  {
    id: 'community-blood-drive', name: 'Blood Drive', category: 'community',
    scene: 'Bright community-hall donation clinic. Padded recliners in a row, folded blankets, juice cartons, volunteers in soft scrubs, a calm donor resting. Even daylight through tall windows, white, pale teal and warm skin tones, crisp clinical digital finish.',
    lettering: 'Main title in a clean geometric sans with rounded terminals, deep teal. Supporting text in a lighter weight of the same family with generous spacing.',
  },
  {
    id: 'community-block-party', name: 'Block Party', category: 'community',
    scene: 'Neighbourhood street closed for a party at dusk. Folding tables end to end, grills smoking, string bulbs overhead, kids on bikes, neighbours mid-laugh. Warm film grain, amber bulbs against deep teal twilight sky, slight lens flare, nostalgic 35mm finish.',
    lettering: 'Main title in a chunky retro script with a thick outline and a hard offset shadow. Supporting text in bold rounded lowercase sans.',
  },
  {
    id: 'community-cleanup-day', name: 'Clean-Up Day', category: 'community',
    scene: 'Volunteers clearing a riverside park on a bright morning. High-visibility vests, work gloves, rakes, sacks of leaves, a wheelbarrow of mulch. Elevated drone-style wide angle looking down, lime green and cobalt against wet grass, crisp saturated digital finish.',
    lettering: 'Main title in heavy squared-off sans capitals, lime green with a thick charcoal outline. Supporting text in plain bold uppercase, tightly tracked.',
  },
  {
    id: 'community-honor-night', name: 'Honour Night', category: 'community',
    scene: 'Civic memorial garden at last light. Stone plinth, laurel wreath, folding chairs on gravel, an honour guard standing at ease in silhouette, a lone bugler. Long-lens portrait depth, slate grey and burnt amber, soft dusk haze, restrained low-key finish.',
    lettering: 'Main title in a stately transitional serif, small capitals in aged bronze with a fine embossed edge. Supporting text in quiet letterspaced roman.',
  },
  {
    id: 'community-volunteer-riso', name: 'Volunteer Day', category: 'community',
    scene: 'Two-colour risograph print of neighbours raking a park in the morning, rubber gloves and paper sacks, kelly green and warm orange inks slightly misregistered, heavy paper grain and ink speckle, flat uncoated matte stock, cheerful and rough.',
    lettering: 'Main title in chunky rounded sans capitals in solid orange ink, edges softly misregistered with a green ghost offset. Supporting text in a light typewriter face.',
  },
  {
    id: 'community-town-hall-woodtype', name: 'Town Hall', category: 'community',
    scene: 'Letterpress broadside on thick oatmeal cotton paper, no photograph at all, one black ink with a faded brick-red rule, a carved pointing-hand ornament and simple printers\' fleurons, deep bite and inky impression, sober civic mood, deckled edge.',
    lettering: 'Main title in enormous slab-serif wood type, black with visible woodgrain and broken edges. Secondary lines in condensed antique gothic, letterspaced wide and deeply debossed.',
  },
  {
    id: 'community-market-wash', name: 'Market Sketch', category: 'community',
    scene: 'Loose watercolour and ink-line sketch of market stalls under striped awnings, crates of tomatoes, radishes and sunflowers, wet-on-wet bleeds of sap green, ochre and raspberry, pencil underdrawing showing through, open white paper, airy morning light.',
    lettering: 'Main title in a relaxed hand-painted brush script with translucent watery edges and dry-brush breakup. Supporting text in a small neat handwritten pen serif.',
  },
  {
    id: 'community-street-party-paper', name: 'Street Party', category: 'community',
    scene: 'Cut-paper collage of a closed street with folding tables, bunting and a seated crowd, layered construction paper in coral, teal, mustard and cream, torn and scissor-cut edges casting soft real shadows, flat daylight, handmade craft-room feel.',
    lettering: 'Main title cut from bright coral paper in fat geometric capitals with scissor-nicked edges and a soft paper shadow. Supporting text in a clean flat white sans.',
  },
  {
    id: 'community-remembrance-woodcut', name: 'Remembrance', category: 'community',
    scene: 'Hand-cut woodblock print on ivory laid paper, a wreath of oak leaves and a plain stone marker, dense black cross-hatching, one muted navy overprint, visible gouge marks and chipped linework, solemn and dignified, near-monochrome.',
    lettering: 'Main title in engraved serif capitals carved from the block, crisp with tiny nicks, letterspaced wide. Supporting text in a small italic serif, black ink only.',
  },
  {
    id: 'community-donor-drive-comic', name: 'Donor Drive', category: 'community',
    scene: 'Vintage halftone comic panel on newsprint, a beaming volunteer offering juice and cookies to a donor in a folding chair, heavy black outlines, benday dot shading, faded cyan and scarlet, yellowed pulp paper, hopeful action-comic energy.',
    lettering: 'Main title in bold comic display capitals with a thick black outline, scarlet fill and a cyan offset shadow. Supporting text in hand-lettered comic caption sans.',
  },
  {
    id: 'community-parade-litho', name: 'Parade Poster', category: 'community',
    scene: 'Mid-century travel-poster lithograph of a small-town parade, marching band silhouettes, a fire engine and balloons above a row of awnings, flat simplified shapes in cranberry, cream, teal and sky blue, fine print grain, confident 1950s optimism.',
    lettering: 'Main title in wide mid-century geometric sans capitals, cream on cranberry, with a thin flat shadow. Supporting text in a light letterspaced grotesque.',
  },
  {
    id: 'community-handmade-fair-stitch', name: 'Handmade Fair', category: 'community',
    scene: 'Embroidered sampler on natural linen, a cross-stitched cottage, a pie, a spool of thread and a daisy border, floss in rust, denim blue, olive and cream, visible weave and stray thread ends, warm lamp light, homespun and tactile.',
    lettering: 'Main title chain-stitched in rust floss with raised satin-stitch fill and visible needle holes. Supporting text in small even cross-stitch capitals in denim blue.',
  },
  {
    id: 'community-town-notice-swiss', name: 'Town Notice', category: 'community',
    scene: 'Swiss International style. Vast white field, one thin red horizontal rule, a strict column grid faintly implied, a single black-and-white halftone square of clasped hands, cool neutral daylight, no ornament, crisp offset-litho finish.',
    lettering: 'Neutral neue-grotesque sans, medium weight, flush left and ragged right, black on white with generous leading and a single word set in red.',
  },
  {
    id: 'community-night-fundraiser', name: 'Night Fundraiser', category: 'community',
    scene: 'Glowing neon tubes on near-black. Deep charcoal ground with looping tube outlines in electric cyan and hot magenta, thin light trails and soft bloom halos, faint scanline haze, wet reflective sheen along the lower edge, cool late-night mood.',
    lettering: 'Glowing neon-tube capitals with rounded terminals, magenta core and cyan outer halo. Supporting text in a thin cool-white uppercase sans.',
  },
  {
    id: 'community-helping-hands-clay', name: 'Helping Hands', category: 'community',
    scene: 'Soft 3D clay render. Rounded matte forms — a heart, a donation box, a tiny house — in pastel mint, peach and lavender floating over a plain putty backdrop, soft global illumination, gentle contact shadows, velvety no-gloss surface, toy-like scale.',
    lettering: 'Extruded rounded 3D letters in matching matte clay with soft bevels and gentle cast shadow. Supporting text in a light rounded sans.',
  },
  {
    id: 'community-civic-hall-deco', name: 'Civic Hall', category: 'community',
    scene: 'Art-deco geometry on ivory card. Symmetrical stepped arches, radiating sunburst rays and fine parallel rules in jade green and copper, subtle linen-paper grain, faint foxing at the corners, warm even light, formal 1930s programme finish.',
    lettering: 'Tall narrow deco capitals with high waistlines and hairline inline stripes in copper, widely letterspaced, sitting between double jade rules.',
  },
  {
    id: 'community-fun-fair-postmodern', name: 'Fun Fair', category: 'community',
    scene: '1980s postmodern graphics. Squiggles, confetti dashes, checkerboard slivers and wobbly triangles in turquoise, bubblegum pink, black and lemon scattered across off-white, playful asymmetry, flat bright light, slight print misregistration, energetic finish.',
    lettering: 'Fat playful sans with a bouncing wonky baseline, alternating colours letter to letter and a hard black offset shadow.',
  },
  {
    id: 'community-together-glass', name: 'Together', category: 'community',
    scene: 'Gradient mesh with frosted glass. Smooth blended wash of violet into teal into blush, a translucent panel floating over it with blurred edges and a fine white hairline rim, tiny light refractions, calm airy modern-app finish, no texture anywhere.',
    lettering: 'Clean geometric sans in bright white, medium weight, generous letterspacing, faint soft glow, with some words in a lighter translucent weight.',
  },
  {
    id: 'music-jazz-cellar', name: 'Jazz Cellar', category: 'music',
    scene: 'Late-night jazz cellar. Sepia and oxblood, brass instruments catching a single hot lamp, cigarette haze drifting through the beam, brick arches lost in shadow. Tight portrait lens, heavy warm film grain, moody low-key, matte print finish.',
    lettering: 'Main title in elegant high-contrast serif italic with fine hairline strokes and a soft warm glow. Supporting text in widely letterspaced small capitals.',
  },
  {
    id: 'music-punk-basement', name: 'Punk Basement', category: 'music',
    scene: 'Sweaty basement punk show. Pure black and white, hard direct flash blowing out skin and cables, a packed crowd mid-surge, ceiling pipes overhead, battered amps stacked crooked. Wide chaotic lens, coarse grain, blown highlights, photocopied contrast.',
    lettering: 'Main title in ransom-note mismatched heavy capitals, xeroxed and torn at the edges, harsh black on white with visible ink bleed.',
  },
  {
    id: 'music-porch-session', name: 'Porch Session', category: 'music',
    scene: 'Golden-hour porch session. Dusty gold and faded denim blue, an acoustic guitar and worn boots on weathered pine boards, wheat field behind, low sun flaring through the railing. Wide environmental lens, warm film grain, honeyed haze.',
    lettering: 'Main title in tall western slab-serif capitals with hand-painted wood-grain texture and sun-bleached wear. Supporting text in a plain typewriter face.',
  },
  {
    id: 'music-concert-hall', name: 'Concert Hall', category: 'music',
    scene: 'Grand concert hall before the downbeat. Deep crimson velvet, gilt balconies, warm chandelier lamplight pooling on polished cello wood and black formalwear, tiered seats fading into dark. Wide symmetrical lens, clean digital capture, painterly contrast, lacquered finish.',
    lettering: 'Main title in refined engraved serif capitals with fine gold foil edging and generous letterspacing. Supporting text in light roman small caps.',
  },
  {
    id: 'music-warehouse-rave', name: 'Warehouse Rave', category: 'music',
    scene: 'Concrete warehouse rave at 2am. Cyan and magenta laser fans slicing through fog, silhouetted hands raised, wet floor reflecting colour, raw steel trusses above. Wide high-angle lens, clean digital, deep blacks, crisp glossy finish.',
    lettering: 'Main title in wide techno sans capitals with a liquid chrome face and a thin cyan glow outline. Supporting text in tight monospaced uppercase.',
  },
  {
    id: 'music-karaoke-booth', name: 'Karaoke Night', category: 'music',
    scene: 'Private karaoke booth, late evening. Bubblegum pink and teal neon tubing on padded vinyl walls, a handheld mic, tambourine and half-finished drinks, laughing friends mid-song. Tight flash-lit lens, soft pastel grade, slight lens haze, candy-glossy finish.',
    lettering: 'Main title in rounded bubble capitals with a glossy plastic highlight and a teal drop shadow. Supporting text in a playful light sans-serif.',
  },
  {
    id: 'music-rooftop-set', name: 'Rooftop Set', category: 'music',
    scene: 'City rooftop set at dusk. Violet sky over amber streetlights, a turntable rig and speaker stack on tar paper, skyline haze, a stylish crowd in silhouette against the last light. Editorial mid-wide lens, high-contrast grade, cinematic clarity.',
    lettering: 'Main title in bold brush-graffiti capitals with a thick white outline and a hard violet drop shadow. Supporting text in condensed uppercase sans.',
  },
  {
    id: 'music-record-table', name: 'New Record', category: 'music',
    scene: 'Overhead flat-lay on a pale oak table at midday. Cream, charcoal and burnt orange: a vinyl record half out of its sleeve, headphones coiled, brass cup, scattered lyric notebooks. Soft window daylight, clean digital, gentle shadows, matte paper finish.',
    lettering: 'Main title in modern geometric sans capitals, tightly kerned and ink-black, with one word set in a fine handwritten script.',
  },
  {
    id: 'music-lesson-studio', name: 'Music Lessons', category: 'music',
    scene: 'Bright daytime teaching studio. Chalk-white walls, pale grey floor and mint accents, sunlight falling in clean rectangles across piano keys, an open violin case, a metronome, a child\'s stool. Airy wide lens, high-key digital, soft shadows, crisp clean finish.',
    lettering: 'Main title in friendly rounded sans capitals in warm charcoal, with one word in a soft handwritten script. Supporting text in light spaced lowercase.',
  },
  {
    id: 'music-record-shop', name: 'Record Shop', category: 'music',
    scene: 'Daytime record shop aisle. Mustard, teal and worn walnut, crates of sleeves fingered open, dust and sunlight through a grubby front window, a cork board of curling paper scraps. Mid-wide slightly fisheye lens, faded seventies colour grade, matte finish.',
    lettering: 'Main title in chunky seventies groove capitals with swollen curves, mustard fill and a thin cream inline. Supporting text in condensed uppercase serif.',
  },
  {
    id: 'music-salsa-night', name: 'Salsa Night', category: 'music',
    scene: 'Tropical dance hall at midnight. Hot coral and deep turquoise, palm-leaf shadows thrown across a wooden floor, dancers spinning into motion blur, tungsten bulbs strung overhead, rum glasses sweating. Slow-shutter mid-shot, saturated warm grade, glossy finish.',
    lettering: 'Main title in swashy brush script with thick tapering strokes and a coral-to-gold gradient. Supporting text in bold condensed capitals, tightly stacked.',
  },
  {
    id: 'music-retro-jazz-litho', name: 'Retro Jazz', category: 'music',
    scene: 'Mid-century lithograph poster of a small combo on a low stage, upright bass and horn shapes, limited ink palette of black, burnt orange and cream, flat overlapping planes, visible litho grain and slight misregistration, matte paper finish.',
    lettering: 'Main title in tall geometric 1950s capitals with slightly overlapping letterforms and a hand-inked wobble. Supporting text in small spaced serif caps.',
  },
  {
    id: 'music-punk-zine', name: 'Punk Zine', category: 'music',
    scene: 'Photocopied zine collage. Torn newsprint, ripped tape edges, blown-out high-contrast black and white with one acid green blot, staples and smudged toner, crowded chaotic layers, rough matte photocopy finish.',
    lettering: 'Main title in cut-out ransom-note letters from mismatched newsprint, uneven baseline, heavy toner smears and a black marker scrawl underline.',
  },
  {
    id: 'music-country-woodtype', name: 'Country Night', category: 'music',
    scene: 'Letterpress wood-type broadside on kraft paper. Ink-pressed ornamental rules, a carved boot and fiddle motif, barn-red and deep indigo inks over tan stock, visible woodgrain texture and debossed impression, dry uncoated finish.',
    lettering: 'Main title in fat slab-serif wood-type capitals with chipped edges and ink squash. Supporting text in condensed Victorian caps between hairline rules.',
  },
  {
    id: 'music-metal-woodcut', name: 'Metal Night', category: 'music',
    scene: 'Woodcut engraving. Dense black hand-carved hatching of storm clouds, a cracked mountain and skeletal hands raised, bone-white paper showing through, one blood-red carved band, harsh graphic contrast, dry raw-print finish.',
    lettering: 'Main title in gnarled blackletter carved from the same woodblock, thorny spurs and gouged white nicks cutting through the strokes.',
  },
  {
    id: 'music-dj-riso', name: 'DJ Set', category: 'music',
    scene: 'Two-colour riso screen-print. Fluorescent pink and electric blue inks overprinting into purple, a turntable and dancing figures reduced to flat halftone dot shapes, deliberate misregistration and roller streaks, grainy matte recycled stock.',
    lettering: 'Main title in bold rounded sans capitals split into offset pink and blue layers with a purple overlap and speckled ink texture.',
  },
  {
    id: 'music-chalkboard-gig', name: 'Chalkboard Gig', category: 'music',
    scene: 'Chalkboard drawing. Deep slate-black board with smudged eraser clouds, white chalk sketches of a handheld mic, sparkles and a small stage curtain, pops of yellow and mint chalk, dusty powdery texture, casual pub blackboard finish.',
    lettering: 'Main title in chunky hand-drawn chalk capitals with double outlines and cross-hatch shading. Supporting text in loose chalk cursive.',
  },
  {
    id: 'music-hiphop-comic', name: 'Hip-Hop Night', category: 'music',
    scene: 'Halftone comic-book panel art. Bold black ink outlines, a crowd with hands up and a mic cable snaking across, flat primary red, yellow and cyan fills with visible Ben-Day dot shading, speed lines and a starburst, glossy pulp-print finish.',
    lettering: 'Main title in inflated comic capitals with a thick black outline, white inner highlight and a hard yellow drop shadow.',
  },
  {
    id: 'music-deco-night', name: 'Deco Night', category: 'music',
    scene: 'Art-deco geometric composition. Cream and deep ink-black with brushed brass arcs, stepped fan shapes and thin gold rules radiating from a half-circle, symmetrical and calm, soft paper grain, elegant matte finish with metallic sheen.',
    lettering: 'Main title in tall thin deco capitals with wide letterspacing, a fine gold inline stroke and hairline rules above and below. Supporting text in small elegant serif.',
  },
  {
    id: 'music-recital-swiss', name: 'Recital', category: 'music',
    scene: 'Swiss International style layout. Warm off-white field, one vermilion rule and a single large charcoal square, disciplined margins, wide empty space, no ornament, precise vector edges, flat uncoated print finish.',
    lettering: 'Main title in clean grotesque capitals, medium weight, tight tracking, flush left, pure black with one word in vermilion. Supporting text small and lowercase.',
  },
  {
    id: 'music-chrome-bass', name: 'Chrome Bass', category: 'music',
    scene: '3D render composition. Liquid chrome blobs and an inflated glossy sphere floating over a burnt-orange to deep-purple gradient, soft studio lighting with sharp specular highlights, subtle floor shadow, hyper-glossy plastic-and-metal finish.',
    lettering: 'Main title in extended heavy capitals rendered as polished liquid chrome with mirrored highlights and a dark bevelled underside. Supporting text in tight condensed uppercase.',
  },
  {
    id: 'music-album-drop', name: 'Album Drop', category: 'music',
    scene: 'Glassmorphism gradient mesh. Frosted translucent panels floating over a soft iridescent blend of teal, lilac and coral, blurred colour bleeding through, faint noise grain, diffused light, smooth silky digital finish.',
    lettering: 'Main title in light geometric capitals, wide tracking, semi-transparent frosted white with a thin bright edge highlight. Supporting text in small light sans at low opacity.',
  },
  {
    id: 'nightlife-rooftop-sunset', name: 'Rooftop Sunset', category: 'nightlife',
    scene: 'Rooftop terrace at dusk, camera high above a hazy city skyline. Coral and lilac sky, glass balustrades, bare-bulb string lights just switching on, a relaxed crowd holding cocktails, warm golden backlight, soft lens flare, clean digital photography.',
    lettering: 'Main title in tall airy sans-serif capitals with wide letterspacing and a soft coral-to-gold gradient fill. Supporting text in thin light uppercase, generously spaced.',
  },
  {
    id: 'nightlife-pool-party', name: 'Pool Party', category: 'nightlife',
    scene: 'Midday pool deck under hard overhead sun. Turquoise water, white tile, chrome loungers and inflatable rings, splashing water frozen mid-air, sharp palm shadows across pale concrete, saturated aqua and white, crisp high-contrast digital photography.',
    lettering: 'Main title in chunky rounded bold capitals with a glossy wet highlight and a thin white outline. Supporting text in bouncy playful sans-serif.',
  },
  {
    id: 'nightlife-powder-party', name: 'Color Powder', category: 'nightlife',
    scene: 'Outdoor colour party in late afternoon, clouds of magenta and yellow powder pigment hanging in backlit dusty air. Sweaty smiling dancers, pigment streaked on arms and clothing, warm 35mm film grain, blown highlights, low hazy sun behind the crowd.',
    lettering: 'Main title in hand-painted brush capitals with wet drips, uneven edges and multicoloured splatter flecks. Supporting text in loose marker-style lowercase.',
  },
  {
    id: 'nightlife-cabaret', name: 'Cabaret Night', category: 'nightlife',
    scene: 'Intimate cabaret room lit by tungsten lamps. Crimson velvet curtains, gilt frames, small round tables with candles, feather fans and sequins catching warm light, deep shadow, soft vignette, rich burgundy and brass palette, classic film grain.',
    lettering: 'Main title in ornate high-contrast serif with elegant swashes and hairline strokes in warm brass foil. Supporting text in delicate italic script.',
  },
  {
    id: 'nightlife-warehouse', name: 'Strobe Warehouse', category: 'nightlife',
    scene: 'Raw concrete warehouse at peak hours, hard white strobe cutting through thick fog, steel beams and cable runs overhead, a silhouetted crowd with hands raised, near-monochrome grey and white with one cold blue wash, gritty documentary photography.',
    lettering: 'Main title in stark stencil capitals, tightly packed, flat white with photocopy noise and a slight horizontal glitch offset. Supporting text in small monospaced uppercase.',
  },
  {
    id: 'nightlife-new-year', name: 'New Year', category: 'nightlife',
    scene: 'Elegant midnight ballroom, silver and champagne confetti falling through the air, coupes raised, tailored suits and sequin gowns, crystal chandelier flare, long-exposure sparkle trails, cool platinum and ice-blue palette with warm lamp pools, polished editorial finish.',
    lettering: 'Main title in polished platinum chrome capitals with a mirrored surface and fine sparkle glints. Supporting text in refined thin sans-serif, widely spaced.',
  },
  {
    id: 'nightlife-beach-bonfire', name: 'Beach Bonfire', category: 'nightlife',
    scene: 'Night beach around a driftwood bonfire. Orange firelight flickering across faces and blankets, indigo sea and pale moonlight behind, sparks rising, damp sand, heavy 35mm grain, deep shadow, warm-versus-cold contrast, natural unposed photography.',
    lettering: 'Main title in warm hand-drawn rough serif capitals with a charred smoky edge and faint ember glow. Supporting text in relaxed handwritten lowercase.',
  },
  {
    id: 'nightlife-garden-social', name: 'Garden Social', category: 'nightlife',
    scene: 'Loose watercolour on cold-press paper. Twilight walled garden, paper lanterns strung between trees, sage green, blush and dove grey washes bleeding into each other, small figures suggested in wet blooms, dry-brush lantern dots, airy matte finish.',
    lettering: 'Main title in flowing brush-lettered script with visible bristle streaks and translucent ink pooling at stroke ends. Supporting text in a light airy serif, widely spaced.',
  },
  {
    id: 'nightlife-drag-collage', name: 'Drag Show', category: 'nightlife',
    scene: 'Cut-paper collage of layered construction paper with torn edges and real cast shadows. Magenta curtain strips, turquoise and gold starbursts, a performer silhouette in glossy black card, scattered foil circles. Bold, theatrical, tactile, studio-lit.',
    lettering: 'Main title cut from gold foil card with hand-scissored uneven edges, each capital tilted slightly and drop-shadowed. Supporting text in a narrow deco sans, hand-trimmed.',
  },
  {
    id: 'nightlife-marker-splash', name: 'Paint Splash', category: 'nightlife',
    scene: 'Bold marker and ink drawing on black paper. Fast brush-pen figures mid-dance, splattered neon acrylic in lime, orange and cyan flung across the sheet, white paint-pen highlights, wet drips running down, raw matte poster-paint finish.',
    lettering: 'Main title hand-drawn in dripping paint-brush capitals of uneven weight, streaked and splattered, with a scratchy white marker outline. Supporting text in quick handwritten caps.',
  },
  {
    id: 'nightlife-woodcut-midnight', name: 'Midnight Toast', category: 'nightlife',
    scene: 'Antique woodcut engraving, dense black ink hatching on warm cream laid paper. Champagne coupes, a pocket watch, bursting fireworks drawn as fine radiating lines, ornamental border rules, single colour, high detail, letterpress bite and visible paper tooth.',
    lettering: 'Main title in ornate Victorian wood type capitals with heavy slab serifs, engraved inline shading and a decorative flourish rule. Supporting text in small caps between thin rules.',
  },
  {
    id: 'nightlife-midcentury-holiday', name: 'Holiday Party', category: 'nightlife',
    scene: 'Mid-century lithograph poster in a limited flat palette of brick red, teal, mustard and warm off-white, with visible print grain and slight ink overprint. Stylised partygoers holding cocktail glasses, geometric evergreen shapes, simple angular furniture, retro matte finish.',
    lettering: 'Main title in wide geometric sans capitals with a hand-inked wobble, mustard fill and a teal offset shadow. Supporting text in a small friendly slab serif.',
  },
  {
    id: 'nightlife-bold-poster', name: 'Bold Poster', category: 'nightlife',
    scene: 'Flat Swiss poster graphic in two colours only, scarlet red and ink black on bone white. Hard geometric grid, thick horizontal rules, one enormous red circle, generous empty margins, matte offset print texture, no photograph and no gradient.',
    lettering: 'Tight grotesque capitals set very heavy with ultra-tight tracking, pure black and scarlet, no effects at all. Supporting text in light small capitals.',
  },
  {
    id: 'nightlife-memphis-pop', name: 'Confetti Pop', category: 'nightlife',
    scene: 'Memphis postmodern composition on cream. Mint, hot pink, tangerine and cobalt shapes, squiggles, checkerboard strips, terrazzo speckles, tilted triangles and floating confetti dots, flat vector artwork, crisp screen-print finish, playful eighties graphic energy.',
    lettering: 'Chunky rounded display capitals in candy colours, each letter a different hue, with a thin black outline and a hard offset drop shadow.',
  },
  {
    id: 'nightlife-deco-gold', name: 'Deco Gold', category: 'nightlife',
    scene: 'Art-deco geometry in deep emerald and midnight ink with fine champagne-gold linework. Fan rays, stepped arches, a symmetrical sunburst and thin concentric arcs, flat illustration with a subtle metallic foil sheen, elegant nineteen-twenties poster finish.',
    lettering: 'Slim high-waisted deco capitals with thin gold inline stripes, wide letterspacing, hairline serifs and a delicate foil shine.',
  },
  {
    id: 'nightlife-clay-3d', name: 'Clay Party', category: 'nightlife',
    scene: 'Soft 3D clay render on a matte lavender backdrop. Putty-pink, butter-yellow and sky-blue balloons, rounded cylinders, a tilted disc and tiny spheres, gentle broad studio light, soft shadows, no gloss, toy-like tactile finish.',
    lettering: 'Inflated puffy 3D rounded capitals in matte clay pink with soft edges, gentle top light and a diffuse shadow beneath.',
  },
  {
    id: 'nightlife-liquid-chrome', name: 'Liquid Chrome', category: 'nightlife',
    scene: 'Dark graphite void holding a floating liquid chrome blob and rippling mercury ribbons. Iridescent oil-slick reflections of violet, teal and silver, sharp specular highlights, high-gloss mirror finish, cold futuristic 3D render, no visible light fixtures.',
    lettering: 'Polished liquid-metal capitals with mirrored chrome reflections, stretched highlights and a faint iridescent violet rim.',
  },
  {
    id: 'nightlife-riso-headphones', name: 'Silent Disco', category: 'nightlife',
    scene: 'Two-ink risograph print on rough newsprint. Fluorescent pink and electric blue overlap and misregister into purple, grainy paper speckle throughout, a dancing crowd wearing headphones drawn as flat shapes, visible halftone dots, ink-starved patches, cheerful and loud.',
    lettering: 'Main title in chunky rounded sans capitals printed twice with a deliberate offset, pink behind blue, edges slightly ink-blotted. Supporting text in small typewriter mono.',
  },
]

/** What an uploaded photo IS, which decides how it gets used. A headshot and a
 *  house need opposite treatment — one is cut out and placed, the other becomes
 *  the scene — and the model cannot tell which is which from pixels alone. */
export type PhotoRole = 'person' | 'place' | 'product' | 'logo'

export const PHOTO_ROLES: { id: PhotoRole; label: string; hint: string }[] = [
  { id: 'person', label: 'A person', hint: 'Headshot or full body — the presenter, agent, DJ, team' },
  { id: 'place', label: 'A place', hint: 'Property, venue, shop, gym — becomes the setting' },
  { id: 'product', label: 'A product', hint: 'The thing being sold — featured in the design' },
  { id: 'logo', label: 'A logo', hint: 'Placed cleanly, never redrawn or restyled' },
]

const PHOTO_RULES: Record<PhotoRole, string> = {
  person:
    'This is a REAL PERSON. Keep their face, hair, skin tone, build and clothing clearly recognisable and true to the photograph — they must still look like themselves. Separate them from their original background and place them into the design as the featured subject. Do not replace them with a different-looking person, do not change their age or ethnicity, and do not add or remove facial features.',
  place:
    'This is a REAL PLACE. Keep the building, room or venue accurate and recognisable — the same architecture, layout and materials. Do not invent a different property. Use it as the setting or hero image of the design; relight it to suit the style, but do not redesign it.',
  product:
    'This is a REAL PRODUCT. Keep its shape, colour, branding and proportions exactly as photographed. Feature it prominently. Do not restyle, redesign or substitute it.',
  logo:
    'This is a LOGO. Place it cleanly and legibly in the design, keeping its exact shapes, colours and proportions. Do NOT redraw, restyle, recolour, add effects to, or generate any variation of it. If it will not fit cleanly, make it smaller rather than altering it.',
}

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
export function flyerPrompt(
  t: FlyerTemplate,
  f: FlyerFields,
  size: FlyerSize,
  photos: PhotoRole[] = [],
  /**
   * A reference design was supplied, attached as the FIRST image.
   *
   * This REPLACES the template rather than adding to it, which is why the two
   * cannot both be chosen: a template is an art direction, a reference is an
   * art direction, and handing the model two different ones produces a muddle
   * of both. When true the template's scene and lettering are dropped and the
   * reference's look is the instruction.
   */
  reference = false,
  /**
   * The piece is being generated OVERSIZE for a commercial printer, and an
   * eighth of an inch will be cut off every edge.
   *
   * The model has to be told, or it does the sensible-looking thing and leaves
   * a tidy white margin — which the trim then turns into an uneven off-white
   * border, and the print is wasted.
   */
  bleed = false,
): string {
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

  // A BUSINESS CARD IS NOT A SMALL POSTER. The same fields mean different
  // things on one — the headline is a person's name, not an event — and a card
  // laid out like a flyer is unreadable at 3.5 inches. So the labels change and
  // the restraint below is spelled out, rather than hoping the model infers it
  // from the dimensions.
  const card = size.group === 'card'
  const cardBack = size.id === 'biz-card-back'
  // A PRESENTATION SLIDE IS NOT A POSTER. It is read from the back of a room in
  // a few seconds while someone talks over it, so it carries one idea in very
  // large type with a lot of empty space — the opposite of a flyer, which is
  // held in the hand and allowed to be dense.
  const slide = size.group === 'slide'
  // How much of each edge gets cut off, as a percentage of the whole image.
  // Quoting the real number beats saying "leave a bit extra": the model is being
  // asked to deliberately overrun a boundary, which is not its instinct.
  const bleedPctW = bleed && size.unit === 'in' ? (BLEED_IN / (size.w + BLEED_IN * 2)) * 100 : 0
  const bleedPctH = bleed && size.unit === 'in' ? (BLEED_IN / (size.h + BLEED_IN * 2)) * 100 : 0

  const lines: string[] = []
  if (card) {
    if (f.eyebrow) lines.push(`- Small line above the name: "${f.eyebrow}"`)
    if (f.headline) lines.push(`- THE PERSON'S NAME, the largest text on the card: "${f.headline}"`)
    if (f.subhead) lines.push(`- Their job title, directly under the name, smaller: "${f.subhead}"`)
    if (f.venue) lines.push(`- Company name: "${f.venue}"`)
    if (f.address) lines.push(`- Address, small: "${f.address}"`)
    for (const d of (f.details ?? []).slice(0, 4)) lines.push(`- Contact detail line, small: "${d}"`)
    if (f.cta) lines.push(`- Short tagline: "${f.cta}"`)
    if (f.contact) lines.push(`- Phone, email and website line, small but perfectly legible: "${f.contact}"`)
  } else {
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
  }

  return [
    card
      ? `A professional business card design — the flat printed ${cardBack ? 'BACK' : 'FRONT'} face of a standard 3.5 x 2 inch card, print quality, designed by a graphic designer. Landscape orientation. Not a photograph of a card, not a mockup, no hand, no desk, no shadow, no stack of cards, no rounded-corner outline drawn onto the artwork — just the flat artwork itself, full bleed.`
      : slide
      ? 'A single presentation slide, 16:9 widescreen, designed by a graphic designer for projection. Flat artwork filling the whole frame — not a photograph of a screen, no laptop, no projector, no room, no drop shadow, no slide border or frame drawn onto it.'
      : `A professional ${wide ? 'wide banner' : square ? 'square social media' : 'portrait poster'} advertisement, print quality, designed by a graphic designer.`,
    '',
    // A REFERENCE REPLACES THE TEMPLATE. Both are an art direction, and giving
    // the model two at once produces a design that obeys neither.
    reference
      ? [
          'DESIGN STYLE — TAKE DIRECTION FROM THE REFERENCE. The FIRST attached image is a reference design supplied by the customer. It is a style guide, NOT artwork to be reproduced. Match its look closely:',
          '- the same colour palette and how the colours are distributed',
          '- the same feel of lettering: serif or sans, weight, letter spacing, capitals or mixed case, and the same relationship in size between the headline and the small print',
          '- the same kind of composition, spacing and visual rhythm',
          '- the same mood, lighting, texture and level of decoration',
          'Do NOT copy the reference\'s words, names, dates, prices, logos or photographs — only its style. Do not reproduce it. This is a NEW design for the content below that a customer would believe came from the same designer.',
        ].join('\n')
      : `DESIGN STYLE: ${t.scene}`,
    '',
    lines.length
      ? `TEXT TO RENDER — spell every word EXACTLY as written, no substitutions, no invented text, and do not add any words that are not listed:\n${lines.join('\n')}`
      : 'TEXT: none — artwork only.',
    '',
    reference
      ? 'TYPOGRAPHY: follow the reference image\'s lettering as described above. All text must be sharp, correctly spelled, properly kerned and clearly legible with strong contrast against whatever sits behind it.'
      : `TYPOGRAPHY: ${t.lettering} All text must be sharp, correctly spelled, properly kerned and clearly legible with strong contrast against whatever sits behind it.`,
    '',
    // SAFE MARGINS. Nothing in the prompt used to ask for these, so the model
    // ran headlines flush to the edge and letters came back clipped — on print
    // that is worse than it looks on screen, because trimming takes a few more
    // millimetres off every side.
    // Supplied photographs, in the order they are attached. Naming the order
    // matters: the model is handed an array and has no other way to know which
    // instruction belongs to which picture.
    ...(photos.length
      ? [
          '',
          // The reference, when there is one, is image 1 — so the photographs
          // start at 2. Getting this offset wrong makes the model apply the
          // "keep this person recognisable" rule to the reference design.
          `SUPPLIED PHOTOGRAPHS — ${photos.length} ${photos.length === 1 ? 'image is' : 'images are'} attached${reference ? ', AFTER the reference image' : ''}, in this order. These are REAL and were provided by the customer. Build the design around them rather than inventing substitutes:`,
          ...photos.map((r, i) => `- Image ${i + 1 + (reference ? 1 : 0)}: ${PHOTO_RULES[r]}`),
          'Every attached photograph must appear in the finished design. Do not generate a different person, place or product in its stead.',
        ]
      : []),
    '',
    // BLEED. The artwork is deliberately oversize and the outer sliver is cut
    // off. Left unsaid, the model composes a neat design that fits the frame —
    // and the trim then eats into it, or worse leaves a pale uneven rim where
    // the background stopped short of the edge.
    ...(bleed
      ? [
          'PRINT BLEED — THE OUTER EDGE WILL BE CUT OFF:',
          `- This artwork is printed OVERSIZE and trimmed. The outer ${bleedPctW.toFixed(1)}% of the width on each side and the outer ${bleedPctH.toFixed(1)}% of the height top and bottom are cut away and will NOT appear on the finished piece.`,
          '- The background, colour, photograph and texture MUST run right off all four edges. No white border, no frame, no rounded corners, no empty rim — if the artwork stops short of the edge the printed piece gets an ugly pale sliver down one side.',
          '- Because of that trim, keep every word, number, logo and face even further inside than usual. Treat the outer tenth of the image as a disposable margin.',
          '',
        ]
      : []),
    'SAFE MARGINS — THIS IS CRITICAL AND NON-NEGOTIABLE:',
    `- Leave a clear, generous empty margin all the way around the design: at least ${bleed ? 12 : 8}% of the width on the left and right, and at least ${bleed ? 10 : 6}% of the height at the top and bottom.`,
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
    card
      ? `LAYOUT: ${
          cardBack
            ? 'This is the BACK of the card and it must be RESTRAINED — a single strong element on a clean field. Typically the company mark or monogram centred, or a bold flat colour with one short line. Use at most two short pieces of text no matter how many are listed above; drop the rest. Vast empty space is correct here and looks expensive.'
            : 'This is the FRONT of the card. The person\'s name reads first and largest, the job title sits quietly beneath it, and the contact details group together in one corner or along one edge at a small but perfectly legible size. Aim for THREE groups on the card at most.'
        } A business card is held at arm\'s length: keep it calm, leave real breathing room, and use far fewer elements than a flyer would. No small print smaller than about 6% of the card\'s height, or it will not survive printing.`
      : slide
      ? 'LAYOUT: this is a PRESENTATION SLIDE, read from the back of a room in a few seconds while someone speaks over it. ONE idea only. The main line is very large — at least 12% of the frame height — and there are at most three short supporting lines, or a simple row of three or four labelled points. Vast empty space is correct and looks confident. Never a paragraph, never a dense list, never small print. Imagery sits to one side or behind at low contrast so the words stay effortless to read.'
      : `LAYOUT: professional composition with clear visual hierarchy — the main title dominant, supporting details grouped and easy to scan. ${
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
