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
  group: 'print' | 'social' | 'banner' | 'card'
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
  // Standard UK/US business card. Small enough that the pixel FLOOR applies
  // rather than the ceiling — apiSize scales the request up to the API's
  // minimum and the result is scaled back down to 1050x600 for print, which is
  // why a card comes out unusually crisp.
  { id: 'biz-card-front', label: 'Business card — front 3.5 × 2 in', group: 'card', w: 3.5, h: 2, unit: 'in' },
  { id: 'biz-card-back', label: 'Business card — back 3.5 × 2 in', group: 'card', w: 3.5, h: 2, unit: 'in' },
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
      : `A professional ${wide ? 'wide banner' : square ? 'square social media' : 'portrait poster'} advertisement, print quality, designed by a graphic designer.`,
    '',
    // A REFERENCE REPLACES THE TEMPLATE. Both are an art direction, and giving
    // the model two at once produces a design that obeys neither.
    reference
      ? [
          'DESIGN STYLE — COPY THE REFERENCE. The FIRST attached image is a reference design supplied by the customer. Match its look closely:',
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
    card
      ? `LAYOUT: ${
          cardBack
            ? 'This is the BACK of the card and it must be RESTRAINED — a single strong element on a clean field. Typically the company mark or monogram centred, or a bold flat colour with one short line. Use at most two short pieces of text no matter how many are listed above; drop the rest. Vast empty space is correct here and looks expensive.'
            : 'This is the FRONT of the card. The person\'s name reads first and largest, the job title sits quietly beneath it, and the contact details group together in one corner or along one edge at a small but perfectly legible size. Aim for THREE groups on the card at most.'
        } A business card is held at arm\'s length: keep it calm, leave real breathing room, and use far fewer elements than a flyer would. No small print smaller than about 6% of the card\'s height, or it will not survive printing.`
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
