// The test bench: fictional businesses to generate against.
//
// Deliberately spread across the cases that break logo generators in different
// ways — a name that must be spelled right, a category with no obvious object,
// an industry with a cliché begging to be drawn, and one where the honest
// answer is no symbol at all.
//
// Fictional on purpose. Real company names would pull the model toward the
// existing mark and measure recall rather than design.

export const BRANDS = [
  {
    id: 'meridian',
    name: 'MERIDIAN',
    what: 'an architecture practice working on civic and cultural buildings',
    positioning: 'precision',
    concept: 'a horizon line and a plumb line, reduced to their simplest intersection',
    colour: 'a single solid near-black ink on white',
    // The cliché to avoid: a little house, a skyline, a pencil.
  },
  {
    id: 'thicket',
    name: 'THICKET',
    what: 'a botanical skincare brand using cold-pressed plant oils',
    positioning: 'quiet abundance',
    concept: 'overlapping leaf forms whose negative space reads as a droplet',
    colour: 'one solid deep green ink on white',
  },
  {
    id: 'halden',
    name: 'HALDEN & CO.',
    what: 'a private wealth management firm serving families across generations',
    positioning: 'discretion',
    // No concept: this one SHOULD come back as pure typography.
    colour: 'solid ink navy on white',
  },
  {
    id: 'northbound',
    name: 'NORTHBOUND',
    what: 'an outdoor outfitter making hard-wearing canvas and leather gear',
    positioning: 'endurance',
    concept: 'a compass needle and a mountain ridge resolved into one continuous form',
    colour: 'one solid rust-brown ink on white',
  },
  {
    id: 'corvid',
    name: 'CORVID',
    what: 'a cybersecurity consultancy specialising in threat intelligence',
    positioning: 'watchfulness',
    // The cliché to avoid: a padlock, a shield, a hooded figure, "tech blue".
    colour: 'a single solid near-black ink on white',
  },
  {
    id: 'kilnwork',
    name: 'KILNWORK',
    what: 'a ceramics studio producing small-batch tableware for restaurants',
    positioning: 'the hand',
    colour: 'one solid terracotta ink on white',
  },
  {
    id: 'aperture',
    name: 'APERTURE HEALTH',
    what: 'a diagnostics company making early-detection blood tests',
    positioning: 'clarity',
    // The cliché to avoid: a cross, a heart, a caduceus, a DNA helix.
    colour: 'one solid clinical blue ink on white',
  },
  {
    id: 'ferrymead',
    name: 'FERRYMEAD',
    what: 'a small-batch distillery on an estuary',
    positioning: 'place',
    colour: 'a single solid near-black ink on white',
  },
]

export const byId = (id) => BRANDS.find((b) => b.id === id)

// ── monogram bench ──────────────────────────────────────────────────────────
//
// The premium end. Initials are the hardest thing to do well — letters have to
// be BUILT into one object rather than set side by side — and the easiest place
// to look cheap, because a bad monogram is just two letters touching.
//
// Each carries a palette, because the earlier runs were all single-ink: correct
// for testing craft, wrong for showing anyone what they are buying.
export const MONOGRAM_BRANDS = [
  {
    id: 'ahg',
    name: 'AFFINITY HEALTH GROUP',
    initials: 'AHG',
    what: 'a group of primary care clinics',
    positioning: 'steady care',
    palette: 'a deep teal and a warm coral',
  },
  {
    id: 'htm',
    name: 'HARTMAN TRUST MANAGEMENT',
    initials: 'HTM',
    what: 'a trust and estate management firm',
    positioning: 'permanence',
    palette: 'a deep navy and a muted gold',
  },
  {
    id: 'bx',
    name: 'BOXWORTH EXCHANGE',
    initials: 'BX',
    what: 'a commodities trading exchange',
    positioning: 'momentum',
    // Two letters is the hardest case of all — there is nowhere to hide.
    palette: 'a strong ink black and a signal orange',
  },
]
