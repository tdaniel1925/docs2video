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
  /**
   * The scene: how it is drawn AND what is pictured, in one paragraph.
   *
   * THIS IS THE OLD SHAPE AND IT IS THE BUG. Mixing the two meant a customer
   * who picked the autumn style for its burnt-orange palette and hand-lettering
   * got pumpkins whether they wanted them or not — because the pumpkins and the
   * palette arrived in the same instruction, at the top, and their own request
   * arrived at the bottom as an afterthought. Kept only as the fallback for any
   * style not yet split.
   */
  scene: string
  /**
   * HOW IT IS DRAWN, with nothing in it that is pictured.
   *
   * Palette, lettering, texture, lighting, finish, era. Must survive having any
   * subject at all dropped into it: pick this look, ask for an HVAC van, and
   * every word here should still apply.
   */
  look?: string
  /**
   * WHAT IS PICTURED — the pumpkins, the ice cream cone, the club crowd.
   *
   * Optional in both senses: a style may not have one, and a customer may not
   * want it. This is the half that gets replaced when somebody says what they
   * actually sell.
   */
  subject?: string
  /** The look's name, which describes the look and never an occasion. */
  lookName?: string
  /** Which shelf it sits on in the picker — grouped by look, not by industry. */
  family?: string
  /**
   * This style turned out to be another style wearing a different costume, so
   * the picker shows the other one instead.
   *
   * IT IS NOT DELETED, and that is deliberate. Its id still resolves, so every
   * design ever made with it still opens. Its subject still feeds the motif
   * library. And undoing a merge somebody disagrees with is deleting one field
   * rather than reconstructing a paragraph from the git history.
   */
  mergedInto?: string
  /** Why it was folded in, in one line, so the decision can be argued with. */
  mergedWhy?: string
  /** The lettering: how the words should look. This is what separates a club
   *  flyer from a corporate one far more than the photograph does. */
  lettering: string
}

export const FLYER_TEMPLATES: FlyerTemplate[] = [
  {
    id: 'rnb', name: 'Gilded Noir', category: 'nightlife',
    mergedInto: 'vip', mergedWhy: 'Same black-and-gold, high-gloss metal lettering; only a haze layer differs',
    look: 'Black and antique gold, almost no third colour. Warm amber haze drifting through the frame, cinematic portrait key light with deep falloff, rich contrast, glossy magazine finish. Polished highlights on metal, velvety shadow, everything expensive and low-lit.',
    subject: 'A glamorous crowd in a high-end club, gold chains, champagne glasses, stage haze',
    lettering: 'Main title in bold gold chrome 3D lettering with reflective metallic finish and a subtle bevel. Supporting text in clean high-contrast sans-serif.',
    scene: 'Luxury R&B night. Black and gold. A glamorous, stylish crowd in a high-end club, warm amber stage haze, gold chains and champagne, cinematic portrait lighting, rich contrast, glossy magazine finish.',
  },
  {
    id: 'retro', name: 'Synth Chrome', category: 'nightlife',
    family: 'retro-vintage',
    look: 'Magenta, violet and cyan neon over deep indigo. Chrome and glass surfaces, a glowing grid receding to a low banded sunset, heavy VHS grain and scanlines, subjects lit split magenta one side and blue the other. Eighties arcade colour, saturated and hazy.',
    subject: 'Retro sunset horizon with a chrome grid landscape',
    lettering: 'Main title in glossy chrome italic lettering with a magenta-to-cyan gradient and a neon outer glow, eighties arcade styling.',
    scene: 'Eighties synthwave party. Magenta, violet and cyan neon. Chrome grid horizon, retro sunset, VHS grain, portraits lit in split magenta and blue.',
  },
  {
    id: 'ladies', name: 'Champagne Sparkle', category: 'nightlife',
    family: 'elegant-script',
    look: 'Warm golden light with soft bokeh sparkle everywhere. Champagne, blush and pale gold palette, glittering reflective surfaces, gentle glow bloom, high-fashion polish. Elegant and celebratory rather than harsh, shadows kept soft and warm.',
    subject: 'Gold disco ball, sequins, champagne',
    lettering: 'Main title in elegant flowing gold script with a soft glow, paired with clean uppercase sans-serif for details.',
    scene: 'Glamorous ladies night. Gold disco ball, champagne sparkle, sequins, warm golden light, elegant and celebratory, high fashion feel.',
  },
  {
    id: 'vip', name: 'Obsidian Gold', category: 'nightlife',
    family: 'dark-luxury',
    look: 'Near-black background with pure gold accents and nothing else. Very high contrast, deep crushed shadow, a hard dramatic rim light tracing every edge, specular glints on polished surfaces. Opulent, exclusive, minimal clutter, all weight in the darkness.',
    subject: 'A supercar in deep shadow',
    lettering: 'Main title in heavy gold metallic block capitals with a strong bevel and specular highlights, luxury branding feel.',
    scene: 'VIP luxury club night. Black and gold, a supercar, deep shadow, dramatic rim light, opulent and exclusive, very high contrast.',
  },
  {
    id: 'neonclub', name: 'Beam Fog', category: 'nightlife',
    family: 'neon-night',
    look: 'Dark interior lit only by cyan and magenta neon tubes. Atmospheric fog catching thin laser beams, strong colour separation between the two hues, glowing bloom around every light source, energetic and modern, deep black gaps between the colour.',
    subject: 'A packed dance floor of dancers in a club',
    lettering: 'Main title as glowing neon tube lettering in cyan and magenta, with realistic light bloom against the dark background.',
    scene: 'Dark club interior packed with dancers, cyan and magenta neon tubes, atmospheric fog, laser beams, energetic and modern.',
  },
  {
    id: 'halloween', name: 'Eerie Gothic', category: 'nightlife',
    family: 'photo-cinematic',
    look: 'Sickly green and deep purple fog against black. Moonlight from behind, candle-warm points of light, ornate gothic detailing, heavy vignette and cinematic horror-poster grading. Murky, haunting, high contrast with sharp silhouettes.',
    subject: 'Skulls, candles, gothic ornament in fog',
    lettering: 'Main title in dripping horror lettering with a rough edge and an eerie green glow.',
    scene: 'Halloween party. Eerie green and purple fog, gothic details, skulls and candlelight, moonlit and haunting, cinematic horror poster styling.',
  },
  {
    id: 'tropical', name: 'Sunset Wash', category: 'nightlife',
    family: 'gradient-modern',
    look: 'Warm orange, coral and pink dusk sky melting into turquoise. Low golden backlight with long soft shadows, saturated but relaxed, smooth gradient washes rather than hard blocks, gentle glow on edges. Vibrant, easy, sun-drenched.',
    subject: 'Palm trees, ocean water, cocktails at sunset',
    lettering: 'Main title in bold rounded lettering with a tropical sunset gradient and a soft drop shadow.',
    scene: 'Tropical beach party at sunset. Palms, turquoise water, warm orange and pink dusk sky, cocktails, relaxed and vibrant.',
  },
  {
    id: 'corporate', name: 'Blue Hour Glass', category: 'business',
    mergedInto: 'business-early-start', mergedWhy: 'Same cool navy-and-glass minimalism at low light; only the wording of the type note differs',
    look: 'Restrained navy and white with cool blue-hour light. Clean even professional lighting, sharp focus, glass and steel surfaces reflecting a dusk sky, minimal colour beyond the two tones. Credible and orderly, generous empty space, no texture or grain.',
    subject: 'Glass architecture at dusk',
    lettering: 'Main title in confident modern sans-serif, generous spacing, no effects — clean and corporate.',
    scene: 'Modern corporate event. Glass architecture at blue hour, clean professional lighting, sharp and credible, restrained colour palette of navy and white.',
  },
  {
    id: 'editorial', name: 'Quiet Bone Minimal', category: 'business',
    family: 'editorial-magazine',
    look: 'Warm neutral palette — bone, sand, soft grey. Diffuse daylight from one side, gentle shadow, premium matte materials, very calm. Lots of negative space, subject small in frame, high-end magazine styling with fine detail and no visual noise.',
    subject: 'A refined still-life arrangement of premium objects',
    lettering: 'Main title in an elegant high-contrast serif, understated and premium, with fine hairline rules.',
    scene: 'Refined editorial still life. Warm neutral light, premium materials, quiet and minimal, lots of negative space, high-end magazine styling.',
  },
  {
    id: 'launch', name: 'Voltage Gloss', category: 'business',
    family: 'bold-poster',
    look: 'Saturated purple to electric blue gradient backdrop. Dramatic hard studio lighting with a crisp rim and controlled reflections, sharp edges, glossy modern finish, strong colour contrast against the subject. Bold, clean, confident, nothing distressed.',
    lettering: 'Main title in heavy geometric sans-serif with a 3D extrude in the accent colour.',
    scene: 'Bold product launch. Dramatic studio lighting on a saturated gradient backdrop, purple and electric blue, sharp and modern.',
  },
  {
    id: 'community', name: 'Daylight Warmth', category: 'community',
    family: 'nature-organic',
    look: 'Soft greens and warm neutrals in natural daylight. Even gentle lighting, no hard shadows, honest unfiltered photographic feel, mid contrast, slightly warm cast. Approachable and genuine, uncluttered, colours muted rather than saturated.',
    subject: 'Real people gathered together outdoors',
    lettering: 'Main title in friendly rounded sans-serif, warm and readable, no harsh effects.',
    scene: 'Warm community gathering. Natural daylight, real people together, approachable and genuine, soft greens and warm neutrals.',
  },
  {
    id: 'openhouse', name: 'Golden Hour Clarity', category: 'realestate',
    family: 'photo-cinematic',
    look: 'Bright golden-hour sunlight, clear blue sky, crisp greens and clean whites. Long warm low-angle light, high clarity, aspirational and tidy, saturated but natural. Sharp architectural lines, everything well kept and glowing at the edges.',
    subject: 'A modern home exterior with manicured landscaping',
    lettering: 'Main title in a clean elegant serif with a slim underline, professional real-estate branding.',
    scene: 'Bright modern home exterior at golden hour, manicured landscaping, aspirational architecture, clear blue sky.',
  },
  {
    id: 'listing', name: 'Taupe Dusk Glow', category: 'realestate',
    family: 'dark-luxury',
    look: 'Warm evening light spilling across a calm expensive interior palette of taupe, walnut and soft gold. Floor-to-ceiling glass with a dusk glow beyond, low pooled lamplight, gentle contrast, restrained and quiet. Designer materials, immaculate surfaces.',
    subject: 'An architectural interior with designer furnishings and glass walls',
    lettering: 'Main title in refined gold serif capitals with wide letter spacing, luxury property styling.',
    scene: 'Architectural interior with floor-to-ceiling glass, warm evening light, designer furnishings, calm and expensive.',
  },
  {
    id: 'gym', name: 'Ember Iron', category: 'fitness',
    family: 'grunge-street',
    look: 'Dark charcoal and steel with a hot red accent light. Hard rim lighting carving edges out of blackness, dust hanging in the beams, heavy grain and scuffed texture, very high contrast and intense. Sweaty highlights, deep shadow, nothing soft.',
    subject: 'Steel equipment and chalk dust in the air',
    lettering: 'Main title in aggressive heavy condensed capitals with a rough distressed edge and a red outline.',
    scene: 'Gritty gym. Hard rim lighting, chalk dust in the air, steel and sweat, dark and intense, red accent lighting.',
  },
  {
    id: 'race', name: 'Dawn Motion', category: 'fitness',
    mergedInto: 'openhouse', mergedWhy: 'Same warm low sun over an open outdoor scene with clean uplifting contrast',
    look: 'Warm amber morning light with a wide pale sky. Long low sun flare, motion blur streaking through the frame, uplifting mid contrast, dust and haze catching the light. Open airy composition, colours warm gold against cool blue shadow.',
    subject: 'Runners on an open road at dawn',
    lettering: 'Main title in bold italic sports lettering with a forward-motion slant and an amber gradient.',
    scene: 'Runners at dawn on an open road, motion and energy, warm morning light, wide sky, determined and uplifting.',
  },
  {
    id: 'workshop', name: 'Airy Mint', category: 'business',
    mergedInto: 'business-now-hiring', mergedWhy: 'Same bright pale-oak daylight room with mint/coral accents and rounded sans',
    look: 'Bright airy daylight scene, pale oak and warm white surfaces, soft diffused window light with no glare, accents of mint green and coral against warm teal, natural matte finish, low contrast, calm uncluttered composition, friendly approachable modern photography.',
    subject: 'Training room table, sticky notes on a whiteboard, coffee cups, open blank notebooks',
    lettering: 'Main title in a rounded geometric sans, medium weight with wide open counters, set in flat marker-ink colour with a hand-drawn highlighter swipe behind it. Supporting text in light rounded sans.',
    scene: 'Bright daytime training room. Pale oak table, blank sticky notes in mint and coral on a whiteboard, ceramic coffee cups and open blank notebooks, tall windows with soft diffused daylight, airy white and warm teal palette, friendly and hands-on, natural matte finish, no glare.',
  },
  {
    id: 'law-firm', name: 'Walnut Lamplight', category: 'business',
    family: 'dark-luxury',
    look: 'Dark walnut and deep forest green, one low warm pool of lamplight against heavy falloff into near-black shadow, brass highlights, shallow depth of field, subtle film grain, rich low-key contrast, still and traditional, matte photographic finish.',
    subject: 'Panelled interior, leather chair, brass desk lamp, rows of bound volumes',
    lettering: 'Main title in engraved small-caps serif, tight letterspacing, soft letterpress deboss with a thin brushed-brass edge. Supporting text in restrained roman capitals, wide tracked.',
    scene: 'Traditional professional-services interior after hours. Dark walnut panelling, deep forest green leather chair, brass desk lamp casting one low warm pool of light, rows of unmarked bound volumes, shallow depth of field, heavy falloff into shadow, subtle film grain.',
  },
  {
    id: 'blowout-sale', name: 'Siren Slash', category: 'sale',
    family: 'bold-poster',
    look: 'Flat screaming red and lemon yellow with hard black diagonal slashes, burst starbursts and torn paper shapes, pure vector artwork with no photography, matte print finish, zero gradients, maximum contrast, loud and explosive energy.',
    lettering: 'Enormous ultra-heavy italic capitals in white with a thick black outline and a hard yellow drop shadow, slightly skewed forward for speed.',
    scene: 'Explosive discount energy. Flat screaming red and lemon yellow, hard black diagonal slashes, burst starbursts and torn price-tag shapes, no photograph — pure vector poster, matte print finish, zero gradients, maximum contrast.',
  },
  {
    id: 'clean-retail', name: 'Cobalt Grid', category: 'sale',
    family: 'flat-vector',
    look: 'Straight-down overhead photography on a saturated cobalt-blue surface, objects laid out in a neat even grid, hard midday sunlight throwing crisp offset shadows, tangerine and white accents, punchy saturated colour, glossy finish, high contrast and orderly.',
    subject: 'Everyday product items arranged in a grid',
    lettering: 'Geometric sans-serif in two weights: the number tight and bold, the words light with wide letter-spacing. No outlines, no shadows.',
    scene: 'Bright product promotion shot straight down. Everyday items arranged in a neat grid on a saturated cobalt-blue surface, hard midday sunlight casting crisp offset shadows, tangerine and white accents, punchy saturated colour, glossy finish.',
  },
  {
    id: 'holiday-sale', name: 'Gilded Kraft Glow', category: 'sale',
    family: 'warm-rustic',
    look: 'Warm lamplight over deep pine green and cranberry red, brushed kraft paper texture, soft golden bokeh in the background, tactile matte finish with a faint sheen, cosy medium contrast, natural props photography, glowing and hand-made feel.',
    subject: 'Evergreen sprigs, twine, cinnamon sticks, cut orange',
    lettering: 'Warm hand-drawn script for the lead word paired with small friendly rounded sans capitals, both in soft antique gold foil.',
    scene: 'Cosy seasonal promotion. Warm lamplight over deep pine green and cranberry red, brushed kraft paper texture, evergreen sprigs, twine, cinnamon sticks and cut orange, soft golden bokeh behind, tactile matte finish with a faint sheen.',
  },
  {
    id: 'quiet-luxury-sale', name: 'Bone Silk', category: 'sale',
    family: 'minimal-type',
    look: 'Cool bone-white and pale stone with muted sand and charcoal, low raking window light casting long soft shadows, restrained and sparse composition, subtle film grain, very low contrast, quiet expensive stillness, soft matte photographic finish.',
    subject: 'A single draped silk swatch on a brushed-nickel rail',
    lettering: 'Sparse thin serif capitals with very wide tracking and a hairline rule beneath; no bold anywhere, the number set in the same thin serif at large size.',
    scene: 'Restrained upscale markdown. Cool bone-white and pale stone, a single draped silk swatch on a brushed-nickel rail, low raking window light, long soft shadows, muted sand and charcoal palette, still and expensive, subtle film grain.',
  },
  {
    id: 'rustic-kitchen', name: 'Flour and Oak Daylight', category: 'food',
    family: 'warm-rustic',
    look: 'Scarred pale oak and crumpled linen, single window of soft north light raking across into deep shadow, muted palette of wheat, butter cream and forest green, cast-iron dark accents, matte film-grain finish, moody handcrafted photography.',
    subject: 'Kitchen table, cast-iron pan, torn sourdough loaf, dusting of flour',
    lettering: 'Main title in a warm hand-brushed script with slightly uneven ink weight and dry-brush tails, paired with small letterspaced woodblock capitals in charcoal.',
    scene: 'Rustic artisan kitchen table. Flour-dusted scarred oak, crumpled linen cloth, cast-iron pan and torn sourdough, single window of soft north light raking across, deep shadow, muted palette of wheat, butter cream and forest green, matte film-grain finish.',
  },
  {
    id: 'fresh-menu', name: 'Softbox High Key', category: 'food',
    family: 'photo-cinematic',
    look: 'Bright studio photography on a seamless pale mint backdrop, overhead flat-lay arrangement, crisp softbox light with tiny hard shadows, saturated lime, coral and white palette, clean glossy commercial finish, cheerful high-key and uncluttered.',
    subject: 'Colourful bowls, citrus halves, scattered herbs',
    lettering: 'Main title in rounded geometric sans-serif, extra-bold, cheerful and tightly kerned, with a soft coral drop shadow and no texture or outline.',
    scene: 'Bright modern food photography on a seamless pale mint backdrop. Overhead flat-lay of colourful bowls, citrus halves and scattered herbs, crisp studio softbox light, tiny hard shadows, saturated palette of lime, coral and white, clean glossy commercial finish.',
  },
  {
    id: 'street-food', name: 'Bold Keyline Screenprint', category: 'food',
    family: 'halftone-print',
    look: 'Flat vector illustration with thick black linework and halftone dot shading, riso-print colour of chilli red, hot yellow and cobalt, dusk light, screen-printed poster finish with slight ink misregistration, loud high-contrast graphic energy.',
    subject: 'A busy food truck at dusk, steam curls, paper trays',
    lettering: 'Main title in chunky slab capitals with a hard black outline and a yellow offset shadow, tilted for energy, edges showing slight ink misregistration.',
    scene: 'Loud street-food illustration. Flat vector poster art of a busy food truck at dusk, halftone dot shading, thick black linework, riso-print colour of chilli red, hot yellow and cobalt, steam curls and paper trays, screen-printed poster finish.',
  },
  {
    id: 'cocktail-lounge', name: 'Jade Chrome', category: 'food',
    family: 'dark-luxury',
    look: 'Polished black marble and fluted chrome under cool jade and emerald light, mirrored reflections, silver-grey shadows, crisp glass-and-metal specular highlights, deep night contrast, sharp modern finish, symmetrical Art Deco geometry.',
    subject: 'Coupe glass with condensation and a citrus twist on a bar counter',
    lettering: 'Main title in tall Art Deco geometric capitals, widely spaced, polished silver chrome with a fine engraved inline stripe through each letter; subtitle in ivory letterspaced small caps.',
    scene: 'Art Deco cocktail bar after midnight. Coupe glass on a polished black marble counter, fluted chrome column and mirrored back wall, cool jade and emerald light, condensation beads, citrus twist, silver-grey shadows, crisp glass-and-metal reflections, sharp modern finish.',
  },
  {
    id: 'salon-luxe', name: 'Blush Marble Rose-Gold', category: 'services',
    family: 'elegant-script',
    look: 'Blush pink and dusty rose with warm brass fittings and veined marble, soft diffused beauty lighting with a bright ring-light catch, glossy reflective surfaces, clean editorial retouch, low contrast, polished feminine refinement.',
    subject: 'Salon interior, clear glass bottles, velvet chair',
    lettering: 'Main title in a delicate high-contrast serif with long tapered strokes, filled with brushed rose-gold foil, joined by a fine looping monoline script accent word and wide-tracked thin capitals. No shadows.',
    scene: 'Polished salon interior. Blush pink walls and warm brass fittings, soft diffused beauty lighting with a ring-light catch, veined marble counter, clear glass bottles, a dusty-rose velvet chair, glossy skin and glossy hair, clean editorial retouch.',
  },
  {
    id: 'home-services', name: 'Bold Sky Blue', category: 'services',
    family: 'clean-corporate',
    look: 'Clear morning daylight, even and sunny with no harsh shadow, royal blue, crisp white and grass green, cloudless open sky, tidy well-kept surfaces, straightforward realistic photography, medium contrast, dependable and wholesome.',
    subject: 'Suburban home exterior, cut lawn, plain white work van with a roof ladder',
    lettering: 'Main title in sturdy rounded sans-serif capitals, solid navy with a thin white keyline and a flat inline stripe through each letter. Supporting text plain, wide and legible.',
    scene: 'Bright suburban home exterior on a clear morning. Fresh-cut lawn, tidy white siding, an unmarked plain white work van at the curb with a ladder on its roof rack, cloudless blue sky, even sunny daylight, royal blue, white and grass green.',
  },
  {
    id: 'grease-trade', name: 'Sodium Grit', category: 'services',
    mergedInto: 'gym', mergedWhy: 'Same near-black gritty photo with a hot orange-red accent and battered distressed type',
    look: 'Night interior lit by bare caged lamps, deep near-black shadows cut by orange sodium spill, stained concrete and red steel, gritty worn surfaces, hard directional light, high contrast, hands-on industrial realism, rough textured finish.',
    subject: 'Garage bay, toolbox, stacked tyres, gloved hands on a wrench',
    lettering: 'Main title in heavy slab-serif capitals, chipped and worn at the edges, hand-painted burnt-orange fill with a hard black drop shadow and faint paint-flake texture.',
    scene: 'Working garage bay at night. Bare caged shop lights and a hanging work lamp, oil-stained concrete floor, red steel toolbox, stacked tyres, deep near-black shadows cut by orange sodium spill, gloved hands on a wrench, gritty and hands-on.',
  },
  {
    id: 'friendly-flat', name: 'Paper Teal', category: 'services',
    family: 'flat-vector',
    look: 'Cheerful flat vector illustration with no photography, soft cream background, simple rounded shapes in teal, mustard and coral, thick even outlines, gentle paper-grain texture, flat even lighting, low contrast, warm and approachable.',
    subject: 'A wagging dog, a broom, a stacked moving box, a little house',
    lettering: 'Main title in a chunky friendly rounded sans-serif with a slightly bouncy baseline, solid teal, plus one small handwritten marker-style accent word in coral.',
    scene: 'Cheerful flat vector illustration, no photography. Soft cream background, simple rounded shapes — a wagging dog, a broom, a stacked moving box and a little house — in teal, mustard and coral, thick even outlines, gentle paper-grain texture.',
  },
  {
    id: 'agent-brand', name: 'Forest Portrait', category: 'realestate',
    mergedInto: 'services-tool-bench', mergedWhy: 'Same controlled studio light on a deep saturated backdrop with polished directional shadow',
    look: 'Studio portrait against a deep forest-green seamless backdrop, soft key light with clean controlled falloff, crisp white and warm brass accents, polished matte finish, medium-high contrast, confident centred framing, sharp professional retouch.',
    subject: 'A well-dressed professional with arms folded, holding a brass key on a leather fob',
    lettering: 'Main title in tall condensed sans-serif capitals, tight tracking, warm brass foil fill with a thin white keyline. Secondary text in small letterspaced uppercase.',
    scene: 'Confident agent-brand portrait. A well-dressed real estate professional, arms folded, standing in a bright studio against a deep forest-green seamless backdrop, soft key light with clean falloff, crisp white shirt, a single brass key on a leather fob in hand, polished matte finish.',
  },
  {
    id: 'acreage', name: 'Muted Film Calm', category: 'realestate',
    family: 'photo-cinematic',
    look: 'Elevated wide photographic view under a big overcast sky, soft diffused daylight with no hard shadow. Muted natural palette of sage, wheat and weathered grey-brown, low saturation, gentle film grain, generous horizon-led space, calm documentary realism.',
    subject: 'Open countryside parcel, rolling grass fields, weathered split-rail fence, distant treeline.',
    lettering: 'Main title in a sturdy slab serif with slightly rounded corners, earthy cream fill, embossed letterpress texture. Details in a plain typewriter-style mono.',
    scene: 'Wide open countryside parcel. Rolling grass fields in sage and wheat tones, a weathered split-rail fence line, distant treeline, big overcast sky with soft diffused daylight, elevated drone-height perspective, natural muted colour, gentle film grain.',
  },
  {
    id: 'yoga-calm', name: 'Linen Hush', category: 'fitness',
    mergedInto: 'sale-spring-pastel', mergedWhy: 'Same soft diffused daylight interior, sand-and-sage low contrast, thin airy serif',
    look: 'Soft diffused low-angle daylight through sheer fabric, long gentle shadows, matte airy finish. Palette of sand, sage and warm off-white with pale oak warmth, very low contrast, wide empty breathing room, serene and still, no gloss.',
    subject: 'A calm figure mid-stretch in a bright studio with pale oak floor and linen curtains.',
    lettering: 'Main title in a light airy serif, thin strokes, wide letter-spacing, all lowercase, no effects, soft ink-grey printed on cream.',
    scene: 'Serene sunrise yoga studio. Pale oak floor, sheer linen curtains, soft diffused daylight, a calm figure mid-stretch, palette of sand, sage and warm off-white, matte airy finish, long soft shadows and generous stillness.',
  },
  {
    id: 'boxing-ring', name: 'Wood Type Ink', category: 'fitness',
    mergedInto: 'business-woodtype-hiring', mergedWhy: 'Same heavy-ink wood-type press look, just a mustard sheet instead of cream',
    look: 'Vintage letterpress on thick uncoated mustard-ochre stock with visible fibre. One heavy black ink pass, coarse halftone dots, rough screenprint marks, ink bleed at the edges, faded and lightly foxed, flat matte, hard two-tone contrast, no photography.',
    subject: 'A boxer\'s taped gloves.',
    lettering: 'Main title in fat slab-serif wood-type capitals, ink pressed unevenly so strokes break up, tight leading, a thick black rule above and below.',
    scene: 'Vintage letterpress fight poster. Thick uncoated mustard-ochre paper with visible fibre, one heavy black ink pass, coarse halftone dots, a boxer\'s taped gloves rendered in rough screenprint, ink bleed at the edges, faded and slightly foxed, flat matte print — no photography.',
  },
  {
    id: 'faith-gathering', name: 'Amber Sanctum', category: 'community',
    mergedInto: 'music-jazz-cellar', mergedWhy: 'Same warm dusty light beams in an interior with honey palette and fine film grain',
    look: 'Long dusty light beams slanting through tall glass into a warm interior, dust motes hanging in the air, reverent amber glow. Palette of honey oak, cream plaster and soft gold, warm highlights against gentle shadow, fine film grain, calm and elevated.',
    subject: 'A congregation standing together in a sunlit sanctuary with stained glass and oak pews.',
    lettering: 'Main title in a warm humanist serif with slightly rounded terminals and a soft letterpress emboss, wide letterspacing, thin gold hairline rule under the baseline.',
    scene: 'Sunlit sanctuary interior. Long dusty light beams slant through tall stained glass, honey-toned oak pews, cream plaster walls, a congregation standing together, dust motes hanging in the air, soft reverent amber glow, fine film grain.',
  },
  {
    id: 'bake-sale', name: 'Gingham Candy', category: 'community',
    family: 'playful-cartoon',
    look: 'Flat bright midday sun with crisp candy-bright finish, no moody shadow. Pastel palette of strawberry pink, lemon yellow and mint over red and white checks, high cheer and high clarity, chunky friendly shapes, flat colour rather than gradient, busy but tidy.',
    subject: 'An outdoor table of cupcakes and cookies under glass domes with paper bunting overhead.',
    lettering: 'Main title in a chunky rounded sans, extra bold, thick white outline plus a second mint offset outline, flat soft drop shadow, no gradient — friendly and sugary.',
    scene: 'Cheerful outdoor bake sale table. Red and white gingham cloth, glass domes over cupcakes and cookies, triangular paper bunting strung overhead, flat bright midday sun, pastel palette of strawberry pink, lemon yellow and mint, crisp candy-bright finish.',
  },
  {
    id: 'festival-day', name: 'Sun Haze Pop', category: 'music',
    mergedInto: 'openhouse', mergedWhy: 'Same late golden sun with warm sky-and-green palette and punchy sharp finish',
    look: 'Golden late-afternoon sun with drifting dust haze and lens flare, punchy saturated photographic finish. Palette of sky blue, sun yellow and warm green, wide open composition, high energy, crisp glossy highlights, strong colour separation.',
    subject: 'A grass field, a crowd with hands up, a scaffold stage under open sky.',
    lettering: 'Main title in inflated glossy sans-serif capitals with a rounded 3D extrude, a yellow-to-orange gradient face and a crisp white keyline. Supporting text in plain bold sans.',
    scene: 'Outdoor daytime music festival. Wide grass field, a crowd with hands up, a scaffold stage under an open sky, golden late-afternoon sun and drifting dust haze, palette of sky blue, sun yellow and warm green, punchy saturated photographic finish.',
  },
  {
    id: 'gospel-night', name: 'Violet Gold Lightfall', category: 'music',
    family: 'elegant-script',
    look: 'Warm light shafts cutting through coloured glass into a dim interior, gentle bloom around highlights. Palette of deep purple, warm gold and ivory, rich shadow with glowing centre, soft filmic grain, uplifting and reverent, smooth rather than gritty.',
    subject: 'A robed choir mid-song inside a hall with stained glass.',
    lettering: 'Main title in a flowing hand-lettered script with a soft gold gradient and a thin ivory outline. Supporting text in a small-caps serif with wide letter spacing.',
    scene: 'Uplifting gospel and worship night. A robed choir mid-song inside a church hall, light shafts falling through stained glass, palette of deep purple, warm gold and ivory, gentle glow, reverent and joyful, soft filmic grain.',
  },
  {
    id: 'open-mic', name: 'Muted Two-Ink Riso', category: 'music',
    family: 'halftone-print',
    look: 'Two-ink riso print on textured cream paper stock with visible fibre. Burnt orange and slate blue only, grainy halftone screens, slight ink misregistration, one warm pooled light source, flat matte finish, intimate and small-scale, quietly worn.',
    subject: 'A single stool, an acoustic guitar and a vintage microphone in a small room.',
    lettering: 'Main title in tall wooden-type letterpress capitals with worn edges and visible ink misregistration. Supporting text in a small typewriter monospace face.',
    scene: 'Intimate acoustic open-mic night. A single stool, an acoustic guitar and a vintage microphone in a small room, one warm lamp, textured cream paper stock with visible fibre, two-ink riso print look in burnt orange and slate blue, grainy halftone.',
  },
  {
    id: 'business-early-start', name: 'Cool Glass Blue', category: 'business',
    family: 'clean-corporate',
    look: 'Wide elevated dawn shot, cool steel blue and pale silver, mist drifting through the frame, first sun catching a single hard edge. Crisp digital capture, matte finish, calm and spacious, minimal colour, very restrained contrast, lots of empty air.',
    subject: 'A glass office district seen from a rooftop.',
    lettering: 'Main title in thin uppercase sans-serif with very wide letter spacing, pale silver, razor-sharp edges. Supporting text in small light grey capitals.',
    scene: 'Dawn over a glass office district, shot wide from a rooftop. Cool steel blue and pale silver, mist drifting between towers, first sun catching one edge of glass. Crisp digital capture, calm and spacious, matte finish.',
  },
  {
    id: 'business-now-hiring', name: 'Soft Daylight Pastel', category: 'business',
    family: 'clean-corporate',
    look: 'Bright even midday daylight through tall windows, low contrast pastel grade, clean digital capture with no grain. Palette of white, warm oak and soft sage green, friendly and open, soft natural shadow, uncluttered and modern.',
    subject: 'An open-plan office with oak desks, potted greenery and a mixed team mid-conversation.',
    lettering: 'Main title in friendly rounded bold sans-serif capitals in coral, thick even strokes, no effects. Supporting text in medium-weight rounded sans, charcoal.',
    scene: 'Bright open-plan office at midday, tall windows, oak desks, potted greenery, a friendly mixed team mid-conversation. White, warm oak and soft sage green, airy daylight, pastel grade, low contrast, clean digital.',
  },
  {
    id: 'business-desk-flatlay', name: 'Linen Flat Lay', category: 'business',
    mergedInto: 'quiet-luxury-sale', mergedWhy: 'Same sand and ivory muted photography, diffused window light and fine letterspaced type',
    look: 'Overhead flat-lay on woven linen, soft diffused window light, gentle unbroken shadow. Sand and ivory palette with a single brass accent, matte paper texture, sparse tidy arrangement, quiet refinement, low contrast, plenty of negative space.',
    subject: 'Blank cream paper, a brass fountain pen, reading glasses, an espresso cup, a dried eucalyptus sprig.',
    lettering: 'Main title in fine-weight letterspaced capitals, ink black, quietly refined. Supporting text in small caps with a thin hairline rule feel and generous spacing.',
    scene: 'Overhead flat-lay on a linen-covered desk: blank cream paper, a brass fountain pen, folded reading glasses, a small espresso cup, one dried eucalyptus sprig. Soft diffused window light, sand and ivory palette, matte paper texture.',
  },
  {
    id: 'business-awards-night', name: 'Velvet Brass', category: 'business',
    family: 'dark-luxury',
    look: 'Low-key night interior, a narrow warm spotlight against deep falling shadow. Deep burgundy velvet, brass and near-black, glossy finish with soft specular highlights, candle-warm pools of light, high contrast, formal and expensive, richly minimal.',
    subject: 'A black-tie ballroom, round candlelit tables, an empty stage step.',
    lettering: 'Main title in engraved classical serif capitals with a brushed-gold foil fill and a fine inner shadow. Supporting text in small spaced serif capitals, cream.',
    scene: 'Black-tie ballroom at night. Deep burgundy velvet drapes, round tables lit by candles, a narrow warm spotlight falling on an empty stage step. Low-key moody light, deep shadow, burgundy, brass and near-black, glossy finish.',
  },
  {
    id: 'business-webinar-live', name: 'LED Bloom', category: 'business',
    mergedInto: 'neonclub', mergedWhy: 'Dark room lit only by teal/magenta glow with bloom halos; same palette, letterforms and finish',
    look: 'Dark room lit only by screens and coloured LED strips, teal and magenta rim light, slight lens bloom around highlights. High contrast, clean digital capture, glowing edges against near-black, modern tech mood, tight and close.',
    subject: 'A tidy night desk, a ring light on a face turned to camera, monitor glow on the wall.',
    lettering: 'Main title in tight geometric sans capitals with a soft cyan neon glow and a thin magenta edge. Supporting text in condensed uppercase, cool white.',
    scene: 'Night home studio: a tidy desk, ring light on a face turned to camera, monitor glow washing the wall, teal and magenta LED strip behind. Dark room, high contrast, slight lens bloom, clean digital, modern tech mood.',
  },
  {
    id: 'business-industry', name: 'Safety Orange Daylight', category: 'business',
    family: 'bold-poster',
    look: 'Wide environmental lens, hard shafts of midday daylight with visible dust in the beams. Concrete grey, safety orange and gunmetal, documentary grade, gritty realistic texture, strong directional shadow, functional and heavy, no polish.',
    subject: 'A working warehouse with steel racking, stacked pallets and a forklift.',
    lettering: 'Main title in heavy condensed stencil capitals with a slight ink-spread edge, safety orange. Supporting text in blocky uppercase sans, gunmetal grey.',
    scene: 'Working warehouse at midday, wide environmental lens. Concrete floor, steel racking, stacked pallets and a forklift, hard shafts of daylight through high windows with dust in the beams. Concrete grey, safety orange, gunmetal, documentary grade.',
  },
  {
    id: 'business-riso-summit', name: 'Fluoro Coral Riso', category: 'business',
    family: 'halftone-print',
    look: 'Two-colour riso print on oatmeal paper. Fluorescent coral and deep teal only, flat simplified shapes with no modelling, ink slightly misregistered, visible paper tooth, grainy screen texture, matte finish, graphic and confident.',
    subject: 'Simplified figures around a long table under pendant lamps.',
    lettering: 'Main title in chunky geometric sans capitals printed in fluorescent coral with a teal offset shadow a millimetre off, ink mottling and soft edges. Support text in small typewriter mono.',
    scene: 'Two-colour riso print on oatmeal paper. Flat simplified figures around a long table under pendant lamps, printed in fluorescent coral and deep teal, ink slightly misregistered, visible paper tooth, grainy screen texture, matte finish.',
  },
  {
    id: 'business-woodtype-hiring', name: 'Oxblood Letterpress', category: 'business',
    family: 'retro-vintage',
    look: 'Letterpress broadside on thick cotton stock. Oxblood red and coal black inks on cream paper, carved wooden ornaments, thick rules and pointing-hand cuts, deep bite debossed into the sheet, ink slightly starved at the edges, 1890s print-shop texture, matte and tactile.',
    lettering: 'Enormous vintage wood-type capitals mixing slab and fat-face at different sizes, oxblood and black, ink-starved with visible wood grain and a debossed impression.',
    scene: 'Letterpress broadside on thick cotton stock. Carved wood ornaments, thick rules and pointing-hand cuts in oxblood red and coal black, deep bite pressing into cream paper, ink slightly starved at the edges, 1890s print-shop feel.',
  },
  {
    id: 'business-collage-network', name: 'Torn Paper Craft', category: 'business',
    mergedInto: 'community-street-party-paper', mergedWhy: 'Same matte construction paper, soft drop shadows and light ground; only slightly less saturated colours',
    look: 'Cut-paper collage. Torn and scissor-cut shapes in mustard, sage, terracotta and sky blue construction paper layered on off-white, soft real drop shadows under every layer, visible paper fibre at the tears, handmade matte craft finish, even soft light.',
    subject: 'A mingling crowd of people holding drink glasses',
    lettering: 'Title hand-cut from paper in soft rounded capitals with slightly wobbly scissor edges, casting a small shadow. Secondary text in neat handwritten pencil.',
    scene: 'Cut-paper collage. Torn and scissor-cut shapes of a mingling crowd holding glasses, built from mustard, sage, terracotta and sky-blue construction paper on off-white, soft real drop shadows under each layer, handmade matte craft finish.',
  },
  {
    id: 'business-midcentury-awards', name: 'Champagne Litho', category: 'business',
    mergedInto: 'community-parade-litho', mergedWhy: 'Flat limited-palette mid-century litho with print speckle; a palette change only',
    look: 'Mid-century lithograph poster. Flat planes of champagne gold, ink navy and warm ivory, strictly limited spot colours, stylised simplified figures and shapes, fine texture speckle across the print, elegant 1959 travel-poster mood, matte litho finish, calm and refined.',
    subject: 'Figures in evening dress beside a ribboned trophy',
    lettering: 'Elegant high-contrast modern serif capitals in champagne gold, wide letterspacing, hairline thin strokes, printed flat with a faint litho speckle.',
    scene: 'Mid-century lithograph poster. Stylised figures in evening dress beside a ribboned trophy shape, flat planes of champagne gold, ink navy and warm ivory, limited spot colours, fine texture speckle, elegant 1959 travel-poster mood, matte litho finish.',
  },
  {
    id: 'business-blueprint-consult', name: 'Prussian Draft', category: 'business',
    mergedInto: 'sale-blueprint', mergedWhy: 'Both are Prussian blue with white thin-line drafting, a faint measuring grid, dimension arrows, uniform strokes and a flat matte finish, lettered in white drafting-stencil capitals. The differences are objects — a coffee ring, compass arcs — which is precisely the half we just separated out.',
    look: 'Technical drafting on blueprint paper. White ink line drawing over a Prussian blue ground, faint measuring grid, dimension arrows and compass arcs, uniform thin strokes, no shading, cool precise and analytical, flat drafting-paper finish.',
    subject: 'Gears, node diagrams and a rising bar chart',
    lettering: 'Title in white drafting stencil capitals, thin uniform strokes, wide tracking, with a fine underline rule. Support text in small engineer hand-lettering.',
    scene: 'Technical drafting on blueprint paper. White ink line drawing of gears, node diagrams and a rising bar chart over Prussian blue ground, faint grid, dimension arrows and compass arcs, cool and precise, flat drafting-paper finish.',
  },
  {
    id: 'business-embroidery-team', name: 'Stitched Felt', category: 'business',
    mergedInto: 'sale-stitched', mergedWhy: 'Same satin-stitch-on-felt patch with merrowed border and chain-stitch outlines',
    look: 'Embroidered patch on heather-grey wool felt. Satin stitch in forest green, cream and burnt orange, visible thread direction catching the light, raised merrowed border, chain-stitch detailing, tactile craft texture, soft even studio light.',
    subject: 'A handshake and pennant motif',
    lettering: 'Title in thick satin-stitch script with raised glossy thread and visible needle direction, edged in cream chain stitch. Smaller words in flat cross-stitch capitals.',
    scene: 'Embroidered patch on heather-grey wool felt. Satin-stitch handshake and pennant motifs in forest green, cream and burnt orange, visible thread direction, raised merrowed border, chain-stitch details, tactile craft look, soft studio light.',
  },
  {
    id: 'business-halftone-webinar', name: 'Benday Pulp', category: 'business',
    mergedInto: 'sale-comic-blast', mergedWhy: 'Same Ben-Day dot comic panel with speed lines, starburst and outlined comic capitals',
    look: 'Halftone comic panel. Bold black ink outlines, exaggerated perspective, benday dot shading in cyan and hot pink over yellow, speed lines and a starburst burst, pulpy 1960s newsprint texture with slight misregistration, loud and punchy.',
    subject: 'A presenter gesturing at a chart',
    lettering: 'Title in inflated comic capitals with a thick black outline, yellow fill and a hot-pink drop shadow, slight tilt and a hand-inked wobble.',
    scene: 'Halftone comic-book panel. Bold black ink outlines of a presenter gesturing at a chart, exaggerated perspective, benday dot shading in cyan and hot pink over yellow, speed lines and a starburst, pulpy 1960s newsprint texture.',
  },
  {
    id: 'business-swiss-grid', name: 'Vermilion Grid', category: 'business',
    mergedInto: 'sale-swiss-grid', mergedWhy: 'Same white field, vermilion rectangle, hairline column grid and tight grotesque type',
    look: 'International-style graphic panel. Flat warm white paper field split by a strict column grid of hairline black rules, one saturated vermilion rectangle anchoring the lower third, a single thin diagonal bar, generous empty space, even flat light, matte print finish.',
    lettering: 'Main title in tight lowercase grotesque sans, medium weight, very close letterspacing, flush left, flat black. Supporting text small, same family, light weight, wide tracking.',
    scene: 'International-style graphic panel. Flat warm white paper field divided by a strict column grid of hairline black rules, one saturated vermilion rectangle anchoring the lower third, a single thin diagonal bar, generous empty space, even flat light, matte print finish.',
  },
  {
    id: 'business-glass-stack', name: 'Frosted Glass', category: 'business',
    mergedInto: 'sale-glass-panel', mergedWhy: 'Same frosted panels, hairline white rims and white geometric sans, only a paler blue-mint gradient behind',
    look: 'Frosted translucent glass panels floating over a pale ice-blue to mint gradient, soft blurred lavender and peach light blooms behind them, hairline white panel edges, gentle inner glow, light drop shadows, bright airy ambient light, smooth digital sheen.',
    lettering: 'Main title in clean geometric sans, semi-bold, pure white with a faint outer glow. Supporting text light weight, translucent white, wide even tracking.',
    scene: 'Frosted glass panels floating over a pale ice-blue to mint gradient, soft blurred lavender and peach light blooms behind them, hairline white panel edges, gentle inner glow, light drop shadows, bright airy ambient light, smooth digital sheen.',
  },
  {
    id: 'business-concrete', name: 'Acid Concrete', category: 'business',
    family: 'grunge-street',
    look: 'Brutalist poster surface. Raw concrete grey ground with photocopy grain and toner speckle, oversized solid black rectangles butted edge to edge, one acid-yellow block off-centre, thick heavy borders, harsh flat scanner light, deliberately crude and unpolished.',
    lettering: 'Main title in extremely heavy condensed capitals cropped tight to the block, black on yellow, with xerox degradation on the edges. Supporting text in small typewriter mono.',
    scene: 'Brutalist poster surface. Raw concrete grey ground with photocopy grain and toner speckle, oversized solid black rectangles butted edge to edge, one acid-yellow block off-centre, thick heavy borders, harsh flat scanner light, deliberately crude and unpolished.',
  },
  {
    id: 'business-deco-brass', name: 'Midnight Brass', category: 'business',
    mergedInto: 'food-deco-supper', mergedWhy: 'Same symmetrical brass deco fans and stepped frames, only the ground colour shifts',
    look: 'Art-deco geometric panel. Deep midnight navy ground with symmetrical brass line fans, stepped ziggurat borders, thin concentric arcs and fluted column motifs, brushed-metal sheen on the gold, low warm side light, lacquered glossy finish, symmetrical and opulent.',
    lettering: 'Main title in high-contrast deco capitals with hairline serifs and a brass gradient fill, letters widely spaced. Supporting text in small engraved capitals between thin gold rules.',
    scene: 'Art-deco geometric panel. Deep midnight navy ground with symmetrical brass line fans, stepped ziggurat borders, thin concentric arcs and a fluted column motif, brushed-metal sheen on the gold, low warm side light, lacquered finish.',
  },
  {
    id: 'business-soft-clay', name: 'Matte Clay', category: 'business',
    mergedInto: 'services-clay-3d', mergedWhy: 'Same matte pastel clay render with extruded rounded 3D title lettering',
    look: 'Three-dimensional clay render. Rounded matte forms in pale mint, blush and cream floating on a soft beige backdrop, isometric arrangement, gentle studio light from upper left, long soft shadows, velvety no-gloss surfaces, calm and toylike.',
    subject: 'Stacked blocks, tubes and discs',
    lettering: 'Main title in rounded geometric sans, bold, extruded as a soft matte three-dimensional solid in cream with the same clay shading. Supporting text flat, medium weight, warm grey.',
    scene: 'Three-dimensional clay render. Rounded matte objects in pale mint, blush and cream floating on a soft beige backdrop, isometric arrangement of stacked blocks, tubes and discs, gentle studio light from upper left, long soft shadows, velvety no-gloss surfaces.',
  },
  {
    id: 'business-service-call', name: 'Bright Daylight', category: 'business',
    mergedInto: 'realestate-just-sold', mergedWhy: 'Same bright midday sun, saturated blue-sky glossy capture with hard short shadows',
    look: 'Crisp commercial photography in bright midday sun. High clarity, sharp blue sky, saturated greens, clean white and navy tones with hi-vis accents, natural hard sunlight and short shadows, wide open outdoor setting, honest and unfussy, glossy digital finish.',
    subject: 'A white work van with rear doors open, tool cases, coiled hose, a technician in navy workwear on a suburban driveway',
    lettering: 'Main title in bold italic condensed sans capitals, royal blue with a thin white outline and a hard drop shadow. Supporting text in solid uppercase sans, safety yellow.',
    scene: 'Bright suburban driveway at midday. A plain white work van with rear doors open, neat tool cases, coiled hose, a technician in clean navy workwear and hi-vis, sharp blue sky, green lawn edge, crisp commercial photography, high clarity, natural sun.',
  },
  {
    id: 'business-watercolour', name: 'Wet Wash', category: 'business',
    family: 'nature-organic',
    look: 'Loose watercolour on cold-pressed paper. Soft washes of blush, sage and ochre bleeding into one another, granulating pigment, a faint pencil under-sketch showing through the paint, white paper breathing at the edges, gentle daylight, quiet and airy.',
    subject: 'A handshake and a coffee cup sketched underneath',
    lettering: 'Main title in flowing brush-lettered script with tapering wet strokes and pigment pooling at the ends. Supporting text in a small even hand-drawn serif, sepia.',
    scene: 'Loose watercolour on cold-pressed paper. Soft washes of blush, sage and ochre bleeding into each other, a faint pencil under-sketch of a handshake and a coffee cup showing through, granulating pigment, white paper breathing at the edges, gentle daylight.',
  },
  {
    id: 'sale-grand-opening', name: 'Cherry High Key', category: 'sale',
    mergedInto: 'realestate-just-sold', mergedWhy: 'Same clean midday blue-sky photography with a hot red accent and glossy outlined caps',
    look: 'Wide clean digital capture in bright midday light. High-key exposure, cherry red and crisp white dominating with clear blue sky, small colour pops of green, sharp focus edge to edge, cheerful and open, glossy modern photographic finish.',
    subject: 'A storefront with white awning, satin ribbon across glass doors, paper confetti in the air, potted geraniums',
    lettering: 'Main title in tall rounded sans capitals, glossy cherry-red with a thin white keyline and a soft drop shadow. Supporting text in light grey sans-serif.',
    scene: 'Bright midday storefront on a city sidewalk. Clear blue sky, crisp white awning, a wide satin ribbon stretched across plain unmarked glass doors, paper confetti mid-air, potted geraniums on the step. Wide clean digital capture, high key, cherry-red and white.',
  },
  {
    id: 'sale-flash-neon', name: 'Wet Neon', category: 'sale',
    family: 'neon-night',
    look: 'Rain-slick night scene. Wet asphalt mirroring cyan and magenta neon tubes, curling steam, moody low-key exposure with deep crushed blacks, cinematic anamorphic flare, glossy reflective highlights, high contrast and electric.',
    subject: 'A shopper hurrying past on a city street with paper bags',
    lettering: 'Main title in italic heavy sans capitals with a glowing magenta neon-tube outline and a slight motion-blur streak. Supporting text in thin cyan uppercase.',
    scene: 'Rain-slick shopping street at night. Wet asphalt mirrors cyan and magenta neon tubes, steam curling from a grate, a shopper hurrying past with paper bags, moody low-key exposure, deep blacks, cinematic anamorphic flare, glossy reflective finish.',
  },
  {
    id: 'sale-warehouse-floor', name: 'Industrial Shaft', category: 'sale',
    family: 'photo-cinematic',
    look: 'Hard noon daylight shafting down through high skylights onto raw concrete and steel. Cool grey and safety-orange palette, deep shadows and blown highlights, wide industrial lens with slight distortion, high-contrast editorial photography, matte finish, gritty utilitarian mood.',
    subject: 'Concrete warehouse, steel pallet racks, unmarked cardboard cartons, a yellow forklift, painted floor stripes',
    lettering: 'Main title in heavy stencil capitals, safety-orange with chipped paint edges and a hard black shadow. Supporting text in narrow grey uppercase sans.',
    scene: 'Cavernous concrete warehouse at noon. Hard daylight shafts fall through roof skylights onto steel pallet racks, stacked unmarked cardboard cartons, a yellow forklift, safety-orange floor stripes. Wide industrial lens, high-contrast editorial, cool grey and orange, matte finish.',
  },
  {
    id: 'sale-spring-pastel', name: 'Diffused Daylight', category: 'sale',
    family: 'soft-pastel',
    look: 'Pale mint and peach palette with bone and blond-wood neutrals. Soft diffused low-angle light through sheer fabric, dust motes catching in the beam, very low contrast, gentle gradients, airy matte finish, generous empty space, calm and unhurried.',
    subject: 'Boutique interior, linen garments on a wood rail, tulips in a glass jar, sheer curtains',
    lettering: 'Main title in an airy high-waisted serif with fine hairlines, warm peach ink. Supporting text in widely letter-spaced light sans small capitals.',
    scene: 'Early dawn boutique interior. Pale mint walls, peach morning light through sheer curtains, linen garments on a blond wood rail, tulips in a glass jar, dust motes drifting. Soft diffusion, low contrast, airy matte finish.',
  },
  {
    id: 'sale-market-day', name: 'Sunbleached Canvas', category: 'sale',
    mergedInto: 'music-record-shop', mergedWhy: 'Both are sun-faded film photographs with lifted blacks and warm muted retro colour',
    look: 'Sun-bleached film stock with soft grain and lifted blacks. Red and cream stripes against warm dust-hazed gold, low sun raking from the side, relaxed mid-contrast, faded natural colour, casual candid framing, open-air warmth.',
    subject: 'Striped market awnings, trestle tables of second-hand wares, wicker baskets, leafy trees, browsing crowd',
    lettering: 'Main title in cheerful hand-painted brush capitals, cream with a leaf-green shadow and slight paint wobble. Supporting text in a friendly rounded sans.',
    scene: 'Open-air weekend market at mid-morning. Striped canvas awnings in red and cream, trestle tables of second-hand wares, wicker baskets, leafy trees behind, dust hanging in low golden sun. Sun-bleached film stock, soft grain, relaxed browsing crowd.',
  },
  {
    id: 'sale-coupon-kraft', name: 'Kraft Macro', category: 'sale',
    mergedInto: 'music-country-woodtype', mergedWhy: 'Same kraft stock, barn-red ink, chunky woodblock caps with deboss and ink squash',
    look: 'Tight macro under warm tungsten light. Brown kraft and faded red palette, visible paper fibre, torn corners and thumb smudges, very shallow depth of field, 35mm film grain, soft falloff to darkness, tactile handmade matte finish.',
    subject: 'Kraft paper tickets with perforated edges, steel scissors, a kitchen tabletop',
    lettering: 'Main title in chunky woodblock capitals with ink-bleed edges and slight letterpress deboss. Supporting text in a typewriter monospace, faded red.',
    scene: 'Tight macro on a kitchen table under a warm tungsten lamp. Kraft-paper tickets with perforated edges, steel scissors, a thumb smudge, visible paper fibre and torn corners, shallow depth of field, 35mm film grain, brown and faded-red.',
  },
  {
    id: 'sale-last-days', name: 'Amber Dusk', category: 'sale',
    mergedInto: 'music-jazz-cellar', mergedWhy: 'Same warm low-key interior with amber bulbs, sepia grain and nostalgic vignette',
    look: 'Moody warm low-key interior at dusk. Bare hanging bulbs throwing long amber shadows across a dusty plank floor, sepia-leaning film grain, soft vignette, crushed browns and chalk white, sparse and quiet, nostalgic end-of-day feel.',
    subject: 'Half-stripped shelves, stacked wooden crates, one folding table left behind',
    lettering: 'Main title in tall condensed slab capitals, chalk-white with dry brush texture and faint smudging. Supporting text in loose handwritten marker script.',
    scene: 'Emptying shop interior at dusk. Bare hanging bulbs, half-stripped shelves, stacked wooden crates, one folding table left behind, long amber shadows across a dusty plank floor. Sepia-leaning film grain, moody warm low-key, soft vignette.',
  },
  {
    id: 'sale-members-club', name: 'Burgundy Lounge', category: 'sale',
    mergedInto: 'business-awards-night', mergedWhy: 'Same burgundy-and-brass lamplit interior with engraved foil serif type',
    look: 'Rich low-key colour: deep burgundy, walnut brown, oxblood and cream. Amber lamps pooling warm pockets of light in darkness, portrait lens with shallow focus and creamy falloff, soft sheen on leather, editorial polish, refined and hushed.',
    subject: 'Panelled lounge with leather armchairs and a relaxed well-dressed group mid-conversation',
    lettering: 'Main title in an engraved high-contrast serif with fine copper-foil edges and a soft inner glow. Supporting text in cream small-caps sans, widely spaced.',
    scene: 'Evening members lounge. Deep burgundy walls, walnut panelling, amber table lamps pooling light, oxblood leather armchairs, a relaxed well-dressed group mid-conversation. Portrait lens, shallow focus, rich low-key colour, editorial polish, soft sheen on leather.',
  },
  {
    id: 'sale-riso-pop', name: 'Riso Duotone', category: 'sale',
    mergedInto: 'business-riso-summit', mergedWhy: 'Identical fluorescent orange-coral plus deep teal duotone with an offset teal shadow on chunky caps',
    look: 'Two-colour risograph print on off-white newsprint. Fluorescent orange and deep teal only, layers misregistered by a hair, coarse grain and roller smudge, chunky simplified flat shapes with thick arrows, flat matte ink, no gradients.',
    lettering: 'Main title in fat rounded seventies capitals, printed orange with a teal offset shadow slipped sideways. Supporting text in small grainy mono type.',
    scene: 'Two-colour risograph print on off-white newsprint. Fluorescent orange and deep teal only, deliberately misregistered by a hair, coarse grain and roller smudge. Chunky simplified shopping bags, tags and thick arrows, flat matte ink finish.',
  },
  {
    id: 'sale-wood-type', name: 'Press Bite', category: 'sale',
    mergedInto: 'business-woodtype-hiring', mergedWhy: 'Identical red-and-black letterpress broadside with slab wood type and press bite',
    look: 'Letterpress broadside pressed into thick cream cotton stock. Barn red and near-black ink only, visible bite of the press and block grain, hairline rules and small engraved cuts, matte slightly dented paper, dense stacked typographic layout.',
    lettering: 'Main title in tall condensed slab-serif wood type, heavy and slightly uneven, with visible ink bite and worn edges. Supporting text in wide-spaced small caps.',
    scene: 'Letterpress broadside pressed into thick cream cotton stock. Ink in barn red and near-black, edges showing the bite of the press and the grain of the blocks, hairline rules and small pointing-hand cuts. Matte, slightly dented paper.',
  },
  {
    id: 'sale-paper-cut', name: 'Hard Shadow Card', category: 'sale',
    family: 'collage-cutout',
    look: 'Layered cut-paper collage shot from above under hard raking light. Navy, rust, ochre and bone card on a slate-grey ground, crisp scissor edges, thick cast shadows giving real depth, matte fibre texture, bold simplified shapes.',
    subject: 'Paper tags, coins and a folded bag',
    lettering: 'Main title cut from card by hand, chunky rounded shapes in bone with visible scissor nicks and long hard shadows. Supporting text in neat lowercase sans.',
    scene: 'Cut-paper collage shot from above under hard raking light. Layered card in navy, rust, ochre and bone on a slate-grey ground, crisp scissor edges, thick cast shadows, simple paper tags, coins and a folded bag. Matte fibre texture.',
  },
  {
    id: 'sale-chalkboard', name: 'Slate Dust', category: 'sale',
    mergedInto: 'food-chalkboard-coffee', mergedWhy: 'Same white chalk with eraser smears and pastel accents on dark slate',
    look: 'Deep charcoal slate ground with faint eraser smears. White chalk line art with dusty soft-yellow and blush accents, ribbons, laurels, arrows and a scalloped border, warm shop light from the left, powdery matte finish, hand-made and friendly.',
    lettering: 'Main title hand-lettered in chalk: bouncy brush script with thick downstrokes, dusty edges and a doubled outline. Supporting text in narrow chalk capitals.',
    scene: 'Hand-drawn chalkboard, deep charcoal slate with faint eraser smears. White chalk line art of ribbons, laurels, arrows and a scalloped border, dusty accents in soft yellow and blush. Warm shop light from the left, powdery matte finish.',
  },
  {
    id: 'sale-blueprint', name: 'Prussian Draft', category: 'sale',
    family: 'minimal-type',
    look: 'Cyanotype blueprint sheet. Prussian-blue ground with a faint white graph grid, precise thin white line drawings and dimension arrows, one coffee-ring stain, flat matte finish under even light, cool monochrome, technical and orderly.',
    subject: 'Line-drawn boxes, tags and gears',
    lettering: 'Main title in drafting-stencil capitals, thin uniform white strokes with ticked corners and wide spacing. Supporting text in small white engineering monospace.',
    scene: 'Cyanotype blueprint sheet. Prussian-blue drafting paper with a faint white graph grid, precise white line drawings of boxes, tags, gears and dimension arrows, a coffee-ring stain in one corner, flat matte finish under even light.',
  },
  {
    id: 'sale-comic-blast', name: 'Ben-Day Pulp Comic', category: 'sale',
    family: 'halftone-print',
    look: 'Vintage pulp comic page. Loud primary red, cyan and yellow over visible Ben-Day dot screens, thick black ink outlines, speed lines and a jagged explosion burst, slight off-register colour on yellowed newsprint, flat high-energy finish.',
    lettering: 'Main title in bold italic comic capitals with thick black outline, white inline and a hard yellow drop shadow, tilted. Supporting text in hand-inked comic caps.',
    scene: 'Vintage comic-book page in halftone. Loud primary red, cyan and yellow over visible Ben-Day dot screens, thick black ink outlines, speed lines and a jagged explosion burst. Slight off-register colour on yellowed newsprint, flat pulp finish.',
  },
  {
    id: 'sale-stitched', name: 'Stitched Floss', category: 'sale',
    family: 'hand-drawn',
    look: 'Embroidered textile flat lay. Oatmeal and denim-blue felt with satin-stitch shapes in tomato red and cream, merrowed borders, French knots and a running-stitch frame, soft raking daylight raising every thread, fuzzy matte finish, cosy and crafted.',
    lettering: 'Main title embroidered in raised satin-stitch varsity capitals with a chain-stitch outline. Supporting text in fine back-stitch lowercase, thread slightly uneven.',
    scene: 'Embroidered textile flat lay. Felt in oatmeal and denim blue with satin-stitch shapes in tomato red and cream, merrowed patch borders, French knots and a running-stitch frame. Soft raking daylight raises every thread, fuzzy matte finish.',
  },
  {
    id: 'sale-swiss-grid', name: 'Red Block Grid', category: 'sale',
    family: 'minimal-type',
    look: 'Flat Swiss poster graphic. Pure white field, one enormous red rectangle anchored off-centre, thin black rules dividing a strict column grid, generous empty space, matte offset-print finish, cool even light, no photography, severe and confident.',
    lettering: 'Tight grotesque sans in black and red, flush left, very tight tracking, mixed light to extra-bold weights, no effects, crisp ink edges.',
    scene: 'Flat Swiss poster graphic. Pure white paper field, one enormous red rectangle anchored off-centre, thin black rule lines dividing a strict column grid, generous empty space, matte offset-print finish, cool even light, no photography.',
  },
  {
    id: 'sale-clay-3d', name: 'Clay Pop', category: 'sale',
    family: 'playful-cartoon',
    look: 'Soft 3D clay render. Rounded matte forms in bubblegum pink, butter yellow and mint on a pale peach backdrop, soft global-illumination light with gentle contact shadows, no hard edges, toy-like tactile finish, cheerful and weightless.',
    subject: 'Floating balloons and thick chunky arrows',
    lettering: 'Chunky rounded 3D extruded letters in matte clay, soft bevelled corners, gentle drop shadow, cream face with a pink side wall.',
    scene: 'Soft 3D clay render. Rounded matte shapes in bubblegum pink, butter yellow and mint, floating balloons and thick chunky arrows, soft global-illumination light with gentle contact shadows on a pale peach backdrop, toy-like finish.',
  },
  {
    id: 'sale-memphis', name: 'Confetti Geometry', category: 'sale',
    family: 'playful-cartoon',
    look: 'Postmodern graphic play. Cream ground scattered with squiggles, loose triangles and black-and-white checkerboard strips in tomato red, cobalt and turmeric yellow. Deliberately asymmetric placement, flat vector fills with no shading, crisp edges, bright even daylight, high-energy but uncluttered.',
    lettering: 'Fat geometric sans capitals in cobalt with a tomato-red offset shadow layer, slight tilt, dotted halftone infill on select letters.',
    scene: 'Postmodern Memphis graphic. Cream background scattered with squiggles, confetti triangles and black-and-white checkerboard strips in tomato red, cobalt and turmeric yellow, playful asymmetry, flat vector finish, bright even daylight.',
  },
  {
    id: 'sale-glass-panel', name: 'Frosted Glass', category: 'sale',
    family: 'gradient-modern',
    look: 'Glassmorphism build. Frosted translucent rounded panels stacked over a blurred violet-to-teal gradient mesh, faint white edge highlights along every panel rim, soft light leaks, tiny floating spheres, airy weightless depth, polished digital finish, low contrast and calm.',
    lettering: 'Thin-to-medium geometric sans in white, slight letter-spacing, soft glass blur behind, delicate hairline underline, subtle inner glow.',
    scene: 'Glassmorphism graphic. Frosted translucent rounded panels stacked over a blurred violet-to-teal gradient mesh, faint white edge highlights, soft light leaks, tiny floating spheres, airy weightless mood, polished digital finish.',
  },
  {
    id: 'sale-brutalist', name: 'Toner Slab', category: 'sale',
    mergedInto: 'business-concrete', mergedWhy: 'Identical concrete-grey xerox poster with black blocks and one acid highlight colour',
    look: 'Brutalist photocopy poster. Raw concrete-grey field carrying heavy toner grain, thick black boxed borders, safety-orange highlight bars, torn tape strips and hard flat drop shadows. Deliberately crude spacing, blown-out darks, matte xerox finish under flat unmodulated light.',
    lettering: 'Oversized monospace mixed with heavy grotesque, black on orange highlight blocks, underlined, some letters knocked out of solid boxes, rough toner edges.',
    scene: 'Brutalist photocopy poster. Raw concrete-grey field with heavy toner grain, black boxed borders, safety-orange highlight bars, torn tape strips, hard flat shadows, deliberately crude spacing, matte xerox finish under flat light.',
  },
  {
    id: 'sale-deco-lines', name: 'Platinum Deco', category: 'sale',
    mergedInto: 'nightlife-deco-gold', mergedWhy: 'Deco sunburst rays and inline capitals on a midnight ground; platinum vs gold is one metal swap',
    look: 'Geometric deco graphic. Midnight-navy field ruled with fine platinum sunburst rays, stepped fan arches and slim concentric circles, strict mirror symmetry, a soft directional sheen travelling across the metal lines, velvet matte ground, 1920s printed-poster finish.',
    lettering: 'High-waisted deco display capitals in brushed platinum with thin inline stripes, wide letter spacing, small hairline serifs, subtle cool sheen.',
    scene: 'Art-deco geometric graphic. Midnight-navy field with fine platinum sunburst rays, stepped fan arches and slim concentric circles, strict symmetry, soft directional sheen across the metal lines, velvet matte ground, 1920s printed-poster finish.',
  },
  {
    id: 'food-late-night-diner', name: 'Wet Neon Chrome', category: 'food',
    mergedInto: 'sale-flash-neon', mergedWhy: 'Rain-slick night with neon bouncing off wet glass and chrome — identical wet, glossy, high-contrast finish',
    look: 'Rain-slick night photography. Magenta and cyan neon tubing bouncing off chrome trim and wet glass, deep blue shadows swallowing the edges, one hard tabletop key light, saturated colour, very high contrast, glossy wet finish, reflections everywhere.',
    subject: 'A roadside diner booth after midnight, stacked burger and fries, rain-soaked asphalt outside.',
    lettering: 'Main title in glowing neon-tube script with a soft pink halo and thin cyan outline. Supporting text in tight condensed uppercase sans-serif.',
    scene: 'Roadside diner booth after midnight. Rain-slick asphalt outside, magenta and cyan neon tubing reflecting off chrome trim and glass, a stacked burger and fries under hard tabletop light, deep blue shadows, high-contrast photography, wet glossy finish.',
  },
  {
    id: 'food-morning-bakery', name: 'Dawn Flour Light', category: 'food',
    mergedInto: 'rustic-kitchen', mergedWhy: 'Same muted warm-neutral bench-top scene in soft natural light with hand-drawn serif and film grain',
    look: 'Low dawn sunbeam raking across a workbench, fine dust drifting through the light. Oat, cream and burnt caramel palette, scorched steel surfaces, tight macro lens with shallow focus, warm 35mm film grain, gentle contrast, matte finish, quiet and unhurried.',
    subject: 'A bakery bench with torn sourdough crust and butter croissants on steel trays.',
    lettering: 'Main title in a warm hand-drawn serif with slightly uneven ink weight and soft edges. Supporting text in letterspaced small capitals, thin sans-serif.',
    scene: 'Bakery bench at first light. Flour dust drifting through a low dawn sunbeam, torn sourdough crust and butter croissants on scorched steel trays, oat, cream and burnt caramel palette, tight macro lens, warm 35mm film grain, matte finish.',
  },
  {
    id: 'food-brunch-table', name: 'Marble Flat Lay', category: 'food',
    mergedInto: 'sale-spring-pastel', mergedWhy: 'Same soft window daylight pastel photography and hairline serif; only the camera angle changes',
    look: 'Straight overhead flat-lay on pale marble at midday. Soft diffused window daylight with almost no shadow, pastel mint and blush palette, linen and brass accents, generous negative space, clean tidy arrangement, airy bright finish, low contrast.',
    subject: 'A brunch spread: poached eggs, halved avocado, berries, iced glasses, napkin and cutlery.',
    lettering: 'Main title in a light modern serif with high-contrast thick-thin strokes and generous letterspacing. Supporting text in hairline sans-serif capitals.',
    scene: 'Overhead brunch spread on pale marble at midday. Poached eggs, halved avocado, berries, iced glasses, linen napkin and brass cutlery, soft diffused window daylight, pastel mint and blush palette, clean flat-lay, airy bright finish.',
  },
  {
    id: 'food-smokehouse', name: 'Ember Noir', category: 'food',
    family: 'photo-cinematic',
    look: 'Thick drifting smoke lit orange from below by open coals, embers rising through the frame. Charcoal-black and ember-orange palette, blackened steel textures with a wet glisten, wide environmental lens, moody low-key contrast, rich matte finish, dusk atmosphere.',
    subject: 'A barbecue pit with brisket and ribs on steel grates over coals.',
    lettering: 'Main title in heavy rough-cut carved wooden capitals with charred edges and a burnt orange inner glow. Supporting text in sturdy slab-serif, all caps.',
    scene: 'Barbecue pit at dusk. Thick woodsmoke lit orange by open coals, glistening bark on brisket and ribs, blackened steel grates, embers rising, charcoal-black and ember-orange palette, wide environmental lens, moody low-key contrast, rich matte finish.',
  },
  {
    id: 'food-coffee-house', name: 'Tungsten Rain', category: 'food',
    mergedInto: 'music-jazz-cellar', mergedWhy: 'Same warm tungsten low-key interior, espresso palette and soft cinematic intimacy',
    look: 'Warm tungsten lamplight on brass and dark walnut, a fogged window with blurred lights beyond. Espresso-brown and honey palette, rising steam catching the light, portrait lens with creamy background blur, soft cinematic low-key finish, intimate and warm.',
    subject: 'A small coffee bar on a rainy evening, a poured flat white steaming.',
    lettering: 'Main title in a rounded lowercase script with a smooth painted finish and gentle drop shadow. Supporting text in friendly geometric sans-serif, medium weight.',
    scene: 'Small coffee bar on a rainy evening. Warm tungsten lamplight on brass and dark walnut, steam curling off a poured flat white, fogged window and blurred street lights beyond, espresso-brown and honey palette, portrait lens, soft cinematic low-key finish.',
  },
  {
    id: 'food-market-fresh', name: 'Noon Saturation', category: 'food',
    mergedInto: 'realestate-just-sold', mergedWhy: 'Same hard overhead sunlight, punchy saturation and thick-outlined rounded caps',
    look: 'Crisp white overhead sunlight, hard clean shadows, saturated green-red-yellow palette. Striped canvas, woven texture and worn timber surfaces, wide editorial lens, sharp digital capture, punchy contrast, everything vivid and busy, open-air daylight.',
    subject: 'An open-air produce market: crates of tomatoes, lemons, chard and radishes under awnings.',
    lettering: 'Main title in bold rounded sans-serif capitals with a thick white outline and flat colour fill. Supporting text in wide-tracked uppercase sans-serif.',
    scene: 'Open-air produce market at high noon. Crates of tomatoes, lemons, chard and radishes under crisp white sunlight, striped canvas awnings, woven baskets and worn wooden stalls, saturated green-red-yellow palette, wide editorial lens, sharp digital, punchy contrast.',
  },
  {
    id: 'food-wine-cellar', name: 'Candlelit Chiaroscuro', category: 'food',
    family: 'dark-luxury',
    look: 'Single candle flame as the only light, everything falling into deep shadow. Burgundy, slate and antique gold palette, damp stone and aged oak textures, portrait lens, extreme chiaroscuro contrast, painterly low-light finish, hushed and old-world.',
    subject: 'A stone cellar at night: poured red glasses on dark oak, aged barrels behind.',
    lettering: 'Main title in an elegant engraved serif with fine hairline flourishes and a soft antique gold foil sheen. Supporting text in small letterspaced roman capitals.',
    scene: 'Stone wine cellar at night. Candle flames on a dark oak table, poured red glasses catching the light, aged barrels and damp limestone walls in shadow, burgundy, slate and antique gold palette, portrait lens, deep chiaroscuro, painterly low-light finish.',
  },
  {
    id: 'food-sushi-slate', name: 'Ink Wash Slate', category: 'food',
    family: 'minimal-type',
    look: 'Extreme restraint. Charcoal slate stone, ash grey and warm oatmeal tones with one vermilion accent, vast empty space around a single small focal point, soft even overhead light, no harsh shadow, ink-wash calm, matte fine-art finish, very low visual noise.',
    subject: 'A quiet counter with sliced fish and rice and one bare branch.',
    lettering: 'Main title in fine vertical-stroke brush characters with dry-bristle texture and tapering ends. Supporting text in very light widely spaced sans-serif capitals.',
    scene: 'Quiet Japanese counter. Charcoal slate stone, a single bare branch, ash grey and warm oatmeal tones with one vermilion accent, sliced fish and rice set with wide empty space, soft even overhead light, ink-wash restraint, matte fine-art finish.',
  },
  {
    id: 'food-seafood-shack', name: 'Sea Glass Bright', category: 'food',
    mergedInto: 'services-bright-clean', mergedWhy: 'Same bright cool daylight, chalk white and pale blue, clean high-key finish',
    look: 'Bright cool coastal daylight, crushed ice glittering with tiny specular sparkles. Sea-glass blue and chalk white palette with navy accents, blue-and-white checked cloth, weathered pale timber, crisp midday light, clean high-key finish, fresh and breezy.',
    subject: 'A coastal counter with prawns, oysters and lemon halves on ice.',
    lettering: 'Main title in hand-painted signwriter capitals with a rope-twist inline and a navy shadow. Supporting text in a jaunty condensed serif with small painted swash tails.',
    scene: 'Coastal seafood counter at midday. Crushed ice glittering under bright sea light, prawns, oysters and lemon halves, blue-and-white checked cloth, weathered pale timber, sea-glass blue and chalk white palette, crisp daylight, cool clean bright finish.',
  },
  {
    id: 'food-riso-pizza', name: 'Riso Misprint', category: 'food',
    mergedInto: 'business-riso-summit', mergedWhy: 'Same fluorescent hot pink/orange duotone, chunky rounded caps, misregistered offset shadow and mono support text',
    look: 'Two-colour riso print. Fluorescent pink and warm orange ink laid on rough off-white paper, loose confident outline drawing, visible misregistration between the two plates, heavy paper grain and blotchy ink coverage, matte unvarnished finish, limited palette.',
    subject: 'A hand tossing dough and a wedge of pizza in loose outline.',
    lettering: 'Main title in chunky rounded sans capitals printed in fluorescent pink with a deliberately misregistered orange offset shadow. Supporting text in small typewriter mono.',
    scene: 'Two-colour riso print. Fluorescent pink and warm orange ink on rough off-white paper, a hand tossing dough and a wedge of pizza drawn in loose outlines, visible ink misregistration, grainy paper texture, matte unvarnished finish.',
  },
  {
    id: 'food-woodtype-bbq', name: 'Letterpress Broadside', category: 'food',
    mergedInto: 'business-woodtype-hiring', mergedWhy: 'Same cream-stock letterpress, black and red ink, ornaments and worn slab capitals',
    look: 'Letterpress on thick cotton stock. Antique wood-type ornaments and rules inked in soot black and brick red on a cream ground, deep visible bite pressed into the paper, flecked uneven ink, worn broken edges, matte tactile finish, dense old-broadside layout.',
    subject: 'A hog and a smoking grill rendered as inked engravings.',
    lettering: 'Main title in tall condensed slab wood type, ink-heavy with worn broken edges and deep press impression. Supporting text in narrow Victorian gothic capitals.',
    scene: 'Letterpress broadside on thick cotton stock. Antique wood-type ornaments, a hog and a smoking grill inked in soot black and brick red, deep visible bite into the paper, cream ground, flecked ink and worn edges, matte tactile finish.',
  },
  {
    id: 'food-watercolour-brunch', name: 'Wash Peach', category: 'food',
    mergedInto: 'services-watercolour', mergedWhy: 'Same loose cold-press washes with bare paper gaps and brush-script title',
    look: 'Loose watercolour illustration on cold-press paper. Soft peach, butter yellow and sage washes bleeding into one another, deliberate bare white paper gaps, granulating pigment edges, pale diffuse morning light, low contrast, airy uncrowded matte finish.',
    subject: 'A breakfast table of poached eggs, pastries and a jug of juice.',
    lettering: 'Main title in a fluid brush script with wet tapering strokes and slight pigment pooling. Supporting text in a light hand-lettered serif with irregular spacing.',
    scene: 'Loose watercolour illustration. Soft peach, butter yellow and sage washes on cold-press paper, a table of poached eggs, pastries and a jug of juice painted with bleeding edges and bare white paper gaps, pale morning light, airy matte finish.',
  },
  {
    id: 'food-chalkboard-coffee', name: 'Dusty Chalk', category: 'food',
    family: 'hand-drawn',
    look: 'Hand-drawn chalk on matte black slate. White and pale mint chalk line work, smudged eraser ghosts, dusty flourishes and blank ribbon banners, powdery grainy strokes, warm low ambient light, cosy medium contrast, no gloss anywhere.',
    subject: 'A pour-over cone, coffee beans and curls of steam.',
    lettering: 'Main title in ornate chalk script with thick-and-thin strokes and a doubled outline. Supporting text in blocky chalk capitals with sketchy hatched shading.',
    scene: 'Hand-drawn chalkboard. Matte black slate ground with white and pale mint chalk drawings of a pour-over cone, beans and steam curls, smudged eraser ghosts, dusty flourishes and blank ribbon banners, low warm cafe light, powdery chalk finish.',
  },
  {
    id: 'food-halftone-burger', name: 'Pulp Halftone', category: 'food',
    mergedInto: 'sale-comic-blast', mergedWhy: 'Newsprint comic halftone with black outlines, dot shading and inflated drop-shadowed comic caps',
    look: 'Halftone comic panel art. Bold black ink outlines with visible dot shading in cherry red, teal and mustard printed on newsprint-yellow paper, speed lines and starbursts, slight misregistration, busy high-energy layout, flat pulp-print finish with no gradients.',
    subject: 'A stacked burger and a milkshake.',
    lettering: 'Main title in inflated comic-book capitals with a thick black outline, dot-shaded fill and a hard offset drop shadow. Supporting text in inked comic hand lettering.',
    scene: 'Halftone comic panel art. Bold black ink outlines with visible dot shading in cherry red, teal and mustard on newsprint-yellow paper, a stacked burger and milkshake drawn with speed lines and starbursts, flat pulp-print finish.',
  },
  {
    id: 'food-tile-tapas', name: 'Glazed Ceramic Tile', category: 'food',
    family: 'hand-drawn',
    look: 'Painted ceramic tile panel. Cobalt blue brushwork on white glaze with ochre and terracotta accents, grout lines dividing the field into squares, visible brush pooling and glaze bleed, soft reflected light on a glossy fired surface.',
    subject: 'Olives, lemons and small serving plates.',
    lettering: 'Main title hand-painted in cobalt brush capitals with slight glaze bleed at the stroke ends. Supporting text in a small painted serif with painterly imperfections.',
    scene: 'Painted ceramic tile panel. Cobalt blue and white glazed tiles with hand-painted olives, lemons and small plates, ochre and terracotta accents, grout lines dividing the panel, glossy fired glaze catching soft reflected light.',
  },
  {
    id: 'food-swiss-grid', name: 'Swiss Grid', category: 'food',
    mergedInto: 'sale-swiss-grid', mergedWhy: 'Identical Swiss poster with a scarlet rectangle on flat white; only the photo crop differs',
    look: 'Swiss International poster design. Flat white paper field split by a strict modular grid, one enormous scarlet rectangle, hairline black rules, a single cropped duotone photograph, no gradients, no shadows, matte offset flatness, cool neutral daylight, generous empty space.',
    lettering: 'Main title in tight lowercase grotesque sans, heavy weight, very close letter spacing. Supporting text small and light with generous leading, pure black on white.',
    scene: 'Swiss International poster design. Flat white paper field split by a strict modular grid, one enormous scarlet rectangle, thin black rules, a single cropped duotone photograph of coffee and citrus, no gradients, no shadow, matte offset flatness, cool neutral daylight.',
  },
  {
    id: 'food-deco-supper', name: 'Brass Deco Panel', category: 'food',
    family: 'dark-luxury',
    look: 'Art-deco geometry. Deep emerald and oxblood panels over a lacquered black ground, fanned sunburst arcs and stepped chevrons in brushed brass, hairline gold pinstripe borders, perfectly mirrored symmetry, soft theatrical glow, rich enamel-and-metal finish.',
    lettering: 'Main title in high-contrast deco capitals with hairline serifs, wide letter spacing and a gold foil finish carrying a fine engraved inline stripe. Supporting text in small spaced capitals.',
    scene: 'Art-deco geometry. Deep emerald and oxblood panels, fanned sunburst arcs and stepped chevrons in brushed brass, thin gold pinstripe borders, symmetrical mirrored composition, lacquered black ground, soft theatrical glow, luxurious enamel-and-metal finish.',
  },
  {
    id: 'food-memphis-pop', name: 'Confetti Blocks', category: 'food',
    mergedInto: 'nightlife-memphis-pop', mergedWhy: 'Same Memphis confetti blocks, terrazzo speckle and bouncy offset-shadow capitals — only the sherbet wording differs.',
    look: 'Memphis postmodern playground. Sherbet pink, cyan, lemon and grape blocks with squiggles, confetti dashes and terrazzo speckle, tilted checkerboard bands, hard offset drop shadows, zero depth or shading, joyful chaotic balance, flat vinyl-sticker finish.',
    lettering: 'Main title in chunky rounded bouncy capitals, each letter slightly rotated, filled candy yellow and offset by a thick violet shadow. Supporting text in playful wide sans-serif.',
    scene: 'Memphis postmodern playground. Sherbet pink, cyan, lemon and grape blocks, squiggles, confetti dashes and terrazzo speckle, tilted checkerboard bands, hard drop shadows, no depth, joyful chaotic balance, flat vinyl-sticker finish.',
  },
  {
    id: 'food-clay-3d', name: 'Matte Clay', category: 'food',
    mergedInto: 'services-clay-3d', mergedWhy: 'Matte putty forms, warm sand against warm peach, long soft studio shadows, extruded rounded clay letters with a contact shadow. Sand versus peach is not a choice anybody makes.',
    look: 'Soft 3D clay render. Matte pastel putty forms modelled in dough-like material on a warm sand backdrop, rounded soft-cornered edges, gentle studio key light, long soft shadows, subtle ambient occlusion, tactile toy-like plasticine finish, calm and uncluttered.',
    subject: 'Utensils, bowls and cups.',
    lettering: 'Main title as extruded rounded 3D letters in matte pastel clay with thick soft-cornered strokes, gentle top light and a soft contact shadow. Supporting text in small rounded sans-serif.',
    scene: 'Soft 3D clay render. Matte pastel putty shapes on a warm sand backdrop, rounded utensils, bowls and cups modelled in dough-like material, gentle studio key light, long soft shadows, subtle ambient occlusion, tactile toy-like plasticine finish.',
  },
  {
    id: 'food-paper-feast', name: 'Ransom Scrap Collage', category: 'food',
    family: 'collage-cutout',
    look: 'Maximalist cut-paper collage. Torn magazine scraps, halftone newsprint fragments and sepia clippings layered over hot coral and mustard blocks, snipped scalloped edges, visible tape and staple marks, dense busy overlapping layers, tactile scrapbook finish.',
    lettering: 'Main title in mismatched ransom-note capitals cut from different papers, varying sizes and baselines, some inked by hand. Supporting text in typewriter face on a paper strip.',
    scene: 'Maximalist cut-paper collage. Torn magazine scraps, halftone newsprint fragments and sepia clippings layered over hot coral and mustard blocks, snipped scalloped edges, visible tape and staple marks, dense busy layering, tactile scrapbook finish.',
  },
  {
    id: 'food-icecream-sun', name: 'Sunbright Gloss', category: 'food',
    mergedInto: 'realestate-just-sold', mergedWhy: 'Same blazing overhead sun, hard black shadows and glossy high-saturation finish',
    look: 'Blazing overhead afternoon sun. Turquoise painted wall against deep blue sky, hard-edged black shadows, sherbet coral and mint accents, saturated slide-film colour, punchy contrast, glossy high-key photography with crisp specular highlights.',
    subject: 'Dripping ice cream cones with sprinkles held up to the sky.',
    lettering: 'Main title in fat glossy bubble capitals with a white highlight streak, thick cream outline and a hard turquoise cast shadow. Supporting text in bold rounded sans-serif.',
    scene: 'Summer ice-cream stop in blazing afternoon sun. Turquoise painted wall, hard-edged shadows, dripping cones and sprinkles held up against a deep blue sky, sherbet coral and mint accents, saturated slide-film colour, glossy high-key photography.',
  },
  {
    id: 'services-dawn-yard', name: 'Dew Light', category: 'services',
    mergedInto: 'openhouse', mergedWhy: 'Same low raking golden sun, long shadows and sharp clean daylight capture',
    look: 'First light photography. Low raking sun throwing long soft shadows, mist hanging in the middle distance, dew-green and pale gold palette, wide environmental framing, gentle contrast, clean sharp digital capture, calm open and unhurried.',
    subject: 'A freshly mown suburban lawn with striped mowing lines and a hedge line.',
    lettering: 'Main title in rounded heavy sans capitals, matte white with a soft drop shadow. Supporting text in a light humanist sans, generously letterspaced.',
    scene: 'First light over a freshly cut suburban lawn. Wet grass, long low shadows, mist hanging at the hedge line, striped mowing lines curving away. Wide environmental photograph, dew-green and pale gold, clean digital capture, crisp and calm.',
  },
  {
    id: 'services-night-call', name: 'Amber Rainfall', category: 'services',
    mergedInto: 'food-smokehouse', mergedWhy: 'Same near-black frame with hot amber pools, hard contrast and moody grade',
    look: 'Low-key night photography. Deep navy blacks with warm amber pools spilling across wet asphalt, a hard beam cutting through drizzle, cold blue reflections, glinting metal highlights, heavy contrast, moody cinematic grade with fine grain.',
    subject: 'A work van with open rear doors and tools on the tailgate, after dark.',
    lettering: 'Main title in bold condensed capitals, glowing amber with a subtle outer glow. Supporting text in clean uppercase sans, cool light grey.',
    scene: 'Emergency call-out after dark. A work van\'s open rear doors spill amber light across wet asphalt, a headlamp beam cutting through drizzle, tools glinting on the tailgate. Deep navy blacks with amber and cold blue reflections, moody low-key cinematic photography.',
  },
  {
    id: 'services-bright-clean', name: 'High Key Air', category: 'services',
    family: 'photo-cinematic',
    look: 'High-key mid-morning photography. Bright white base with sky blue and lemon accents, a hard shaft of sun full of drifting dust motes, glossy pale reflective floor, blown-out edges, minimal clutter, airy weightless clean digital capture.',
    subject: 'An empty sunlit room with bare windows, a bucket and folded cloths.',
    lettering: 'Main title in geometric bold sans capitals, sky blue with a crisp white keyline. Supporting text in medium-weight sans, tight and tidy.',
    scene: 'Sunlit empty room mid-morning. Bare windows, glossy pale floorboards, a bucket and folded cloths, dust motes drifting in a hard shaft of sun. High-key white, sky blue and lemon, clean digital photograph, airy blown-out edges.',
  },
  {
    id: 'services-tool-bench', name: 'Deep Studio Shadow', category: 'services',
    family: 'photo-cinematic',
    look: 'Overhead flat-lay photography on scarred dark walnut. Espresso brown with steel grey and oxblood accents, a single low side lamp raking across the surface, deep directional shadows, warm film grain, tight orderly arrangement, rich matte contrast.',
    subject: 'Wrenches, a torque driver, coiled cable, a stripped-open appliance, brass screws in a tin.',
    lettering: 'Main title in industrial slab-serif capitals, cream with a lightly worn stencil edge. Supporting text in monospaced uppercase, small and precise.',
    scene: 'Overhead flat-lay on a scarred walnut workbench. Wrenches, a torque driver, coiled cable, a stripped-open small appliance, brass screws in a tin. Single low lamp from one side, espresso brown with steel grey and oxblood, warm film grain.',
  },
  {
    id: 'services-porch-groom', name: 'Backlit Haze', category: 'services',
    family: 'photo-cinematic',
    look: 'Late afternoon portrait photography. Golden backlight flaring into the lens, cream, dusty rose and sun-gold palette, chipped painted timber and terracotta texture, long shallow-focus creamy blur, soft warm contrast, gentle film grain.',
    subject: 'A groomer kneeling mid-brush with a fluffy dog on a wooden porch by a screen door.',
    lettering: 'Main title in a friendly handwritten script with natural ink weight and a slight upward lilt. Supporting text in a soft rounded sans, sentence case.',
    scene: 'Late afternoon on a wooden porch. A groomer kneels with a fluffy dog mid-brush, golden backlight flaring through a screen door, chipped mint paint, terracotta pots. Cream, dusty rose and sun-gold, portrait lens with creamy blur, warm film grain.',
  },
  {
    id: 'services-roof-dusk', name: 'Silhouette Dusk', category: 'services',
    family: 'photo-cinematic',
    look: 'High-contrast editorial photography at last light. Slate grey and charcoal masses read almost as silhouette against a fiery violet and burnt-orange sky. Elevated wide vantage, long raking shadows, crisp sharp detail, dramatic tonal separation, cool foreground against a hot glowing backdrop.',
    subject: 'A shingled roofline, crew silhouettes on the ridge, an extension ladder, bare trees.',
    lettering: 'Main title in tall extended sans capitals, chalk white with a hard black offset shadow. Supporting text in thin uppercase sans, strictly aligned.',
    scene: 'Drone view over a shingled roofline at dusk. Crew silhouettes on the ridge, an extension ladder against the eave, violet and burnt-orange sky behind bare trees. Slate grey and charcoal against fiery sky, high-contrast editorial photography, sharp and dramatic.',
  },
  {
    id: 'services-marble-desk', name: 'Marble and Brass Serif', category: 'services',
    family: 'clean-corporate',
    look: 'Cool north-window daylight across polished white marble. Grey-white ground with deep navy and warm brass accents, restrained palette, sharp editorial photography, shallow calm composition, soft specular highlights on metal, generous empty surface, quiet and expensive.',
    subject: 'A brass fountain pen, folded reading glasses, a navy suit cuff, a stack of plain paper on a desk corner.',
    lettering: 'Main title in a stately transitional serif with fine bracketed serifs, deep navy. Supporting text in small-cap sans, widely tracked and understated.',
    scene: 'Corner of a polished white marble desk in a quiet office. A brass fountain pen, folded reading glasses, a navy suit cuff resting at the edge, a stack of plain paper. Cool north-window daylight, grey-white with navy and brass, sharp editorial photograph.',
  },
  {
    id: 'services-riso-yard', name: 'Riso Duotone', category: 'services',
    mergedInto: 'community-volunteer-riso', mergedWhy: 'Green-led two-ink riso on rough stock with rounded sans caps and a ghosted off-register edge',
    look: 'Two-colour riso screen print on oatmeal paper. Fluorescent green and warm ink-blue only, visible misregistration, grainy speckled ink texture, flat daylight with no shading, chunky simplified shapes, matte uncoated finish, cheerful and low-fi.',
    subject: 'A trimmed lawn, a hedge and a pruned tree.',
    lettering: 'Main title in chunky rounded geometric sans capitals printed in fluorescent green ink, slightly off-register with a soft blue ghost edge. Supporting text in small clean sans.',
    scene: 'Two-colour riso screen print of a trimmed lawn, hedge and pruned tree, printed in fluorescent green and warm ink-blue on oatmeal paper. Visible misregistration, grainy ink texture, flat daylight, no shading, matte uncoated finish.',
  },
  {
    id: 'services-press-sheet', name: 'Indigo Letterpress', category: 'services',
    mergedInto: 'business-woodtype-hiring', mergedWhy: 'Same debossed cream broadside; indigo instead of oxblood is only an ink swap',
    look: 'Letterpress broadside on thick cotton stock with a deep bite into the paper. Indigo and coal black ink on natural cream, rule lines and printer\'s ornaments, ink smudge, visible paper fibre, tactile debossed finish, hand-set and slightly imperfect.',
    subject: 'Pipe wrenches, a spirit level and hand tools.',
    lettering: 'Main title in tall wooden slab-serif capitals with visible ink squeeze and worn broken edges, pressed deep into the sheet. Supporting text in narrow spurred grotesque.',
    scene: 'Letterpress broadside on thick cotton stock with a deep bite into the paper. Pipe wrenches, a spirit level and hand tools inked in indigo and coal black, plus rule lines and printer\'s ornaments. Ink smudge, visible fibre, tactile debossed finish.',
  },
  {
    id: 'services-comic-garage', name: 'Ben-Day Comic', category: 'services',
    family: 'playful-cartoon',
    look: 'Halftone comic-book panel art on newsprint. Heavy black ink outlines with visible Ben-Day dot shading, printed in cyan, hot red and yellow, bold flat colour, action speed lines, slightly off-register pulp printing, loud and energetic.',
    subject: 'A car on a lift and a gloved hand gripping a socket wrench.',
    lettering: 'Main title in bold slanted comic capitals with a thick black outline, yellow fill and a hard offset red drop shadow, like a sound-effect burst.',
    scene: 'Halftone comic-book panel art of a car on a lift and a gloved hand gripping a socket wrench, drawn in heavy black ink outlines with visible Ben-Day dot shading, printed in cyan, hot red and yellow on newsprint. Action speed lines, bold flat colour.',
  },
  {
    id: 'services-watercolour', name: 'Watercolour Wash', category: 'services',
    family: 'soft-pastel',
    look: 'Loose watercolour illustration on cold-press paper. Wet washes of teal, lemon and lavender bleeding at the edges, pencil underdrawing left showing, wide breathing white space, soft diffuse light, no hard outlines, matte absorbent paper texture, gentle and airy.',
    subject: 'A tidy kitchen corner with a kettle, a jug of cut flowers and a linen cloth.',
    lettering: 'Main title in a flowing hand-painted brush script with dry-brush tails and translucent pigment bleed. Supporting text in a light airy serif, widely letterspaced.',
    scene: 'Loose watercolour illustration on cold-press paper: a tidy kitchen corner with a kettle, a jug of cut flowers and a linen cloth. Wet washes of teal, lemon and lavender bleeding at the edges, pencil underdrawing showing, wide white space, matte paper.',
  },
  {
    id: 'services-paper-cut', name: 'Deep Teal Ground Cutout', category: 'services',
    family: 'collage-cutout',
    look: 'Cut-paper collage on a deep teal ground built from matte coloured card in terracotta, navy, ochre and blush. Torn and scissor-cut edges, small drop shadows between stacked layers, simplified flat shapes, even soft studio light, fibrous craft-paper texture.',
    subject: 'A ladder, a broom, a watering can and a simple gabled house.',
    lettering: 'Main title in friendly rounded sans capitals cut from ochre card, each letter slightly tilted with a soft paper shadow beneath. Supporting text in plain thin sans.',
    scene: 'Cut-paper collage on a deep teal ground built from matte coloured card: a ladder, a broom, a watering can and a simple gabled house in terracotta, navy, ochre and blush, torn edges visible, small shadows between layers. Even soft studio light, craft-paper texture.',
  },
  {
    id: 'services-woodcut', name: 'Ivory Engraving', category: 'services',
    family: 'retro-vintage',
    look: 'Antique woodcut engraving, black ink on aged ivory paper. Cross-hatched shading and fine parallel line work, no flat colour, ornamental hairline border, faded sepia stain and foxing, dry matte finish, formal and old-catalogue precise.',
    subject: 'A straight razor, shaving brush, comb and scissors.',
    lettering: 'Main title in engraved high-contrast didone capitals with fine hairline serifs and a delicate inline groove. Supporting text in small caps with wide tracking.',
    scene: 'Antique woodcut engraving in black ink on aged ivory paper: a straight razor, shaving brush, comb and scissors arranged with cross-hatched shading and fine parallel line work. Ornamental hairline border, faded sepia stain, dry matte finish.',
  },
  {
    id: 'services-tile-panel', name: 'Cobalt Glaze', category: 'services',
    family: 'nature-organic',
    look: 'Hand-painted ceramic tile panel. Cobalt blue brushwork on white glaze, square tile grid with visible grout lines, scrolling vine and floral motifs, a repeating decorative border, glossy glaze highlights, faint crazing in the surface, cool even light.',
    subject: 'Scrolling vines, lotus blooms and a bathing bird.',
    lettering: 'Main title in painted blue brush-drawn serif capitals following the glaze, with slight bleed into the ceramic and a wet glossy sheen. Supporting text in hand-painted italics.',
    scene: 'Hand-painted ceramic tile panel in the Portuguese manner: glazed square tiles in cobalt blue on white, painted with scrolling vines, lotus blooms and a bathing bird, framed by a repeating border. Glossy glaze highlights, faint crazing, cool even light.',
  },
  {
    id: 'services-swiss-grid', name: 'Crimson Bar', category: 'services',
    mergedInto: 'sale-swiss-grid', mergedWhy: 'Crimson bar instead of a block, but same palette, grid, ink and neo-grotesque type',
    look: 'Flat International-style poster. Cool paper-white ground, one thick crimson horizontal bar, thin black rules dividing a strict column grid, generous empty space, a single small black circle as accent. Even diffuse light, matte print finish, calm and exact.',
    lettering: 'Neo-grotesque sans in tight ranged-left blocks, medium weight for body copy, one heavy black setting for the headline, crisp matte, no effects at all.',
    scene: 'Flat International-style poster. Cool paper-white ground, one thick crimson horizontal bar, thin black rules dividing a strict column grid, generous empty space, a single small black circle as accent. Even diffuse light, matte print finish, calm and exact.',
  },
  {
    id: 'services-clay-3d', name: 'Matte Clay', category: 'services',
    family: 'gradient-modern',
    look: 'Clay-render composition. Rounded matte shapes modelled in putty-like plastic float on a warm peach backdrop, soft studio light from upper left, gentle long shadows, velvety no-gloss finish, chunky simplified forms, friendly and tactile.',
    subject: 'A chunky wrench, a spray bottle and a paint roller.',
    lettering: 'Rounded geometric sans extruded in soft-plastic 3D with a matte clay surface, thick friendly weight, subtle contact shadow beneath each letter.',
    scene: 'Clay-render composition. Rounded matte shapes floating on a warm peach backdrop, a chunky wrench, spray bottle and paint roller modelled in putty-like plastic, soft studio light from upper left, gentle long shadows, velvety no-gloss finish.',
  },
  {
    id: 'services-neon-dark', name: 'Neon Wire', category: 'services',
    mergedInto: 'community-night-fundraiser', mergedWhy: 'Same near-black ground with thin glowing cyan/magenta tube outlines and bloom haze',
    look: 'Dark graphic panel on a near-black charcoal ground. Glowing electric-cyan and hot-magenta outline shapes drawn in thin light strokes, soft bloom haze around every line, wet-glass reflection along the lower edge, deep shadow, cool technical and luminous.',
    lettering: 'Thin uppercase sans drawn as glowing tube outlines in cyan with a magenta secondary glow, wide letterspacing and faint halo bleed.',
    scene: 'Dark graphic panel. Near-black charcoal ground, glowing electric-cyan and hot-magenta outline shapes drawn in thin light strokes, soft bloom haze around every line, wet-glass reflection along the lower edge, cool, technical and luminous.',
  },
  {
    id: 'services-memphis-pop', name: 'Pop Shapes', category: 'services',
    mergedInto: 'nightlife-memphis-pop', mergedWhy: 'Identical cream-ground postmodern confetti field with chunky bouncy outlined capitals.',
    look: 'Postmodern pattern field on cream. Mint, tangerine and cobalt confetti shapes — squiggles, checkerboards, zigzags and dots — scattered densely, flat vector fills, one oversized off-kilter triangle, screen-print grain, flat even light, playful and busy.',
    lettering: 'Chunky bouncy sans with an alternating baseline, flat two-tone offset fill in cobalt and tangerine, thick black outline.',
    scene: 'Postmodern pattern field. Mint, tangerine and cobalt confetti shapes — squiggles, checkerboards, zigzags and dots — scattered on cream, flat vector fills, one oversized off-kilter triangle, playful and busy, screen-print texture, flat even light.',
  },
  {
    id: 'services-deco-lines', name: 'Brass Deco', category: 'services',
    mergedInto: 'food-deco-supper', mergedWhy: 'Same brass inlay deco geometry and inline-striped capitals',
    look: 'Art-deco geometry. Deep forest green ground with fine brass line inlay, fanned sunburst arcs, stepped ziggurat frames and slender fluted columns, strict symmetry, warm low-angle glow across metal, lacquered satin finish, elegant and formal.',
    lettering: 'High-waisted deco capitals with a thin brass inline stripe, sharp geometric spurs, tight tracking and a satin metallic sheen.',
    scene: 'Art-deco geometry. Deep forest green ground with fine brass line inlay, fanned sunburst arcs, stepped ziggurat frames and slender fluted columns, symmetrical composition, warm low-angle glow on metal, lacquered satin finish, elegant and formal.',
  },
  {
    id: 'services-glass-panel', name: 'Frosted Glass', category: 'services',
    mergedInto: 'fitness-training-glass', mergedWhy: 'Same glassmorphism panels over a gradient mesh with glowing thin edges; only the background hue differs',
    look: 'Glassmorphism composition. A blurred aqua-to-violet gradient mesh sits behind translucent frosted rectangles with hairline white edges, soft coloured light bleeding through the panels, faint noise grain, floating layered depth, airy modern digital finish.',
    lettering: 'Light-weight geometric sans in semi-transparent white with a fine bright edge highlight, wide spacing and a soft outer glow.',
    scene: 'Glassmorphism composition. A blurred aqua-to-violet gradient mesh behind translucent frosted rectangles with hairline white edges, soft coloured light bleeding through the panels, faint noise grain, floating depth, airy modern digital finish.',
  },
  {
    id: 'services-brutal-block', name: 'Toner Block', category: 'services',
    family: 'bold-poster',
    look: 'Brutalist colour blocking. Raw concrete-grey field split by hard rectangles of safety yellow and ink black, thick offset drop shadows, exposed registration marks, coarse halftone dots, harsh flat light, unpolished photocopy finish with edges eaten by toner.',
    lettering: 'Ultra-heavy condensed capitals in ink black with a hard yellow offset shadow and slight photocopy roughness eating the edges.',
    scene: 'Brutalist colour blocking. A raw concrete-grey field split by hard rectangles of safety yellow and ink black, thick offset drop shadows, exposed registration marks, coarse halftone dots, harsh flat light, unpolished photocopy finish.',
  },
  {
    id: 'realestate-just-sold', name: 'Noon Bright', category: 'realestate',
    family: 'photo-cinematic',
    look: 'Hard midday sun under an open blue sky. Crisp whites, emerald green and a punch of pillar-box red, wide environmental lens, clean digital capture, sharp black shadows, high saturation, cheerful and glossy with no grain.',
    subject: 'Suburban front lawn, white-sided house with a red front door',
    lettering: 'Main title in heavy rounded sans capitals, flat white with a thick emerald outline and a hard offset shadow. Secondary text in tight uppercase sans.',
    scene: 'Midday suburban front lawn under a bright blue sky. Crisp white siding, emerald grass, a red front door, wide environmental lens, clean digital capture, hard noon sun with sharp shadows, saturated and cheerful.',
  },
  {
    id: 'realestate-apartments', name: 'Twilight Haze', category: 'realestate',
    family: 'soft-pastel',
    look: 'Twilight glow at eye level on a medium lens. Lit turquoise water, warm bulb points, coral and lavender sky, soft pastel grade, gentle atmospheric haze, low contrast, dreamy and relaxed with everything slightly diffused.',
    subject: 'Modern apartment courtyard pool, palms, string bulbs, residents lounging',
    lettering: 'Main title in light geometric sans with wide letter spacing, soft coral-to-lavender gradient fill. Supporting text in thin uppercase with hairline rules.',
    scene: 'Dusk at a modern apartment courtyard. Lit turquoise pool water, palms, string bulbs, coral and lavender sky, residents lounging, soft pastel grade, gentle haze, low-contrast dreamy finish, eye-level medium lens.',
  },
  {
    id: 'realestate-commercial', name: 'Cold Blue Steel', category: 'realestate',
    family: 'editorial-magazine',
    look: 'Aerial dawn light, cold blue mist and graphite concrete with a single thin gold line on the horizon. High-contrast editorial grade, razor-sharp detail, wide empty negative space, glass and steel reflectivity, austere and expensive.',
    subject: 'Glass and steel office block, empty parking decks, tower skyline',
    lettering: 'Main title in tall narrow serif capitals, ice-white with fine hairline strokes. Supporting text in small letterspaced grey sans.',
    scene: 'Dawn drone view over a glass and steel office block, empty parking decks, cold blue mist between towers, graphite concrete, a thin gold sunrise line on the horizon, high-contrast editorial grade, sharp architectural detail.',
  },
  {
    id: 'realestate-first-home', name: 'Lamplit Amber', category: 'realestate',
    family: 'warm-rustic',
    look: 'Single warm lamp as the only light source. Amber glow falling off into darkness, cream and cardboard tones, warm film grain, shallow depth of field, soft focus edges, quiet and intimate with low contrast in the shadows.',
    subject: 'Cardboard moving boxes, two people on bare floorboards with takeaway cups',
    lettering: 'Main title in a friendly handwritten script with slightly uneven strokes in warm cream. Supporting text in small humanist sans, lowercase.',
    scene: 'Evening interior lit by one table lamp. Cardboard moving boxes, two people sitting on bare floorboards with takeaway cups, amber glow, cream walls, warm film grain, shallow depth of field, cosy and quiet.',
  },
  {
    id: 'realestate-investment', name: 'Brass Ledger', category: 'realestate',
    mergedInto: 'law-firm', mergedWhy: 'Matte low-key walnut with brass and leather; a flat-lay is a layout, not a different look',
    look: 'Overhead flat-lay on dark walnut. Moody low-key side light, deep shadows, muted browns with brass and leather highlights, matte editorial finish, tight arrangement on a rich surface, restrained and expensive.',
    subject: 'Brass keys, folded blueprint, reading glasses, leather notebook, coffee cup',
    lettering: 'Main title in refined serif capitals with high thick-thin contrast and a brushed brass foil finish. Supporting text in small caps with wide tracking.',
    scene: 'Overhead flat-lay on a dark walnut desk. Brass keys, a folded blueprint, reading glasses, a leather notebook and a coffee cup, moody low-key side light, deep shadows, muted browns and brass, matte editorial finish.',
  },
  {
    id: 'realestate-lending', name: 'Sage Daylight', category: 'realestate',
    mergedInto: 'business-now-hiring', mergedWhy: 'Same high-key sage-and-white airy daylight with clean navy sans',
    look: 'Pale diffused daylight through sheer fabric. Sage green, white marble and bone, airy clean digital capture, soft shadows with no harsh edges, high key and bright, calm and reassuring, plenty of empty breathing room.',
    subject: 'Morning kitchen counter with a mug and loose paperwork',
    lettering: 'Main title in medium-weight grotesque sans, deep ink navy, generous spacing and clean flat edges. Supporting text in the same family at light weight.',
    scene: 'Early morning kitchen with a large window. Sheer curtains diffusing pale sunlight, sage cabinetry, white marble counter, a mug and loose paperwork, airy clean digital capture, soft shadows, calm and reassuring, light and bright.',
  },
  {
    id: 'realestate-staging', name: 'Greige Macro', category: 'realestate',
    mergedInto: 'quiet-luxury-sale', mergedWhy: 'Greige and taupe matte photography with thin serif titles; a crop change, not a look change',
    look: 'Overcast window light on a tight macro crop. Greige, bone and warm taupe, muted matte grade, soft directional shadow, textural close focus on weave and plaster, very low colour saturation, still and refined.',
    subject: 'Linen cushion, dried stems in a stoneware vase, plaster wall',
    lettering: 'Main title in elegant thin italic serif, warm taupe, with a delicate underline. Supporting text in tiny widely tracked uppercase sans.',
    scene: 'Overcast midday light through tall windows. Tight macro of a styled living-room vignette: linen cushion weave, dried stems in a stoneware vase, plaster wall, greige and bone palette, muted matte grade, soft directional shadow.',
  },
  {
    id: 'realestate-rent-ready', name: 'Riso Two Ink', category: 'realestate',
    mergedInto: 'open-mic', mergedWhy: 'Same burnt orange and navy on oatmeal stock with heavy vintage slab/letterpress caps',
    look: 'Two-colour risograph print. Burnt orange and navy ink on oatmeal stock, coarse halftone dots, deliberate misregistration, blocky cut-paper shapes, visible paper tooth, flat matte zine finish with no gradients.',
    subject: 'Rooftop and stairway silhouettes',
    lettering: 'Heavy slab-serif capitals in navy with an orange ink offset behind, halftone speckle showing through the letterforms, small typewriter-style caption text.',
    scene: 'Two-colour risograph print. Burnt orange and navy ink on oatmeal stock, coarse halftone dots, deliberate misregistration, blocky cut-paper rooftops and stair shapes, visible paper tooth, flat matte zine finish.',
  },
  {
    id: 'realestate-retro-apartments', name: 'Mid Century Litho', category: 'realestate',
    mergedInto: 'community-parade-litho', mergedWhy: 'Same flat 1950s screened litho shapes and press texture',
    look: 'Mid-century lithograph poster. Mustard, sky blue, cream and burnt orange in flat screened colour, long simplified shadows, faint press texture, hand-drawn geometric shapes, optimistic 1950s calm with no photographic detail.',
    subject: 'Stacked balconies, kidney-shaped pool, palm fronds',
    lettering: 'Main title in wide extended mid-century capitals, burnt orange with a thin cream inline stripe down each stroke. Supporting text in light italic sans.',
    scene: 'Mid-century lithograph travel poster of an apartment community: stacked balconies, kidney-shaped pool, palm fronds, long flat sun shadows. Mustard, sky blue, cream and burnt orange, screened flat colour, faint press texture, optimistic 1950s calm.',
  },
  {
    id: 'realestate-paper-house', name: 'Pastel Paper Layers', category: 'realestate',
    family: 'collage-cutout',
    look: 'Cut-paper collage built from layered construction paper and felt, torn and scissor-cut edges, real drop shadows between layers, sage, butter yellow and blush, bright even studio light, tactile matte surfaces.',
    subject: 'A small house, lawn, clouds and a key made from paper',
    lettering: 'Main title cut from thick paper with visible scissor edges and a soft layered shadow. Supporting text in a friendly handwritten marker script.',
    scene: 'Cut-paper collage of a small starter house built from layered construction paper, felt lawn, torn-edge clouds and a paper key, real drop shadows between layers, sage, butter yellow and blush, bright even studio light.',
  },
  {
    id: 'realestate-engraved-office', name: 'Copperplate Ink', category: 'realestate',
    family: 'editorial-magazine',
    look: 'Fine-line copperplate engraving, dense crosshatch and stipple building all the tone, sepia-black ink on ivory laid paper, thin ruled border, cool restrained finish like an old stock certificate, no colour beyond the ink.',
    subject: 'A brick and glass commercial building',
    lettering: 'Main title in engraved high-contrast serif capitals with hairline flourishes and fine crosshatch shading. Supporting text in small letterspaced roman caps.',
    scene: 'Fine-line copperplate engraving of a brick and glass commercial building, dense crosshatch and stipple, sepia-black ink on ivory laid paper, thin ruled border, cool restrained finish like an old stock certificate.',
  },
  {
    id: 'realestate-watercolour-home', name: 'Wash And Line', category: 'realestate',
    mergedInto: 'community-market-wash', mergedWhy: 'Same loose watercolour over pencil and ink with soft bleeding edges',
    look: 'Loose watercolour over pencil and ink. Washes bleeding past the outlines, blush and sage palette, white paper breathing through the middle, gentle morning light, soft edges, unfinished sketchy charm, no hard geometry.',
    subject: 'A styled living room with sofa, vase of eucalyptus and a sunlit rug',
    lettering: 'Main title in an elegant thin-stroke script with damp brushy edges. Supporting text in a small airy serif with generous letterspacing.',
    scene: 'Loose watercolour and ink illustration of a styled living room: linen sofa, ceramic vase with eucalyptus, sunlit rug, washes bleeding past pencil outlines, blush and sage, white paper breathing through, gentle morning light.',
  },
  {
    id: 'realestate-letterpress-deal', name: 'Pressed Oxblood', category: 'realestate',
    mergedInto: 'business-woodtype-hiring', mergedWhy: 'Oxblood-and-charcoal letterpress with giant mottled slab type — the same look',
    look: 'Letterpress broadside on thick cotton paper. Oxblood red and charcoal ink, wood-block silhouette shapes, heavy plate impression denting the sheet, ruled ornament borders, mottled ink coverage, completely matte with no gloss.',
    subject: 'A row of rooftops and chimneys',
    lettering: 'Main title in giant slab wood-type capitals, ink-starved and mottled, pressed deep into the sheet. Supporting text in condensed gothic caps on ruled lines.',
    scene: 'Letterpress broadside on thick cotton paper: a row of duplex rooftops and chimneys carved as a wood-block silhouette, oxblood red and charcoal ink, heavy plate impression denting the sheet, ruled ornament borders, no gloss.',
  },
  {
    id: 'realestate-comic-loans', name: 'Benday Panel', category: 'realestate',
    mergedInto: 'services-comic-garage', mergedWhy: 'Same black-outline benday comic panel with speed lines and outlined yellow display caps',
    look: 'Retro comic panel. Thick black outlines, benday dot shading, primary red, yellow and blue, radiating speed lines from the centre, yellowed newsprint stock, off-register dots, flat bright energetic printing.',
    subject: 'Two people shaking hands across a desk',
    lettering: 'Main title in bouncy bold comic capitals with a thick black outline, yellow fill and a hard drop shadow. Supporting text in inked comic caps.',
    scene: 'Retro halftone comic panel: a cheerful buyer shaking hands across a lender\'s desk, thick black outlines, benday dot shading, primary red, yellow and blue, radiating speed lines behind, newsprint yellowing, off-register dots.',
  },
  {
    id: 'realestate-sold-grid', name: 'Swiss Scarlet', category: 'realestate',
    mergedInto: 'sale-swiss-grid', mergedWhy: 'Same scarlet rectangle on ruled white paper with lowercase grotesque stacks',
    look: 'Swiss international print. Flat white paper ruled with a strict hairline black column grid, one large scarlet rectangle and one small black square set low for weight. No photography, no texture, matte ink, cool even studio light, generous empty space, calm and exact.',
    lettering: 'Titles in tight grotesque sans, all lowercase, flush left in tall stacked lines. Supporting text in small black caps with one word knocked out white.',
    scene: 'Swiss international poster. Flat white paper, a strict column grid ruled in hairline black, one large scarlet rectangle and one small black square set low. No photograph, no texture, matte print, cool even studio light.',
  },
  {
    id: 'realestate-deco-tower', name: 'Brass Ziggurat', category: 'realestate',
    mergedInto: 'nightlife-deco-gold', mergedWhy: 'Same stepped arches and metallic fans over midnight ink with sheen',
    look: 'Art-deco geometry. Stepped arches and radiating sunburst fans in brushed brass and deep emerald over a midnight ink ground, thin gold rules, strict symmetry, soft warm metallic sheen like a polished elevator door, rich and formal.',
    lettering: 'Main title in tall narrow deco capitals with fine inline stripes down each stroke, brass gradient fill, wide letterspacing, thin gold rules above and below.',
    scene: 'Art-deco geometry. Stepped ziggurat arches and radiating sunburst fans in brushed brass and deep emerald over a midnight ink ground, thin gold rules, strictly symmetrical, soft warm sheen like an old elevator door.',
  },
  {
    id: 'realestate-retro-shapes', name: 'Memphis Cream', category: 'realestate',
    mergedInto: 'nightlife-memphis-pop', mergedWhy: 'Same 1980s flat vector shapes on cream with tilted chunky rounded capitals and drop shadow.',
    look: 'Memphis postmodern play on cream. Bubblegum pink, lemon yellow, mint and cobalt shapes scattered loose: squiggles, dotted grids, striped triangles, floating circles. Flat 1980s vector, zero shading, cheerful and light, crisp matte finish.',
    lettering: 'Chunky rounded sans capitals in cobalt with a yellow drop shadow, each word on its own tilted baseline, small mint outline text beneath.',
    scene: 'Memphis postmodern playground on cream. Bubblegum pink, lemon yellow, mint and cobalt shapes scattered loose: squiggles, dotted grids, striped triangles, floating circles. Flat 1980s vector, zero shading, cheerful and light, crisp matte finish.',
  },
  {
    id: 'realestate-clay-keys', name: 'Putty Clay', category: 'realestate',
    mergedInto: 'services-clay-3d', mergedWhy: 'Identical velvety putty clay forms and soft contact shadows, only the props differ',
    look: 'Soft 3D clay render. Rounded matte forms modelled in putty peach, sage and cloud grey floating on lavender, gentle contact shadows, diffuse studio light, velvety toy finish, low contrast and friendly with plenty of air around each shape.',
    lettering: 'Rounded soft-edge sans in matte clay with the same putty finish as the shapes, gentle extrusion and a soft ambient shadow. Small clean grey caption text.',
    scene: 'Soft 3D clay render. A pastel matte gable house, a rounded key and a small door arch modelled in putty peach, sage and cloud grey, floating on lavender with gentle shadow, diffuse studio light, velvety toy finish.',
  },
  {
    id: 'realestate-neon-rentals', name: 'Synth Grid', category: 'realestate',
    mergedInto: 'community-night-fundraiser', mergedWhy: 'Glowing tube line work on black with the same palette and tube lettering; the grid is a motif, not a different look',
    look: 'Glowing cyan and magenta line work on black, a dark receding grid horizon, purple haze, thin light streaks, chromatic glow bleeding into the darkness, high-gloss screen finish, deep blacks and electric saturation.',
    lettering: 'Main title in glowing tube-neon script with a magenta halo and a visible glass highlight. Supporting text in thin cyan uppercase with wide tracking.',
    scene: 'Neon on black. A wireframe skyline of glowing cyan and magenta lines over a dark grid horizon, purple haze, thin light streaks, chromatic glow bleeding into the black, high-gloss synthwave screen finish.',
  },
  {
    id: 'realestate-glass-panels', name: 'Indigo Glass', category: 'realestate',
    mergedInto: 'sale-glass-panel', mergedWhy: 'Identical frosted-panel build on a blue-teal gradient blur with blurred spheres behind',
    look: 'Frosted translucent panels with soft white borders floating on a smooth indigo-to-teal gradient blur, faint blurred spheres behind, cool diffused light, weightless high-end polish, glossy and edgeless, quiet and uncluttered.',
    lettering: 'Clean geometric sans in white, semibold title over light supporting lines, slight frosted transparency and a faint soft glow at the edges.',
    scene: 'Frosted translucent panels with soft white borders floating on a smooth indigo-to-teal gradient blur, faint blurred spheres behind, cool diffused light, weightless high-end app-screen polish, glossy and edgeless.',
  },
  {
    id: 'realestate-new-build', name: 'Cyanotype Blueprint', category: 'realestate',
    family: 'retro-vintage',
    look: 'Cyanotype blueprint. Crisp white technical linework and dimension arrows on deep prussian blue, faint ring stain and folded creases across the sheet, cool chemical wash, flat matte drafting paper, precise and unshaded.',
    lettering: 'Main title in precise drafting stencil capitals, chalk white, wide tracking, thin ruled leader lines. Supporting text in small hand-drafted uppercase.',
    scene: 'Cyanotype blueprint. White technical linework of a house elevation, framing studs and dimension arrows on deep prussian blue, faint coffee-ring stain and folded creases across the sheet, cool chemical wash, flat matte drafting paper.',
  },
  {
    id: 'fitness-pool-lane', name: 'Turquoise Clarity', category: 'fitness',
    mergedInto: 'services-bright-clean', mergedWhy: 'Same pale cool blue-and-white high-clarity brightness with crisp clean edges',
    look: 'Overhead wide photograph in pale dawn light. Turquoise and white palette with cool blue skylight glow, wet reflective surfaces, frozen droplets caught mid-air, high clarity digital finish, clean and bracing with crisp edges.',
    subject: 'Indoor lap pool, lane ropes, swimmers mid-stroke, white tile',
    lettering: 'Main title in tall clean sans-serif capitals with a wet glass shine and a thin white outline. Supporting text in light widely spaced letterforms.',
    scene: 'Indoor lap pool at dawn. Overhead wide view down the lane ropes, swimmers mid-stroke, turquoise water and white tile, pale blue skylight glow, frozen splash droplets, cool clean digital finish with high clarity.',
  },
  {
    id: 'fitness-spin-night', name: 'Violet Haze', category: 'fitness',
    mergedInto: 'neonclub', mergedWhy: 'Dark interior, coloured strip light raking through haze over silhouettes — same look, different room',
    look: 'Dark interior photograph with the lights out. Magenta and electric violet strip lighting rakes across silhouetted forms, mirrored back wall, thin atmospheric haze, glossy sweat highlights, low-key digital with deep crushed blacks and hot colour edges.',
    subject: 'Rows of indoor cycling riders standing on the pedals in a studio',
    lettering: 'Main title in italic heavy sans-serif capitals with a magenta neon glow and a slight motion-blur trail. Supporting text in narrow uppercase.',
    scene: 'Night indoor cycling studio with the lights out. Rows of riders standing on the pedals in silhouette, magenta and electric violet strip lighting, mirrored back wall, thin haze, sweat highlights, low-key digital with deep blacks.',
  },
  {
    id: 'fitness-climb-gym', name: 'Amber Chalk', category: 'fitness',
    mergedInto: 'food-smokehouse', mergedWhy: 'Same amber-on-charcoal palette, dust or smoke in the beams and gritty deep shadow',
    look: 'After-dark photograph lit by tungsten spotlights. Warm amber and charcoal palette with scattered pops of orange, lime and blue, raw plywood texture, fine dust drifting in the beams, gritty photographic contrast and deep shadow.',
    subject: 'Bouldering gym overhangs, climbing holds, a climber reaching high, padded floor',
    lettering: 'Main title in heavy rounded slab capitals with a chalky matte texture and a hand-scuffed edge. Supporting text in compact bold uppercase.',
    scene: 'Bouldering gym after dark. Tungsten spotlights on plywood overhangs, scattered orange, lime and blue holds, a climber reaching high, chalk cloud drifting, thick padded floor, warm amber and charcoal palette, gritty photographic contrast.',
  },
  {
    id: 'fitness-dojo-dusk', name: 'Sepia Dusk', category: 'fitness',
    mergedInto: 'music-jazz-cellar', mergedWhy: 'Same sepia-and-oxblood film grain, raking warm light and restrained quiet contrast',
    look: 'Dusk interior on 35mm film. Warm sepia and oxblood palette, low sun raking through paper screens, dust drifting in the light shafts, worn wood texture, visible grain, quiet restrained contrast and stillness.',
    subject: 'Traditional martial arts hall, white uniforms, coloured belts',
    lettering: 'Main title in sharp brush-stroke serif capitals with dry ink edges and split hairline strokes. Supporting text in small letterspaced sans-serif.',
    scene: 'Traditional martial arts hall at dusk. Worn wooden floor, white uniforms and coloured belts, low sun through paper screens, dust drifting in the light shafts, warm sepia and oxblood palette, 35mm film grain, quiet and disciplined.',
  },
  {
    id: 'fitness-studio-light', name: 'Blush Daylight', category: 'fitness',
    mergedInto: 'sale-spring-pastel', mergedWhy: 'Same luminous low-contrast daylight interior in blush and sage with a thin high-contrast serif',
    look: 'Midday sunlight photograph through tall windows. Blush pink, cream and sage palette on pale oak, soft pastel grade, airy and calm, gentle lens flare, mirrored reflections, low contrast with luminous highlights.',
    subject: 'Barre and reformer studio, wooden barre, mirrors, resistance bands',
    lettering: 'Main title in a thin high-contrast serif with elongated letterforms and fine hairlines. Supporting text in small lowercase sans-serif with wide spacing.',
    scene: 'Barre and reformer studio at midday. Tall windows throwing sunlight across pale oak floor and mirrors, wooden barre, resistance bands, blush pink, cream and sage palette, soft pastel grade, airy and calm with gentle lens flare.',
  },
  {
    id: 'fitness-field-day', name: 'Golden Emerald', category: 'fitness',
    mergedInto: 'openhouse', mergedWhy: 'Same golden-hour warm grade, long shadows and crisp saturated outdoor detail',
    look: 'Drone-high wide photograph at golden hour. Emerald green and amber sunlight, long raking shadows, punchy warm digital grade, crisp detail edge to edge, saturated and cheerful with strong depth from above.',
    subject: 'Youth team sports on a grass field, chalked lines, children and coaches, orange cones',
    lettering: 'Main title in chunky rounded sans-serif capitals with a thick white outline and a soft drop shadow. Supporting text bold, friendly and upright.',
    scene: 'Youth team sports on a grass field at golden hour. Drone-high wide view, long shadows across chalked lines, children and coaches mid-drill, emerald green and amber sunlight, orange cones, punchy warm digital with crisp detail.',
  },
  {
    id: 'fitness-fuel-flat', name: 'Crisp Studio Flatlay', category: 'fitness',
    family: 'clean-corporate',
    look: 'Overhead flat-lay on white marble. Bright even studio light, crisp defined shadows, fresh green and white palette, objects arranged in a tidy grid, high-resolution photographic clarity, clean and appetising with no clutter.',
    subject: 'Chicken and rice bowls, berries, spinach, shaker bottle, tape measure, small dumbbell, cut citrus and ice',
    lettering: 'Main title in confident geometric sans-serif capitals in solid black. Supporting text in a light weight sitting on thin horizontal rules.',
    scene: 'Overhead flat-lay on white marble. Grilled chicken and rice bowls, berries, spinach, a shaker bottle, a tape measure and a small dumbbell, cut citrus and ice, bright even studio light, crisp shadows, fresh green and white palette.',
  },
  {
    id: 'fitness-easy-start', name: 'Oatmeal Morning', category: 'fitness',
    mergedInto: 'acreage', mergedWhy: 'Same soft low-contrast light, muted warm-neutral palette and mild film softness',
    look: 'Soft morning window light mixed with warm lamp glow. Oatmeal, dusty teal and soft gold palette, gentle portrait lens with shallow focus, low contrast, warm and unhurried with a mild film softness.',
    subject: 'Community hall class for older adults, chairs, light hand weights, stretch bands, relaxed smiles',
    lettering: 'Main title in a friendly humanist serif with generous weight and rounded terminals. Supporting text in large plain readable sans-serif.',
    scene: 'Community hall morning class for older adults. Soft window light plus warm lamp glow, chairs, light hand weights and stretch bands, relaxed smiles, oatmeal, dusty teal and soft gold palette, gentle portrait lens, low contrast.',
  },
  {
    id: 'fitness-spin-riso', name: 'Riso Misprint', category: 'fitness',
    family: 'retro-vintage',
    look: 'Two-colour risograph screen print on warm off-white paper. Only flat fluorescent orange and deep navy inks, no blends. Visible misregistration, grainy ink mottle, bold silhouetted shapes and radiating speed lines. High contrast, energetic, cheap-print charm.',
    subject: 'Indoor cycling room, riders leaning over handlebars',
    lettering: 'Main title in chunky rounded sans capitals printed in solid navy with an orange offset shadow that slips out of register. Small text in typewriter mono.',
    scene: 'Two-colour riso screen print of an indoor cycling room. Flat fluorescent orange and deep navy inks on warm off-white paper, visible misregistration and grainy ink texture, silhouetted riders leaning over handlebars, radiating speed lines.',
  },
  {
    id: 'fitness-dance-paper', name: 'Torn Paper', category: 'fitness',
    mergedInto: 'community-street-party-paper', mergedWhy: 'Identical coral/mustard/teal/cream card on a pale ground with soft even light',
    look: 'Cut-paper collage. Torn and scissor-cut flat shapes in coral, mustard, deep teal and cream, each layer lifted by a soft drop shadow. Matte construction-paper grain, clean pale background, generous space, buoyant and playful.',
    subject: 'Dancers caught mid-turn',
    lettering: 'Main title hand-cut from paper in loose brush-script capitals, each letter slightly uneven with a soft paper shadow. Details in tidy geometric sans.',
    scene: 'Cut-paper collage of dancers mid-turn. Torn and scissor-cut shapes in coral, mustard, deep teal and cream, soft drop shadows under each paper layer, matte construction-paper texture, buoyant and playful, clean pale background.',
  },
  {
    id: 'fitness-trail-watercolour', name: 'Wet Wash', category: 'fitness',
    mergedInto: 'business-watercolour', mergedWhy: 'Same wet-on-wet washes, bare paper, cold-press grain and bleeding brush script — only the earth tones shift slightly',
    look: 'Loose wet-on-wet watercolour. Olive, ochre and slate washes bleeding softly at every edge, bare paper left open as light and mist, cold-press cotton grain, pigment pooling in low spots. Calm, airy, low contrast, unhurried morning light.',
    subject: 'Walkers on a ridge trail with pine trees',
    lettering: 'Main title in a flowing wet brush script with soft bleeding edges and pigment pooling at stroke ends. Supporting text in light airy sans.',
    scene: 'Loose watercolour painting of walkers on a ridge trail. Wet-on-wet olive, ochre and slate washes, pine shapes bleeding at the edges, bare paper left as mist and path, cold-press cotton grain, calm open morning air.',
  },
  {
    id: 'fitness-schedule-chalk', name: 'Slate Chalk', category: 'fitness',
    mergedInto: 'food-chalkboard-coffee', mergedWhy: 'Identical dusty chalk board treatment, same yellow and mint accents',
    look: 'Hand-drawn chalk on a slate green-black board. Dusty white line drawings with soft smudged shading, faint eraser streaks and fingerprints, a few accents in pale yellow and mint chalk. Warm, informal, matte, gently uneven by hand.',
    subject: 'Dumbbells, trainers, a skipping rope and a wall clock',
    lettering: 'Main title in ornate chalk-drawn slab capitals with white outline flourishes and hatched shadowing. Secondary lines in casual chalk cursive with visible dust.',
    scene: 'Hand-drawn chalkboard on slate green-black. Dusty white chalk drawings of dumbbells, trainers, a skipping rope and a wall clock, soft smudged shading, faint eraser streaks, a few strokes in pale yellow and mint chalk.',
  },
  {
    id: 'fitness-dojo-woodcut', name: 'Carved Vermilion', category: 'fitness',
    family: 'bold-poster',
    look: 'Woodcut relief print. Black carved linework on aged ivory paper with one single vermilion ink block, visible chisel marks and wood grain, ink-starved gaps, flat unshaded fills. Graphic, ceremonial, high contrast, very few colours.',
    subject: 'Figures in belted training uniforms locked in a throw, crashing wave motif behind',
    lettering: 'Main title in carved brush-stroke capitals with rough chiselled edges and ink-starved gaps. Supporting text in narrow upright serif printed in vermilion.',
    scene: 'Japanese-style woodcut print. Black carved linework on aged ivory paper with a single vermilion ink block, figures in belted training uniforms locked in a throw, crashing wave motif behind, visible chisel marks and wood grain.',
  },
  {
    id: 'fitness-kids-embroidery', name: 'Stitched Patch', category: 'fitness',
    mergedInto: 'sale-stitched', mergedWhy: 'Same raised satin-stitch varsity patch, only the felt colour differs',
    look: 'Embroidered felt patch artwork. Kelly green, orange and cream thread on a navy felt ground, raised satin-stitch fills catching the light, chain-stitch outlines, merrowed rope edge. Tactile, handmade, soft shadowing, warm and chunky.',
    subject: 'Running children, a ball and a whistle',
    lettering: 'Main title in bold varsity block capitals rendered in dense satin stitch with a contrasting chain-stitch outline. Small text in simple back-stitch lettering.',
    scene: 'Embroidered felt patch artwork. Stitched running children, a ball and a whistle in kelly green, orange and cream thread on a navy felt ground, raised satin-stitch fills, chain-stitch outlines, merrowed edge, tactile and handmade.',
  },
  {
    id: 'fitness-senior-litho', name: 'Mid Century Litho', category: 'fitness',
    mergedInto: 'community-parade-litho', mergedWhy: 'Same mid-century litho poster: flat rounded forms, halftone shading, matte paper',
    look: 'Mid-century lithograph poster. Tight flat palette of burnt orange, sage, cream and charcoal, simplified rounded forms, printed halftone dot shading and slight ink overlap where colours meet. Optimistic 1950s travel-poster mood, matte paper finish.',
    subject: 'Rounded figures walking and stretching among park trees',
    lettering: 'Main title in wide friendly mid-century sans capitals with generous letter spacing and a soft ink-bleed edge. Supporting text in a light modern serif.',
    scene: 'Mid-century lithograph poster. Flat limited palette of burnt orange, sage, cream and charcoal, simplified rounded figures walking and stretching among park trees, printed halftone dot shading, slight ink overlap, optimistic 1950s travel-poster mood.',
  },
  {
    id: 'fitness-pilates-swiss', name: 'Sage Circle Grid', category: 'fitness',
    family: 'minimal-type',
    look: 'Swiss International layout on warm off-white paper. One large flat sage circle, two thin slate rules, a single duotone silhouette in dusty rose. Enormous empty space, strict grid alignment, matte print finish, no texture, no effects, quiet and precise.',
    subject: 'A stretching figure in silhouette',
    lettering: 'Main title in lowercase grotesque, medium weight, tight tracking, flat slate ink. Supporting text in small even-weight sans, no effects, strictly aligned.',
    scene: 'Swiss International style layout. Warm off-white paper, one large flat sage circle and two thin slate rules, generous empty space, a single duotone silhouette of a stretching figure in dusty rose, calm and precise, matte print finish.',
  },
  {
    id: 'fitness-awards-deco', name: 'Lacquer Deco', category: 'fitness',
    mergedInto: 'food-deco-supper', mergedWhy: 'Gold deco fans and chevrons on black lacquer with hairline rules; identical treatment',
    look: 'Art-deco geometry in brushed gold on deep lacquer black and oxblood. Symmetrical fan rays, stepped chevrons, thin concentric hairline borders, a foil-on-card sheen. Formal, symmetrical, rich and dark with metallic highlights.',
    subject: 'A stylised laurel wreath and trophy cup centred',
    lettering: 'Main title in tall art-deco capitals with hairline inner stripes and thin gold rules above and below. Supporting text in spaced small caps, gold on black.',
    scene: 'Art-deco geometry for a sports club awards evening. Symmetrical fan rays and stepped chevrons in brushed gold on deep lacquer black and oxblood, thin concentric borders, a stylised laurel and cup shape centred, foil-on-card finish.',
  },
  {
    id: 'fitness-kids-memphis', name: 'Memphis Confetti', category: 'fitness',
    mergedInto: 'sale-memphis', mergedWhy: 'Same Memphis squiggles and confetti in the same red/yellow/cobalt-on-cream palette',
    look: 'Memphis postmodern graphics. Bright flat blocks of tomato red, sunflower yellow and cobalt on cream, squiggles, confetti triangles and dotted arcs scattered at playful angles, hard offset shadows behind flat shapes, matte poster finish. Loud, busy, cheerful.',
    lettering: 'Main title in chunky rounded bubble capitals, each letter a different flat colour with a thick cream outline and a hard offset shadow. Supporting text in rounded sans.',
    scene: 'Memphis postmodern playground graphics. Bright blocks of tomato red, sunflower yellow and cobalt on cream, squiggles, confetti triangles and dotted arcs scattered at playful angles, flat shapes with hard offset shadows, matte poster finish.',
  },
  {
    id: 'fitness-nutrition-clay', name: 'Soft Clay', category: 'fitness',
    mergedInto: 'services-clay-3d', mergedWhy: 'Same toy-like matte clay render and extruded clay title treatment',
    look: 'Soft 3D clay render. Rounded chunky forms modelled in pastel mint, peach and cream, floating on a seamless blush backdrop, gentle diffused studio shadows, velvety matte surface with no reflections or highlights. Calm, tactile, toy-like, low contrast.',
    subject: 'An apple, a water bottle, a small dumbbell and a bowl',
    lettering: 'Main title in rounded extrabold sans extruded as matte 3D clay in cream with a soft shadow. Supporting text in light rounded sans, flat pastel grey.',
    scene: 'Soft 3D clay render. Rounded matte objects — an apple, a water bottle, a small dumbbell, a bowl — modelled in pastel mint, peach and cream, floating on a seamless blush backdrop with soft studio shadows, velvety finish, no reflections.',
  },
  {
    id: 'fitness-dance-collage', name: 'Zine Ransom', category: 'fitness',
    family: 'grunge-street',
    look: 'Maximalist cut-and-paste zine collage. Torn magazine paper, coarse halftone textures and blown-out photocopied fragments layered over acid green and purple, scribbled marker arcs, tape strips and stickers. Deliberately messy, crowded, harsh photocopy grain, very high contrast.',
    subject: 'Photocopied hands and torn magazine figures',
    lettering: 'Main title in ransom-note mixed typefaces, some letters cut from halftone print, some hand-marker, slightly rotated with heavy black outline. Supporting text in typewriter monospace.',
    scene: 'Maximalist cut-and-paste zine collage. Torn magazine paper, coarse halftone textures and photocopied hands layered over acid green and purple, scribbled marker arcs, tape strips and stickers, deliberately messy, high-contrast photocopy grain.',
  },
  {
    id: 'fitness-training-glass', name: 'Midnight Glass', category: 'fitness',
    family: 'tech-futuristic',
    look: 'Glassmorphism over a dark gradient mesh. Deep indigo melting into teal and plum, frosted translucent rounded panels floating with soft blur and thin bright edge highlights, fine white line icons, glossy digital finish. Moody, modern, smooth, low clutter.',
    subject: 'Small line icons of a stopwatch and a barbell',
    lettering: 'Main title in clean geometric sans, semibold, pure white with a faint frosted glow. Supporting text in a light weight white at reduced opacity.',
    scene: 'Glassmorphism on a dark gradient mesh. Deep indigo blending into teal and plum, frosted translucent rounded panels floating with soft blur and thin bright edges, small line icons of a stopwatch and a barbell, glossy digital finish.',
  },
  {
    id: 'community-market-dawn', name: 'Butter Dawn', category: 'community',
    mergedInto: 'acreage', mergedWhy: 'Same pastel matte grain, lifted shadows and gentle unposed natural light',
    look: 'Wide environmental photograph in first light. Pale blue and butter-yellow low sun, soft pastel film grain, gentle matte finish, lifted shadows and creamy highlights. Natural wood and canvas tones, dew-fresh air, relaxed unposed framing, warm and inviting.',
    subject: 'Open-air produce market, trestle tables, crates of tomatoes and peaches, awnings, vendors setting up',
    lettering: 'Main title in a friendly rounded slab serif, chalk-white with a soft drop shadow. Supporting text in a small handwritten script with slightly uneven strokes.',
    scene: 'Open-air produce market at first light. Wooden trestle tables, crates of tomatoes and peaches, canvas awnings, dew on greens, vendors setting up. Wide environmental lens, pale blue and butter-yellow dawn light, soft pastel film grain, gentle matte finish.',
  },
  {
    id: 'community-benefit-gala', name: 'Candle Noir', category: 'community',
    mergedInto: 'business-awards-night', mergedWhy: 'Candlelit wood-panelled hall with champagne-gold engraved serif reads identically',
    look: 'Low-key night photograph. Deep navy shadows against warm candle gold, single-source portrait lighting, glowing small flames, rich wood tones and white linen highlights. High-contrast editorial finish, shallow depth, elegant and restrained.',
    subject: 'Wood-panelled hall, round tables, candles, silver paddles, a stylish crowd mid-applause',
    lettering: 'Main title in a high-contrast engraved serif with thin hairlines, brushed champagne-gold. Supporting text in widely letterspaced small capitals.',
    scene: 'Charity dinner in a wood-panelled hall after dark. Round tables, white linen, candle flames, silver bidding paddles, a stylish crowd mid-applause. Low-key portrait lighting, deep navy shadows against warm candle gold, high-contrast editorial finish.',
  },
  {
    id: 'community-parade-day', name: 'Crimson Noon', category: 'community',
    mergedInto: 'realestate-just-sold', mergedWhy: 'Same high-noon saturated digital finish with crisp shadows against open blue sky',
    look: 'Hard high-noon sun, tight telephoto compression flattening layers into a stacked frame. Crimson and cream sitting hot against clear blue, punchy saturated digital finish, glinting metallic highlights, crisp shadows, celebratory daytime energy with busy foreground detail and open sky above.',
    subject: 'Small-town parade: brass instruments, paper bunting across the street, confetti, families lining the kerb.',
    lettering: 'Main title in bold vintage circus capitals with an inline stripe and a thin cream keyline. Supporting text in condensed uppercase gothic.',
    scene: 'Small-town parade at high noon. Brass instruments catching hard sun, paper bunting strung across the street, confetti in the air, families lining the kerb. Tight telephoto compression, crimson and cream against blue sky, punchy saturated digital finish.',
  },
  {
    id: 'community-craft-fair', name: 'Linen Macro', category: 'community',
    mergedInto: 'rustic-kitchen', mergedWhy: 'Same soft-daylight natural-fibre earth palette and inked hand-lettering; only the camera angle differs',
    look: 'Overhead flat-lay on raw linen, soft north-window daylight raking gently across texture. Terracotta, oatmeal and sage palette, shallow macro depth on woven and handmade surfaces, natural matte paper finish, calm and uncluttered with generous negative space.',
    subject: 'Knitted scarves, thrown pottery, beeswax candles, dried lavender, pressed-flower cards.',
    lettering: 'Main title in a warm hand-lettered serif with inked, uneven strokes. Supporting text in a light typewriter face with visible ribbon texture.',
    scene: 'Overhead flat-lay of handmade goods on raw linen: knitted scarves, thrown pottery, beeswax candles, dried lavender, pressed-flower cards. Soft north-window daylight, terracotta, oatmeal and sage palette, shallow macro detail, natural matte paper finish.',
  },
  {
    id: 'community-blood-drive', name: 'Pale Teal Clinic', category: 'community',
    mergedInto: 'business-now-hiring', mergedWhy: 'Same shadowless white daylight interior with a pale accent tone and rounded geometric sans',
    look: 'Even daylight flooding through tall windows, almost shadowless. White, pale teal and warm skin tones, crisp clinical digital finish, low contrast and airy, orderly repeating shapes, calm and reassuring with plenty of clean open space.',
    subject: 'A row of padded recliners, folded blankets, juice cartons, people in soft scrubs, someone resting.',
    lettering: 'Main title in a clean geometric sans with rounded terminals, deep teal. Supporting text in a lighter weight of the same family with generous spacing.',
    scene: 'Bright community-hall donation clinic. Padded recliners in a row, folded blankets, juice cartons, volunteers in soft scrubs, a calm donor resting. Even daylight through tall windows, white, pale teal and warm skin tones, crisp clinical digital finish.',
  },
  {
    id: 'community-block-party', name: 'Amber Twilight', category: 'community',
    mergedInto: 'nightlife-beach-bonfire', mergedWhy: 'Same warm bulb light against deep blue twilight with 35mm grain and candid framing',
    look: 'Warm film grain, nostalgic 35mm finish. Amber bulb light glowing against a deep teal twilight sky, slight lens flare, soft falloff into shadow, candid unposed framing, rich golden highlights on faces and surfaces, lived-in and gently blurred at the edges.',
    subject: 'Folding tables end to end, grills smoking, string bulbs overhead, kids on bikes, people mid-laugh.',
    lettering: 'Main title in a chunky retro script with a thick outline and a hard offset shadow. Supporting text in bold rounded lowercase sans.',
    scene: 'Neighbourhood street closed for a party at dusk. Folding tables end to end, grills smoking, string bulbs overhead, kids on bikes, neighbours mid-laugh. Warm film grain, amber bulbs against deep teal twilight sky, slight lens flare, nostalgic 35mm finish.',
  },
  {
    id: 'community-cleanup-day', name: 'Lime Cobalt', category: 'community',
    family: 'bold-poster',
    look: 'Elevated wide angle looking down, drone-style geometry. Lime green and cobalt punching against wet green ground, crisp saturated digital finish, bright morning light with clean short shadows, high clarity, strong colour blocking and active diagonal composition.',
    subject: 'Volunteers in high-visibility vests with gloves, rakes, sacks of leaves and a wheelbarrow in a riverside park.',
    lettering: 'Main title in heavy squared-off sans capitals, lime green with a thick charcoal outline. Supporting text in plain bold uppercase, tightly tracked.',
    scene: 'Volunteers clearing a riverside park on a bright morning. High-visibility vests, work gloves, rakes, sacks of leaves, a wheelbarrow of mulch. Elevated drone-style wide angle looking down, lime green and cobalt against wet grass, crisp saturated digital finish.',
  },
  {
    id: 'community-honor-night', name: 'Slate Dusk', category: 'community',
    family: 'dark-luxury',
    look: 'Long-lens portrait depth with soft dusk haze and heavy background fall-off. Slate grey and burnt amber, restrained low-key finish, silhouetted forms against fading light, muted contrast, quiet and dignified, very little visual noise, deep shadow holding most of the frame.',
    subject: 'A stone plinth with a laurel wreath, folding chairs on gravel, an honour guard in silhouette, a lone bugler.',
    lettering: 'Main title in a stately transitional serif, small capitals in aged bronze with a fine embossed edge. Supporting text in quiet letterspaced roman.',
    scene: 'Civic memorial garden at last light. Stone plinth, laurel wreath, folding chairs on gravel, an honour guard standing at ease in silhouette, a lone bugler. Long-lens portrait depth, slate grey and burnt amber, soft dusk haze, restrained low-key finish.',
  },
  {
    id: 'community-volunteer-riso', name: 'Fresh Green Riso', category: 'community',
    family: 'halftone-print',
    look: 'Two-colour risograph print, kelly green and warm orange inks slightly misregistered so edges double. Heavy paper grain and ink speckle, flat uncoated matte stock, simplified flat shapes with overprint where inks cross, cheerful and rough, no photographic depth.',
    subject: 'People raking a park in the morning, rubber gloves and paper sacks.',
    lettering: 'Main title in chunky rounded sans capitals in solid orange ink, edges softly misregistered with a green ghost offset. Supporting text in a light typewriter face.',
    scene: 'Two-colour risograph print of neighbours raking a park in the morning, rubber gloves and paper sacks, kelly green and warm orange inks slightly misregistered, heavy paper grain and ink speckle, flat uncoated matte stock, cheerful and rough.',
  },
  {
    id: 'community-town-hall-woodtype', name: 'Broadside Bite', category: 'community',
    mergedInto: 'business-woodtype-hiring', mergedWhy: 'Black plus brick-red letterpress broadside with fleurons and deep bite, indistinguishable',
    look: 'Letterpress broadside on thick oatmeal cotton paper with a deckled edge, no photography at all. One black ink plus a faded brick-red rule, carved ornaments and printers\' fleurons, deep bite and inky impression, sober and typographic, high contrast on warm paper.',
    lettering: 'Main title in enormous slab-serif wood type, black with visible woodgrain and broken edges. Secondary lines in condensed antique gothic, letterspaced wide and deeply debossed.',
    scene: 'Letterpress broadside on thick oatmeal cotton paper, no photograph at all, one black ink with a faded brick-red rule, a carved pointing-hand ornament and simple printers\' fleurons, deep bite and inky impression, sober civic mood, deckled edge.',
  },
  {
    id: 'community-market-wash', name: 'Loose Wet Wash', category: 'community',
    family: 'hand-drawn',
    look: 'Loose watercolour with ink linework, wet-on-wet bleeds of sap green, ochre and raspberry pooling at edges. Pencil underdrawing showing through, large areas of open white paper, airy morning light, soft and imprecise, dry-brush breakup, relaxed and unfinished at the borders.',
    subject: 'Market stalls under striped awnings, crates of tomatoes, radishes and sunflowers.',
    lettering: 'Main title in a relaxed hand-painted brush script with translucent watery edges and dry-brush breakup. Supporting text in a small neat handwritten pen serif.',
    scene: 'Loose watercolour and ink-line sketch of market stalls under striped awnings, crates of tomatoes, radishes and sunflowers, wet-on-wet bleeds of sap green, ochre and raspberry, pencil underdrawing showing through, open white paper, airy morning light.',
  },
  {
    id: 'community-street-party-paper', name: 'Bright Cut Paper', category: 'community',
    family: 'collage-cutout',
    look: 'Layered construction paper in coral, teal, mustard and cream, torn and scissor-cut edges casting soft real shadows. Flat even daylight, matte fibrous surfaces, simplified silhouettes stacked in shallow planes, handmade craft-room feel, bright and friendly with no gradients.',
    subject: 'A closed street with folding tables, bunting and a seated crowd.',
    lettering: 'Main title cut from bright coral paper in fat geometric capitals with scissor-nicked edges and a soft paper shadow. Supporting text in a clean flat white sans.',
    scene: 'Cut-paper collage of a closed street with folding tables, bunting and a seated crowd, layered construction paper in coral, teal, mustard and cream, torn and scissor-cut edges casting soft real shadows, flat daylight, handmade craft-room feel.',
  },
  {
    id: 'community-remembrance-woodcut', name: 'Carved Woodblock', category: 'community',
    family: 'halftone-print',
    look: 'Hand-cut woodblock print on ivory laid paper, dense black cross-hatching building all the tone. One muted navy overprint, visible gouge marks and chipped linework, near-monochrome and high contrast, solemn and dignified, flat with no photographic light.',
    subject: 'A wreath of oak leaves and a plain stone marker.',
    lettering: 'Main title in engraved serif capitals carved from the block, crisp with tiny nicks, letterspaced wide. Supporting text in a small italic serif, black ink only.',
    scene: 'Hand-cut woodblock print on ivory laid paper, a wreath of oak leaves and a plain stone marker, dense black cross-hatching, one muted navy overprint, visible gouge marks and chipped linework, solemn and dignified, near-monochrome.',
  },
  {
    id: 'community-donor-drive-comic', name: 'Benday Pulp', category: 'community',
    mergedInto: 'services-comic-garage', mergedWhy: 'Same halftone comic panel; aged newsprint tone is a shade, not a different look',
    look: 'Vintage halftone comic panel on yellowed pulp newsprint. Heavy black outlines, benday dot shading, faded cyan and scarlet with slight plate misalignment, flat cel colour, exaggerated cheerful expressions and action framing, printed grit throughout.',
    subject: 'A beaming volunteer offering juice and cookies to someone seated in a folding chair.',
    lettering: 'Main title in bold comic display capitals with a thick black outline, scarlet fill and a cyan offset shadow. Supporting text in hand-lettered comic caption sans.',
    scene: 'Vintage halftone comic panel on newsprint, a beaming volunteer offering juice and cookies to a donor in a folding chair, heavy black outlines, benday dot shading, faded cyan and scarlet, yellowed pulp paper, hopeful action-comic energy.',
  },
  {
    id: 'community-parade-litho', name: 'Flat Litho Poster', category: 'community',
    family: 'retro-vintage',
    look: 'Mid-century travel-poster lithograph, flat simplified shapes with hard edges and no outlines. Cranberry, cream, teal and sky blue, fine print grain, confident 1950s optimism, bold stacked composition with silhouetted forms and generous flat sky, no gradients.',
    subject: 'Marching band silhouettes, a fire engine and balloons above a row of awnings.',
    lettering: 'Main title in wide mid-century geometric sans capitals, cream on cranberry, with a thin flat shadow. Supporting text in a light letterspaced grotesque.',
    scene: 'Mid-century travel-poster lithograph of a small-town parade, marching band silhouettes, a fire engine and balloons above a row of awnings, flat simplified shapes in cranberry, cream, teal and sky blue, fine print grain, confident 1950s optimism.',
  },
  {
    id: 'community-handmade-fair-stitch', name: 'Floss Sampler', category: 'community',
    mergedInto: 'sale-stitched', mergedWhy: 'Same embroidered floss texture and warm homespun palette, linen instead of felt',
    look: 'Embroidered sampler on natural linen, everything rendered in stitched floss with visible weave and stray thread ends. Rust, denim blue, olive and cream, raised satin and cross-stitch texture, warm lamp light casting tiny thread shadows, homespun, tactile and symmetrical.',
    subject: 'A cross-stitched cottage, a pie, a spool of thread and a daisy border.',
    lettering: 'Main title chain-stitched in rust floss with raised satin-stitch fill and visible needle holes. Supporting text in small even cross-stitch capitals in denim blue.',
    scene: 'Embroidered sampler on natural linen, a cross-stitched cottage, a pie, a spool of thread and a daisy border, floss in rust, denim blue, olive and cream, visible weave and stray thread ends, warm lamp light, homespun and tactile.',
  },
  {
    id: 'community-town-notice-swiss', name: 'Swiss Red Rule', category: 'community',
    mergedInto: 'sale-swiss-grid', mergedWhy: 'White field, red rule, black halftone accent, neutral grotesque; a lighter dose of the same look',
    look: 'Swiss International style. Vast white field, one thin red horizontal rule, a strict column grid faintly implied, a single small black-and-white halftone square. Cool neutral daylight, no ornament, crisp offset-litho finish, extreme calm and rigorous alignment.',
    subject: 'A small halftone photo of clasped hands.',
    lettering: 'Neutral neue-grotesque sans, medium weight, flush left and ragged right, black on white with generous leading and a single word set in red.',
    scene: 'Swiss International style. Vast white field, one thin red horizontal rule, a strict column grid faintly implied, a single black-and-white halftone square of clasped hands, cool neutral daylight, no ornament, crisp offset-litho finish.',
  },
  {
    id: 'community-night-fundraiser', name: 'Glass Tube Outline', category: 'community',
    family: 'neon-night',
    look: 'Near-black charcoal ground lit only by looping glass-tube outlines in electric cyan and hot magenta. Thin light trails, soft bloom halos, faint scanline haze, a wet reflective sheen along the lower edge. Cool, dark, high-contrast, saturated colour against deep black.',
    lettering: 'Glowing neon-tube capitals with rounded terminals, magenta core and cyan outer halo. Supporting text in a thin cool-white uppercase sans.',
    scene: 'Glowing neon tubes on near-black. Deep charcoal ground with looping tube outlines in electric cyan and hot magenta, thin light trails and soft bloom halos, faint scanline haze, wet reflective sheen along the lower edge, cool late-night mood.',
  },
  {
    id: 'community-helping-hands-clay', name: 'Matte Clay', category: 'community',
    mergedInto: 'services-clay-3d', mergedWhy: 'Same rounded pastel clay forms, soft shadows and bevelled clay letters',
    look: 'Soft 3D clay render. Rounded matte forms in pastel mint, peach and lavender floating over a plain putty backdrop. Soft global illumination, gentle contact shadows, velvety no-gloss surface, toy-like scale, low contrast, calm and uncluttered.',
    subject: 'A heart, a donation box, a tiny house',
    lettering: 'Extruded rounded 3D letters in matching matte clay with soft bevels and gentle cast shadow. Supporting text in a light rounded sans.',
    scene: 'Soft 3D clay render. Rounded matte forms — a heart, a donation box, a tiny house — in pastel mint, peach and lavender floating over a plain putty backdrop, soft global illumination, gentle contact shadows, velvety no-gloss surface, toy-like scale.',
  },
  {
    id: 'community-civic-hall-deco', name: 'Jade Deco', category: 'community',
    mergedInto: 'music-deco-night', mergedWhy: 'Same pale-card deco arches and metallic inline capitals with paper grain',
    look: 'Art-deco geometry on ivory card. Symmetrical stepped arches, radiating sunburst rays and fine parallel rules in jade green and copper. Subtle linen-paper grain, faint foxing at the corners, warm even light, formal 1930s printed-programme finish.',
    lettering: 'Tall narrow deco capitals with high waistlines and hairline inline stripes in copper, widely letterspaced, sitting between double jade rules.',
    scene: 'Art-deco geometry on ivory card. Symmetrical stepped arches, radiating sunburst rays and fine parallel rules in jade green and copper, subtle linen-paper grain, faint foxing at the corners, warm even light, formal 1930s programme finish.',
  },
  {
    id: 'community-fun-fair-postmodern', name: 'Confetti Memphis', category: 'community',
    mergedInto: 'sale-memphis', mergedWhy: 'Same postmodern scatter of squiggles and checkerboard slivers, only the hues shift',
    look: '1980s postmodern graphics. Squiggles, confetti dashes, checkerboard slivers and wobbly triangles in turquoise, bubblegum pink, black and lemon scattered across off-white. Playful asymmetry, flat bright light, slight print misregistration, busy and energetic.',
    lettering: 'Fat playful sans with a bouncing wonky baseline, alternating colours letter to letter and a hard black offset shadow.',
    scene: '1980s postmodern graphics. Squiggles, confetti dashes, checkerboard slivers and wobbly triangles in turquoise, bubblegum pink, black and lemon scattered across off-white, playful asymmetry, flat bright light, slight print misregistration, energetic finish.',
  },
  {
    id: 'community-together-glass', name: 'Frosted Mesh', category: 'community',
    mergedInto: 'sale-glass-panel', mergedWhy: 'Same violet-to-teal mesh with a translucent hairline-rimmed panel and airy app finish',
    look: 'Gradient mesh with frosted glass. Smooth blended wash of violet into teal into blush, a translucent panel floating over it with blurred edges and a fine white hairline rim. Tiny light refractions, calm airy modern-app finish, no texture anywhere.',
    lettering: 'Clean geometric sans in bright white, medium weight, generous letterspacing, faint soft glow, with some words in a lighter translucent weight.',
    scene: 'Gradient mesh with frosted glass. Smooth blended wash of violet into teal into blush, a translucent panel floating over it with blurred edges and a fine white hairline rim, tiny light refractions, calm airy modern-app finish, no texture anywhere.',
  },
  {
    id: 'music-jazz-cellar', name: 'Sepia Lamplight', category: 'music',
    family: 'photo-cinematic',
    look: 'Sepia and oxblood photography lit by a single hot lamp, brass highlights catching the beam. Haze drifting through the light, surroundings lost in deep shadow. Tight portrait lens, heavy warm film grain, moody low-key contrast, matte print finish.',
    subject: 'Brass instruments, cigarette smoke, brick arches',
    lettering: 'Main title in elegant high-contrast serif italic with fine hairline strokes and a soft warm glow. Supporting text in widely letterspaced small capitals.',
    scene: 'Late-night jazz cellar. Sepia and oxblood, brass instruments catching a single hot lamp, cigarette haze drifting through the beam, brick arches lost in shadow. Tight portrait lens, heavy warm film grain, moody low-key, matte print finish.',
  },
  {
    id: 'music-punk-basement', name: 'Xerox Flash', category: 'music',
    family: 'grunge-street',
    look: 'Pure black and white with hard direct flash blowing out everything close to the lens. Coarse grain, crushed blacks, blown highlights, photocopied contrast. Wide chaotic handheld lens, cramped low-ceiling framing, raw and unpolished.',
    subject: 'A packed crowd mid-surge, ceiling pipes, battered stacked amps',
    lettering: 'Main title in ransom-note mismatched heavy capitals, xeroxed and torn at the edges, harsh black on white with visible ink bleed.',
    scene: 'Sweaty basement punk show. Pure black and white, hard direct flash blowing out skin and cables, a packed crowd mid-surge, ceiling pipes overhead, battered amps stacked crooked. Wide chaotic lens, coarse grain, blown highlights, photocopied contrast.',
  },
  {
    id: 'music-porch-session', name: 'Sunbleached Golden Hour', category: 'music',
    family: 'warm-rustic',
    look: 'Dusty gold and faded denim blue under a low sun that flares through the frame. Weathered wood, honeyed haze, warm film grain, wide environmental lens, soft golden-hour light with long shadows and sun-bleached colour.',
    subject: 'An acoustic guitar and worn boots on pine porch boards, wheat field behind',
    lettering: 'Main title in tall western slab-serif capitals with hand-painted wood-grain texture and sun-bleached wear. Supporting text in a plain typewriter face.',
    scene: 'Golden-hour porch session. Dusty gold and faded denim blue, an acoustic guitar and worn boots on weathered pine boards, wheat field behind, low sun flaring through the railing. Wide environmental lens, warm film grain, honeyed haze.',
  },
  {
    id: 'music-concert-hall', name: 'Crimson Gilt', category: 'music',
    mergedInto: 'business-awards-night', mergedWhy: 'Crimson velvet and gilt under warm lamplight is the same glossy formal look',
    look: 'Deep crimson velvet and gilt against dark falling-away depth, warm chandelier lamplight pooling on polished wood and black surfaces. Wide symmetrical lens, clean digital capture, painterly contrast, lacquered glossy finish, formal and opulent.',
    subject: 'Gilt balconies, a cello, black formalwear, tiered seating',
    lettering: 'Main title in refined engraved serif capitals with fine gold foil edging and generous letterspacing. Supporting text in light roman small caps.',
    scene: 'Grand concert hall before the downbeat. Deep crimson velvet, gilt balconies, warm chandelier lamplight pooling on polished cello wood and black formalwear, tiered seats fading into dark. Wide symmetrical lens, clean digital capture, painterly contrast, lacquered finish.',
  },
  {
    id: 'music-warehouse-rave', name: 'Laser Fog', category: 'music',
    mergedInto: 'neonclub', mergedWhy: 'Same cyan/magenta beams slicing fog in a dark venue; only the venue wording differs',
    look: 'Cyan and magenta laser fans slicing through thick fog over bare concrete, wet floor reflecting the colour, raw steel structure above. Wide high-angle lens, clean digital, deep blacks, crisp glossy finish, hard coloured beams as the only light.',
    subject: 'Silhouetted hands raised in a crowd, steel trusses',
    lettering: 'Main title in wide techno sans capitals with a liquid chrome face and a thin cyan glow outline. Supporting text in tight monospaced uppercase.',
    scene: 'Concrete warehouse rave at 2am. Cyan and magenta laser fans slicing through fog, silhouetted hands raised, wet floor reflecting colour, raw steel trusses above. Wide high-angle lens, clean digital, deep blacks, crisp glossy finish.',
  },
  {
    id: 'music-karaoke-booth', name: 'Candy Vinyl', category: 'music',
    family: 'neon-night',
    look: 'Bubblegum pink and teal neon tubing against padded vinyl surfaces, tight flash-lit lens, soft pastel grade, slight lens haze, candy-glossy finish. Close cropping, warm late-evening interior, bright saturated colour with soft plastic highlights.',
    subject: 'A handheld mic, tambourine, half-finished drinks, laughing friends',
    lettering: 'Main title in rounded bubble capitals with a glossy plastic highlight and a teal drop shadow. Supporting text in a playful light sans-serif.',
    scene: 'Private karaoke booth, late evening. Bubblegum pink and teal neon tubing on padded vinyl walls, a handheld mic, tambourine and half-finished drinks, laughing friends mid-song. Tight flash-lit lens, soft pastel grade, slight lens haze, candy-glossy finish.',
  },
  {
    id: 'music-rooftop-set', name: 'Violet Dusk', category: 'music',
    mergedInto: 'services-roof-dusk', mergedWhy: 'Same silhouettes against a violet-to-amber dusk sky with high-contrast editorial clarity',
    look: 'Violet dusk sky over amber street lighting, city haze, figures in silhouette against the last light. Editorial mid-wide lens, high-contrast grade, cinematic clarity, cool sky against warm points of light, open-air elevated viewpoint.',
    subject: 'A turntable rig and speaker stack on tar paper, stylish crowd, skyline',
    lettering: 'Main title in bold brush-graffiti capitals with a thick white outline and a hard violet drop shadow. Supporting text in condensed uppercase sans.',
    scene: 'City rooftop set at dusk. Violet sky over amber streetlights, a turntable rig and speaker stack on tar paper, skyline haze, a stylish crowd in silhouette against the last light. Editorial mid-wide lens, high-contrast grade, cinematic clarity.',
  },
  {
    id: 'music-record-table', name: 'Warm Oak Flatlay', category: 'music',
    family: 'editorial-magazine',
    look: 'Overhead flat-lay on pale oak at midday. Cream, charcoal and burnt orange, objects arranged in an ordered grid. Soft window daylight, clean digital capture, gentle short shadows, matte paper finish, calm and uncluttered.',
    subject: 'A vinyl record half out of its sleeve, coiled headphones, brass cup, lyric notebooks',
    lettering: 'Main title in modern geometric sans capitals, tightly kerned and ink-black, with one word set in a fine handwritten script.',
    scene: 'Overhead flat-lay on a pale oak table at midday. Cream, charcoal and burnt orange: a vinyl record half out of its sleeve, headphones coiled, brass cup, scattered lyric notebooks. Soft window daylight, clean digital, gentle shadows, matte paper finish.',
  },
  {
    id: 'music-lesson-studio', name: 'Chalk Daylight', category: 'music',
    mergedInto: 'business-now-hiring', mergedWhy: 'Same chalk-white high-key space with mint accents and friendly rounded sans',
    look: 'Chalk-white walls, pale grey floor and mint accents with sunlight falling in clean rectangles. Airy wide lens, high-key digital, soft pale shadows, crisp clean finish, bright and low-contrast with plenty of empty space.',
    subject: 'Piano keys, an open violin case, a metronome, a child\'s stool',
    lettering: 'Main title in friendly rounded sans capitals in warm charcoal, with one word in a soft handwritten script. Supporting text in light spaced lowercase.',
    scene: 'Bright daytime teaching studio. Chalk-white walls, pale grey floor and mint accents, sunlight falling in clean rectangles across piano keys, an open violin case, a metronome, a child\'s stool. Airy wide lens, high-key digital, soft shadows, crisp clean finish.',
  },
  {
    id: 'music-record-shop', name: 'Faded Film Grain', category: 'music',
    family: 'retro-vintage',
    look: 'Mustard, teal and worn walnut, dust hanging in sunlight through a grubby window, curling paper scraps pinned up. Mid-wide slightly fisheye lens, faded seventies colour grade, matte finish, warm muted tones and lived-in clutter.',
    subject: 'Crates of record sleeves fingered open, a cork board',
    lettering: 'Main title in chunky seventies groove capitals with swollen curves, mustard fill and a thin cream inline. Supporting text in condensed uppercase serif.',
    scene: 'Daytime record shop aisle. Mustard, teal and worn walnut, crates of sleeves fingered open, dust and sunlight through a grubby front window, a cork board of curling paper scraps. Mid-wide slightly fisheye lens, faded seventies colour grade, matte finish.',
  },
  {
    id: 'music-salsa-night', name: 'Coral Motion Blur', category: 'music',
    mergedInto: 'food-smokehouse', mergedWhy: 'Same hot tungsten pools in a dark space with heavy warm saturation and deep shadow',
    look: 'Hot coral against deep turquoise, warm tungsten light pooling from overhead bulbs, hard leaf-shaped shadows raking a wooden floor, slow-shutter motion smear on any moving form, heavily saturated warm grade, glossy finish, mid-shot depth, humid glow.',
    subject: 'Tropical dance hall at midnight, dancers spinning, strung bulbs, sweating rum glasses.',
    lettering: 'Main title in swashy brush script with thick tapering strokes and a coral-to-gold gradient. Supporting text in bold condensed capitals, tightly stacked.',
    scene: 'Tropical dance hall at midnight. Hot coral and deep turquoise, palm-leaf shadows thrown across a wooden floor, dancers spinning into motion blur, tungsten bulbs strung overhead, rum glasses sweating. Slow-shutter mid-shot, saturated warm grade, glossy finish.',
  },
  {
    id: 'music-retro-jazz-litho', name: 'Litho Ember', category: 'music',
    mergedInto: 'community-parade-litho', mergedWhy: 'Same flat overlapping litho planes with grain and misregistration fringes',
    look: 'Mid-century lithograph printing. Limited ink palette of black, burnt orange and cream, flat overlapping planes with no gradients, visible litho grain, slight plate misregistration leaving colour fringes, matte uncoated paper finish, calm balanced composition.',
    subject: 'A small jazz combo on a low stage, upright bass and horn shapes.',
    lettering: 'Main title in tall geometric 1950s capitals with slightly overlapping letterforms and a hand-inked wobble. Supporting text in small spaced serif caps.',
    scene: 'Mid-century lithograph poster of a small combo on a low stage, upright bass and horn shapes, limited ink palette of black, burnt orange and cream, flat overlapping planes, visible litho grain and slight misregistration, matte paper finish.',
  },
  {
    id: 'music-punk-zine', name: 'Toner Riot', category: 'music',
    mergedInto: 'fitness-dance-collage', mergedWhy: 'Same torn-paper photocopy collage with ransom-note letters and an acid accent',
    look: 'Photocopied zine collage. Torn newsprint and ripped tape edges, blown-out high-contrast black and white, one acid green blot, staples and smudged toner, crowded chaotic overlapping layers, rough matte photocopy finish, no clean edges anywhere.',
    lettering: 'Main title in cut-out ransom-note letters from mismatched newsprint, uneven baseline, heavy toner smears and a black marker scrawl underline.',
    scene: 'Photocopied zine collage. Torn newsprint, ripped tape edges, blown-out high-contrast black and white with one acid green blot, staples and smudged toner, crowded chaotic layers, rough matte photocopy finish.',
  },
  {
    id: 'music-country-woodtype', name: 'Kraft Letterpress', category: 'music',
    family: 'warm-rustic',
    look: 'Letterpress broadside on kraft paper. Barn-red and deep indigo inks over tan stock, ornamental pressed rules, visible woodgrain texture, debossed impression with ink squash at the edges, dry uncoated finish, dense stacked bands of type and rule.',
    subject: 'A carved boot and fiddle motif.',
    lettering: 'Main title in fat slab-serif wood-type capitals with chipped edges and ink squash. Supporting text in condensed Victorian caps between hairline rules.',
    scene: 'Letterpress wood-type broadside on kraft paper. Ink-pressed ornamental rules, a carved boot and fiddle motif, barn-red and deep indigo inks over tan stock, visible woodgrain texture and debossed impression, dry uncoated finish.',
  },
  {
    id: 'music-metal-woodcut', name: 'Woodcut Blood', category: 'music',
    mergedInto: 'fitness-dojo-woodcut', mergedWhy: 'Same carved woodcut technique, black hatching plus one red ink on off-white paper — identical texture and palette',
    look: 'Hand-carved woodcut engraving. Dense black hatching building every form, bone-white paper showing through the gouges, one blood-red carved band, harsh graphic contrast with no midtones, dry raw-print finish, heavy and ominous.',
    subject: 'Storm clouds, a cracked mountain, skeletal hands raised.',
    lettering: 'Main title in gnarled blackletter carved from the same woodblock, thorny spurs and gouged white nicks cutting through the strokes.',
    scene: 'Woodcut engraving. Dense black hand-carved hatching of storm clouds, a cracked mountain and skeletal hands raised, bone-white paper showing through, one blood-red carved band, harsh graphic contrast, dry raw-print finish.',
  },
  {
    id: 'music-dj-riso', name: 'Riso Overprint', category: 'music',
    mergedInto: 'nightlife-riso-headphones', mergedWhy: 'Same fluorescent pink and electric blue overprinting to purple with split offset lettering',
    look: 'Two-colour riso screen-print. Fluorescent pink and electric blue inks overprinting into purple, forms reduced to flat halftone dot shapes, deliberate misregistration and roller streaks, grainy matte recycled stock, punchy and graphic.',
    subject: 'A turntable and dancing figures.',
    lettering: 'Main title in bold rounded sans capitals split into offset pink and blue layers with a purple overlap and speckled ink texture.',
    scene: 'Two-colour riso screen-print. Fluorescent pink and electric blue inks overprinting into purple, a turntable and dancing figures reduced to flat halftone dot shapes, deliberate misregistration and roller streaks, grainy matte recycled stock.',
  },
  {
    id: 'music-chalkboard-gig', name: 'Slate Chalk', category: 'music',
    mergedInto: 'food-chalkboard-coffee', mergedWhy: 'Same smudged chalk line work and hand-drawn capitals on slate black',
    look: 'Chalk drawing on a deep slate-black board. Smudged eraser clouds, white chalk line work with pops of yellow and mint, dusty powdery texture, soft edges, casual hand-made charm, everything sketched rather than printed, low-contrast matte surface.',
    subject: 'A handheld mic, sparkles and a small stage curtain.',
    lettering: 'Main title in chunky hand-drawn chalk capitals with double outlines and cross-hatch shading. Supporting text in loose chalk cursive.',
    scene: 'Chalkboard drawing. Deep slate-black board with smudged eraser clouds, white chalk sketches of a handheld mic, sparkles and a small stage curtain, pops of yellow and mint chalk, dusty powdery texture, casual pub blackboard finish.',
  },
  {
    id: 'music-hiphop-comic', name: 'Ben-Day Pulp', category: 'music',
    mergedInto: 'services-comic-garage', mergedWhy: 'Identical primary-colour halftone comic with starburst and hard-shadow comic caps',
    look: 'Halftone comic-book panel art. Bold black ink outlines around every shape, flat primary red, yellow and cyan fills, visible Ben-Day dot shading, speed lines and a starburst behind the focal point, glossy pulp-print finish, loud and energetic.',
    subject: 'A crowd with hands up and a mic cable snaking across.',
    lettering: 'Main title in inflated comic capitals with a thick black outline, white inner highlight and a hard yellow drop shadow.',
    scene: 'Halftone comic-book panel art. Bold black ink outlines, a crowd with hands up and a mic cable snaking across, flat primary red, yellow and cyan fills with visible Ben-Day dot shading, speed lines and a starburst, glossy pulp-print finish.',
  },
  {
    id: 'music-deco-night', name: 'Ivory Deco', category: 'music',
    family: 'retro-vintage',
    look: 'Art-deco geometry. Cream and deep ink-black with brushed brass arcs, stepped fan shapes and thin gold rules radiating from a half-circle, strict symmetry, calm and spacious, soft paper grain, elegant matte finish lifted by metallic sheen.',
    lettering: 'Main title in tall thin deco capitals with wide letterspacing, a fine gold inline stroke and hairline rules above and below. Supporting text in small elegant serif.',
    scene: 'Art-deco geometric composition. Cream and deep ink-black with brushed brass arcs, stepped fan shapes and thin gold rules radiating from a half-circle, symmetrical and calm, soft paper grain, elegant matte finish with metallic sheen.',
  },
  {
    id: 'music-recital-swiss', name: 'Vermilion Grid', category: 'music',
    mergedInto: 'sale-swiss-grid', mergedWhy: 'Vermilion rule and charcoal square on off-white with flush-left grotesque caps; same recipe',
    look: 'Swiss International layout. Warm off-white field, one vermilion rule and a single large charcoal square, disciplined margins, generous empty space, zero ornament, precise vector edges, flat uncoated print finish, quiet and exact.',
    lettering: 'Main title in clean grotesque capitals, medium weight, tight tracking, flush left, pure black with one word in vermilion. Supporting text small and lowercase.',
    scene: 'Swiss International style layout. Warm off-white field, one vermilion rule and a single large charcoal square, disciplined margins, wide empty space, no ornament, precise vector edges, flat uncoated print finish.',
  },
  {
    id: 'music-chrome-bass', name: 'Liquid Chrome', category: 'music',
    mergedInto: 'nightlife-liquid-chrome', mergedWhy: 'Same glossy 3D chrome blobs and mirrored metal capitals; only the backdrop colour differs',
    look: '3D studio render. Liquid chrome blobs and an inflated glossy sphere floating over a burnt-orange to deep-purple gradient, soft studio lighting with sharp specular highlights, subtle contact shadow on the floor, hyper-glossy plastic-and-metal finish.',
    lettering: 'Main title in extended heavy capitals rendered as polished liquid chrome with mirrored highlights and a dark bevelled underside. Supporting text in tight condensed uppercase.',
    scene: '3D render composition. Liquid chrome blobs and an inflated glossy sphere floating over a burnt-orange to deep-purple gradient, soft studio lighting with sharp specular highlights, subtle floor shadow, hyper-glossy plastic-and-metal finish.',
  },
  {
    id: 'music-album-drop', name: 'Frosted Iridescent', category: 'music',
    mergedInto: 'sale-glass-panel', mergedWhy: 'Frosted panels over a teal-lilac gradient mesh; the faint grain is too subtle to read as a different look',
    look: 'Glassmorphism over a gradient mesh. Frosted translucent panels floating on a soft iridescent blend of teal, lilac and coral, colour bleeding through the blur, faint noise grain, diffused even light, smooth silky digital finish, airy and weightless.',
    lettering: 'Main title in light geometric capitals, wide tracking, semi-transparent frosted white with a thin bright edge highlight. Supporting text in small light sans at low opacity.',
    scene: 'Glassmorphism gradient mesh. Frosted translucent panels floating over a soft iridescent blend of teal, lilac and coral, blurred colour bleeding through, faint noise grain, diffused light, smooth silky digital finish.',
  },
  {
    id: 'nightlife-rooftop-sunset', name: 'Coral Dusk Haze', category: 'nightlife',
    mergedInto: 'services-roof-dusk', mergedWhy: 'Same elevated dusk vantage with coloured sky, rim light and hazy depth',
    look: 'Clean digital photography at dusk from a high vantage. Coral and lilac sky, warm golden backlight rimming every edge, soft lens flare, hazy atmospheric depth, glass and bare-bulb highlights just switching on, relaxed airy mood, gentle contrast.',
    subject: 'Rooftop terrace above a city skyline, glass balustrades, crowd with cocktails.',
    lettering: 'Main title in tall airy sans-serif capitals with wide letterspacing and a soft coral-to-gold gradient fill. Supporting text in thin light uppercase, generously spaced.',
    scene: 'Rooftop terrace at dusk, camera high above a hazy city skyline. Coral and lilac sky, glass balustrades, bare-bulb string lights just switching on, a relaxed crowd holding cocktails, warm golden backlight, soft lens flare, clean digital photography.',
  },
  {
    id: 'nightlife-pool-party', name: 'Aqua Noon', category: 'nightlife',
    mergedInto: 'realestate-just-sold', mergedWhy: 'Same hard noon light, sharp shadows, glossy wet highlights and chunky outlined lettering',
    look: 'Crisp high-contrast digital photography under hard overhead midday sun. Saturated turquoise, white tile and chrome, sharp black shadows across pale concrete, water frozen mid-splash, brilliant highlights, clean glossy wet surfaces, bright and punchy.',
    subject: 'Pool deck, loungers, inflatable rings, splashing water.',
    lettering: 'Main title in chunky rounded bold capitals with a glossy wet highlight and a thin white outline. Supporting text in bouncy playful sans-serif.',
    scene: 'Midday pool deck under hard overhead sun. Turquoise water, white tile, chrome loungers and inflatable rings, splashing water frozen mid-air, sharp palm shadows across pale concrete, saturated aqua and white, crisp high-contrast digital photography.',
  },
  {
    id: 'nightlife-powder-party', name: 'Pigment Haze', category: 'nightlife',
    mergedInto: 'services-porch-groom', mergedWhy: 'Same low backlit sun, blown highlights, heavy grain and hand-painted lettering',
    look: 'Warm 35mm film photography in low late-afternoon sun. Clouds of magenta and yellow pigment hanging in backlit dusty air, blown highlights, heavy grain, colour smeared onto surfaces, hazy backlit glow, joyful and messy, soft-focus edges.',
    subject: 'Outdoor colour-powder party, sweaty smiling dancers streaked with pigment.',
    lettering: 'Main title in hand-painted brush capitals with wet drips, uneven edges and multicoloured splatter flecks. Supporting text in loose marker-style lowercase.',
    scene: 'Outdoor colour party in late afternoon, clouds of magenta and yellow powder pigment hanging in backlit dusty air. Sweaty smiling dancers, pigment streaked on arms and clothing, warm 35mm film grain, blown highlights, low hazy sun behind the crowd.',
  },
  {
    id: 'nightlife-cabaret', name: 'Velvet Tungsten', category: 'nightlife',
    mergedInto: 'business-awards-night', mergedWhy: 'Same crimson velvet, brass gilt and candle pools in heavy shadow',
    look: 'Warm tungsten glow in a small enclosed interior. Deep burgundy, crimson velvet and antique brass, gilt edging, candle-sized pools of light falling into heavy shadow, soft vignette at the corners, rich saturated colour, classic film grain, intimate and low-key.',
    subject: 'Cabaret room with velvet curtains, gilt frames, candlelit tables, feather fans and sequins',
    lettering: 'Main title in ornate high-contrast serif with elegant swashes and hairline strokes in warm brass foil. Supporting text in delicate italic script.',
    scene: 'Intimate cabaret room lit by tungsten lamps. Crimson velvet curtains, gilt frames, small round tables with candles, feather fans and sequins catching warm light, deep shadow, soft vignette, rich burgundy and brass palette, classic film grain.',
  },
  {
    id: 'nightlife-warehouse', name: 'Strobe Concrete', category: 'nightlife',
    family: 'grunge-street',
    look: 'Near-monochrome grey and white with one cold blue wash. Raw concrete and steel surfaces, hard white strobe light cutting through thick fog, blown highlights and crushed blacks, silhouettes against haze, gritty high-contrast documentary photography.',
    subject: 'Industrial warehouse interior, overhead beams and cable runs, a raised-hands crowd',
    lettering: 'Main title in stark stencil capitals, tightly packed, flat white with photocopy noise and a slight horizontal glitch offset. Supporting text in small monospaced uppercase.',
    scene: 'Raw concrete warehouse at peak hours, hard white strobe cutting through thick fog, steel beams and cable runs overhead, a silhouetted crowd with hands raised, near-monochrome grey and white with one cold blue wash, gritty documentary photography.',
  },
  {
    id: 'nightlife-new-year', name: 'Platinum Sparkle', category: 'nightlife',
    family: 'dark-luxury',
    look: 'Cool platinum, silver and ice-blue with warm lamp pools breaking the chill. Falling metallic flecks, crystal lens flare, long-exposure sparkle trails, glossy reflective surfaces, polished editorial finish, elegant and expensive.',
    subject: 'Midnight ballroom, raised coupes, tailored suits and sequin gowns, chandelier, confetti',
    lettering: 'Main title in polished platinum chrome capitals with a mirrored surface and fine sparkle glints. Supporting text in refined thin sans-serif, widely spaced.',
    scene: 'Elegant midnight ballroom, silver and champagne confetti falling through the air, coupes raised, tailored suits and sequin gowns, crystal chandelier flare, long-exposure sparkle trails, cool platinum and ice-blue palette with warm lamp pools, polished editorial finish.',
  },
  {
    id: 'nightlife-beach-bonfire', name: 'Firelight Grain', category: 'nightlife',
    family: 'photo-cinematic',
    look: 'Warm-versus-cold night photography. Flickering orange firelight raking across faces from below, indigo and pale moonlit blue behind, rising sparks, heavy 35mm grain, deep unlit shadow, natural unposed framing, soft focus falloff.',
    subject: 'Night beach, driftwood bonfire, blankets, damp sand, sea and moon behind',
    lettering: 'Main title in warm hand-drawn rough serif capitals with a charred smoky edge and faint ember glow. Supporting text in relaxed handwritten lowercase.',
    scene: 'Night beach around a driftwood bonfire. Orange firelight flickering across faces and blankets, indigo sea and pale moonlight behind, sparks rising, damp sand, heavy 35mm grain, deep shadow, warm-versus-cold contrast, natural unposed photography.',
  },
  {
    id: 'nightlife-garden-social', name: 'Sage Wash', category: 'nightlife',
    mergedInto: 'services-watercolour', mergedWhy: 'Same wet-bloom watercolour on paper with bristle-streaked brush lettering',
    look: 'Loose watercolour on cold-press paper. Sage green, blush and dove grey washes bleeding into one another, wet blooms and soft edges, dry-brush dotted highlights, twilight softness, airy matte finish, plenty of pale untouched paper.',
    subject: 'Walled garden at dusk with paper lanterns strung between trees, small suggested figures',
    lettering: 'Main title in flowing brush-lettered script with visible bristle streaks and translucent ink pooling at stroke ends. Supporting text in a light airy serif, widely spaced.',
    scene: 'Loose watercolour on cold-press paper. Twilight walled garden, paper lanterns strung between trees, sage green, blush and dove grey washes bleeding into each other, small figures suggested in wet blooms, dry-brush lantern dots, airy matte finish.',
  },
  {
    id: 'nightlife-drag-collage', name: 'Foil and Black Card', category: 'nightlife',
    family: 'collage-cutout',
    look: 'Layered construction-paper collage with torn edges and real cast shadows under studio light. Magenta, turquoise and gold, glossy black card silhouettes, scattered foil circles and starbursts, bold theatrical contrast, tactile paper texture.',
    subject: 'A performer silhouette and curtain strips',
    lettering: 'Main title cut from gold foil card with hand-scissored uneven edges, each capital tilted slightly and drop-shadowed. Supporting text in a narrow deco sans, hand-trimmed.',
    scene: 'Cut-paper collage of layered construction paper with torn edges and real cast shadows. Magenta curtain strips, turquoise and gold starbursts, a performer silhouette in glossy black card, scattered foil circles. Bold, theatrical, tactile, studio-lit.',
  },
  {
    id: 'nightlife-marker-splash', name: 'Splattered Paint Marker', category: 'nightlife',
    family: 'hand-drawn',
    look: 'Bold marker and ink on black paper. Fast confident brush-pen linework, splattered neon acrylic in lime, orange and cyan flung across the sheet, white paint-pen highlights, wet drips running down, raw matte poster-paint finish, energetic and unpolished.',
    subject: 'Loose figures mid-dance',
    lettering: 'Main title hand-drawn in dripping paint-brush capitals of uneven weight, streaked and splattered, with a scratchy white marker outline. Supporting text in quick handwritten caps.',
    scene: 'Bold marker and ink drawing on black paper. Fast brush-pen figures mid-dance, splattered neon acrylic in lime, orange and cyan flung across the sheet, white paint-pen highlights, wet drips running down, raw matte poster-paint finish.',
  },
  {
    id: 'nightlife-woodcut-midnight', name: 'Engraved Ink', category: 'nightlife',
    mergedInto: 'services-woodcut', mergedWhy: 'Same single-ink crosshatched engraving on cream with ornamental rules',
    look: 'Antique woodcut engraving in a single dense black ink on warm cream laid paper. Fine crosshatching and radiating line bursts, ornamental border rules, extremely high line detail, letterpress bite, visible paper tooth, no colour and no gradient.',
    subject: 'Champagne coupes, a pocket watch, bursting fireworks',
    lettering: 'Main title in ornate Victorian wood type capitals with heavy slab serifs, engraved inline shading and a decorative flourish rule. Supporting text in small caps between thin rules.',
    scene: 'Antique woodcut engraving, dense black ink hatching on warm cream laid paper. Champagne coupes, a pocket watch, bursting fireworks drawn as fine radiating lines, ornamental border rules, single colour, high detail, letterpress bite and visible paper tooth.',
  },
  {
    id: 'nightlife-midcentury-holiday', name: 'Litho Brick', category: 'nightlife',
    mergedInto: 'community-parade-litho', mergedWhy: 'Same limited flat litho palette, angular simplified shapes and overprint',
    look: 'Mid-century lithograph poster in a limited flat palette of brick red, teal, mustard and warm off-white. Visible print grain, slight ink overprint where colours meet, stylised angular shapes, simplified forms, retro matte finish, no photographic detail.',
    subject: 'Stylised people holding cocktail glasses, geometric evergreen shapes, angular furniture',
    lettering: 'Main title in wide geometric sans capitals with a hand-inked wobble, mustard fill and a teal offset shadow. Supporting text in a small friendly slab serif.',
    scene: 'Mid-century lithograph poster in a limited flat palette of brick red, teal, mustard and warm off-white, with visible print grain and slight ink overprint. Stylised partygoers holding cocktail glasses, geometric evergreen shapes, simple angular furniture, retro matte finish.',
  },
  {
    id: 'nightlife-bold-poster', name: 'Scarlet Grid', category: 'nightlife',
    family: 'bold-poster',
    look: 'Flat Swiss poster graphic in two colours only, scarlet red and ink black on bone white. Hard geometric grid, thick horizontal rules, one enormous red circle, generous empty margins, matte offset print texture, no photograph and no gradient.',
    lettering: 'Tight grotesque capitals set very heavy with ultra-tight tracking, pure black and scarlet, no effects at all. Supporting text in light small capitals.',
    scene: 'Flat Swiss poster graphic in two colours only, scarlet red and ink black on bone white. Hard geometric grid, thick horizontal rules, one enormous red circle, generous empty margins, matte offset print texture, no photograph and no gradient.',
  },
  {
    id: 'nightlife-memphis-pop', name: 'Memphis Confetti', category: 'nightlife',
    family: 'flat-vector',
    look: 'Memphis postmodern composition on cream. Mint, hot pink, tangerine and cobalt shapes, squiggles, checkerboard strips, terrazzo speckles, tilted triangles and floating dots, flat vector artwork, crisp screen-print finish, playful eighties graphic energy.',
    lettering: 'Chunky rounded display capitals in candy colours, each letter a different hue, with a thin black outline and a hard offset drop shadow.',
    scene: 'Memphis postmodern composition on cream. Mint, hot pink, tangerine and cobalt shapes, squiggles, checkerboard strips, terrazzo speckles, tilted triangles and floating confetti dots, flat vector artwork, crisp screen-print finish, playful eighties graphic energy.',
  },
  {
    id: 'nightlife-deco-gold', name: 'Gilded Deco', category: 'nightlife',
    family: 'retro-vintage',
    look: 'Art-deco geometry in deep emerald and midnight ink with fine champagne-gold linework. Fan rays, stepped arches, a symmetrical sunburst and thin concentric arcs, flat illustration with a subtle metallic foil sheen, elegant nineteen-twenties poster finish.',
    lettering: 'Slim high-waisted deco capitals with thin gold inline stripes, wide letterspacing, hairline serifs and a delicate foil shine.',
    scene: 'Art-deco geometry in deep emerald and midnight ink with fine champagne-gold linework. Fan rays, stepped arches, a symmetrical sunburst and thin concentric arcs, flat illustration with a subtle metallic foil sheen, elegant nineteen-twenties poster finish.',
  },
  {
    id: 'nightlife-clay-3d', name: 'Soft Clay', category: 'nightlife',
    mergedInto: 'sale-clay-3d', mergedWhy: 'Same matte pastel clay render, balloons and puffy 3D rounded lettering',
    look: 'Soft 3D clay render on a matte lavender backdrop. Putty-pink, butter-yellow and sky-blue, rounded seamless forms, gentle broad studio light, soft shadows, zero gloss, toy-like tactile finish, calm and friendly.',
    subject: 'Balloons, rounded cylinders, a tilted disc and tiny spheres',
    lettering: 'Inflated puffy 3D rounded capitals in matte clay pink with soft edges, gentle top light and a diffuse shadow beneath.',
    scene: 'Soft 3D clay render on a matte lavender backdrop. Putty-pink, butter-yellow and sky-blue balloons, rounded cylinders, a tilted disc and tiny spheres, gentle broad studio light, soft shadows, no gloss, toy-like tactile finish.',
  },
  {
    id: 'nightlife-liquid-chrome', name: 'Liquid Chrome', category: 'nightlife',
    family: 'tech-futuristic',
    look: 'Dark graphite void with floating liquid chrome forms and rippling mercury ribbons. Iridescent oil-slick reflections of violet, teal and silver, sharp specular highlights, high-gloss mirror finish, cold futuristic 3D render, no visible light fixtures.',
    lettering: 'Polished liquid-metal capitals with mirrored chrome reflections, stretched highlights and a faint iridescent violet rim.',
    scene: 'Dark graphite void holding a floating liquid chrome blob and rippling mercury ribbons. Iridescent oil-slick reflections of violet, teal and silver, sharp specular highlights, high-gloss mirror finish, cold futuristic 3D render, no visible light fixtures.',
  },
  {
    id: 'nightlife-riso-headphones', name: 'Neon Purple Overprint', category: 'nightlife',
    family: 'halftone-print',
    look: 'Two-ink risograph print on rough newsprint. Fluorescent pink and electric blue overlapping and misregistering into purple, grainy paper speckle throughout, visible halftone dots, ink-starved patches, flat simplified shapes, cheerful and loud.',
    subject: 'A crowd wearing headphones',
    lettering: 'Main title in chunky rounded sans capitals printed twice with a deliberate offset, pink behind blue, edges slightly ink-blotted. Supporting text in small typewriter mono.',
    scene: 'Two-ink risograph print on rough newsprint. Fluorescent pink and electric blue overlap and misregister into purple, grainy paper speckle throughout, a dancing crowd wearing headphones drawn as flat shapes, visible halftone dots, ink-starved patches, cheerful and loud.',
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
  /**
   * WHAT THE CUSTOMER WANTS PICTURED, in their own words.
   *
   * This used to arrive at the very bottom of the prompt as "ALSO: change the
   * ice cream to an HVAC van", underneath a DESIGN STYLE paragraph that opened
   * with "Ice cream parlour". The model read that exactly as written — draw an
   * ice cream parlour, and also a van — and the ice cream won every time. It
   * was not being stubborn; it was obeying the louder instruction.
   *
   * Now it REPLACES the style's own subject and is stated first. The style's
   * palette, lettering and texture are untouched, so "Thanksgiving colours,
   * HVAC van" is a normal thing to ask for rather than a fight.
   */
  subject = '',
  /**
   * Keep the style's own motif — the pumpkins, the disco ball.
   *
   * Off by default. Somebody browsing for a LOOK is not asking for the props
   * that happened to be in the sample, and getting them anyway is the single
   * complaint that started all of this.
   */
  keepMotif = false,
): string {
  // What ends up pictured, in priority order: what the customer asked for, or
  // the style's own motif if they chose to keep it, or nothing — in which case
  // the model composes around the words, which is a perfectly good flyer.
  const wants = String(subject ?? '').trim()
  const motif = wants || (keepMotif ? String(t.subject ?? '').trim() : '')
  // A style that has been split has a `look` with no subject buried in it. One
  // that has not falls back to the old mixed paragraph — which still carries
  // its own motif, so overriding the subject on those is best-effort until the
  // whole list is split.
  const style = t.look?.trim() || t.scene
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
    // WHAT IS PICTURED, ALWAYS FIRST — including when a reference was uploaded.
    //
    // A reference and a subject do not compete: the reference says how to draw,
    // the customer says what to draw. Dropping the subject here would recreate
    // the original complaint one layer up — "I uploaded a design I liked and it
    // ignored what I asked for".
    reference && wants ? `SUBJECT — THIS IS WHAT THE DESIGN PICTURES: ${wants}\n` : '',
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
      : [
          // THE SUBJECT GOES FIRST, and the style is explicitly demoted to a
          // way of drawing it. Order is not cosmetic here: whatever opens the
          // prompt is what gets drawn.
          motif ? `SUBJECT — THIS IS WHAT THE DESIGN PICTURES: ${motif}` : '',
          motif && !t.look
            // The unsplit styles still have their own props welded into the
            // style paragraph, so the override has to be said out loud.
            ? 'Picture the subject above and NOTHING ELSE. The style description below may mention other objects, seasons or scenes — ignore every one of them. They describe how to draw, not what to draw.'
            : '',
          motif ? '' : '',
          `DESIGN STYLE — HOW IT IS DRAWN${motif ? ', not what is in it' : ''}: ${style}`,
          !motif && !keepMotif && t.look
            // No subject and no motif is a legitimate choice, not an omission.
            // Said plainly, or the model invents a scene to fill the space.
            ? 'No specific subject. Build the design from typography, colour, pattern and texture in that style — abstract shapes and fields rather than an invented scene.'
            : '',
        ].filter(Boolean).join('\n'),
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

/**
 * The looks a customer actually chooses between.
 *
 * The full list still holds all 225, because every one of them is somebody's
 * saved design. This is the shorter list with the duplicates folded away — a
 * picker where a third of the entries look alike teaches people that choosing
 * does not matter, so they stop looking and take the first one.
 */
export const VISIBLE_STYLES: FlyerTemplate[] = FLYER_TEMPLATES.filter((t) => !t.mergedInto)

/**
 * Follow a style id to the look that is actually shown.
 *
 * A design saved months ago names a style that may since have been folded into
 * another. Reopening it has to land somewhere real — "style not found" is not
 * something the person who made it can act on.
 */
export function resolveStyle(id: string): FlyerTemplate | undefined {
  let t = FLYER_TEMPLATES.find((x) => x.id === id)
  // Bounded rather than `while (t?.mergedInto)`. A loop in the data would
  // otherwise hang the page that is drawing it, which is a far worse failure
  // than a style resolving one hop short of home.
  for (let hop = 0; hop < 8 && t?.mergedInto; hop++) {
    const next: string = t.mergedInto
    t = FLYER_TEMPLATES.find((x) => x.id === next)
  }
  return t
}

/** The shelves in the picker, biggest first, grouped by LOOK not by industry. */
export const STYLE_FAMILIES: { id: string; label: string; count: number }[] = (() => {
  const label: Record<string, string> = {
    'photo-cinematic': 'Photographic', 'retro-vintage': 'Retro & vintage',
    'dark-luxury': 'Dark & luxurious', 'halftone-print': 'Print & halftone',
    'minimal-type': 'Minimal & typographic', 'soft-pastel': 'Soft & pastel',
    'hand-drawn': 'Hand-drawn', 'neon-night': 'Neon & night',
    'clean-corporate': 'Clean & corporate', 'playful-cartoon': 'Playful & cartoon',
    'bold-poster': 'Bold poster', 'grunge-street': 'Grunge & street',
    'warm-rustic': 'Warm & rustic', 'collage-cutout': 'Collage & cut-paper',
    'gradient-modern': 'Gradient & glass', 'flat-vector': 'Flat vector',
    'tech-futuristic': 'Tech & futuristic', 'editorial-magazine': 'Editorial',
    'nature-organic': 'Natural & organic', 'elegant-script': 'Elegant script',
  }
  const n: Record<string, number> = {}
  for (const t of VISIBLE_STYLES) if (t.family) n[t.family] = (n[t.family] ?? 0) + 1
  return Object.entries(n)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ id, label: label[id] ?? id, count }))
})()

/**
 * Every motif that came off a style when its look was separated out.
 *
 * The pumpkins did not go in the bin. This is what you pick from when you DO
 * want them — and unlike before, any motif can go on any look.
 */
export const MOTIFS: { id: string; text: string }[] = FLYER_TEMPLATES
  .filter((t) => (t.subject?.trim().length ?? 0) > 4)
  .map((t) => ({ id: t.id, text: t.subject!.trim() }))

/** Where a template's sample image lives once it has been pre-generated. */
export const thumbUrl = (id: string) => `/flyer-templates/${id}.png`

/**
 * The SAME look carrying an ordinary job: a service van, a phone number, a price.
 *
 * The sample tile shows whatever that style was originally about — pumpkins,
 * a club crowd, an ice cream cone — and that picture makes a promise the style
 * no longer keeps. Somebody running a heating business scrolls straight past
 * the warm hand-lettered one, even though its colours and its type are exactly
 * what they were looking for.
 *
 * A sentence saying "you can use this for anything" is a claim. This is the
 * same claim as a picture, which is the version people believe.
 */
export const proofUrl = (id: string) => `/flyer-templates/${id}-alt.webp`
