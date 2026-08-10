// =============================================================================
// Logo engine.
//
// Everything needed to turn a brief into an instruction for an image model —
// and NOTHING else. It imports nothing, like the flyer engine, so it can be
// lifted into a standalone product without dragging the app behind it.
//
// THE SHAPE OF THIS FILE IS DELIBERATE. Every claim about what makes a logo
// good is a separate, named, individually removable piece:
//
//   HOUSE_RULES   — a dozen craft rules, each one addressable by id
//   STYLE_STEERS  — the reference vocabularies, swappable
//   MARK_TYPES    — what KIND of logo, chosen strategically
//
// That is what makes the research possible. To find out which rules actually
// carry the quality you must be able to drop exactly one and regenerate; to
// find out whether naming studios beats saying "modern and professional" you
// must be able to swap only the steer. A single hard-coded prompt string can
// be admired but not tested.
//
// The central unproven claim this exists to settle: that the quality of the
// first eight samples came from the CONSTRAINTS, not the model.
// =============================================================================

/** What kind of logo this is. Choosing correctly is strategy, and it is free. */
export type MarkTypeId =
  | 'wordmark' | 'monogram' | 'pictorial' | 'abstract' | 'combination' | 'emblem'

export type MarkType = {
  id: MarkTypeId
  label: string
  /** When a designer would actually reach for it. */
  suits: string
  /** The art direction that produces it. */
  direction: string
}

export const MARK_TYPES: MarkType[] = [
  {
    id: 'wordmark',
    label: 'Wordmark',
    suits: 'A distinctive name worth teaching. Professional services, fashion, publishing.',
    direction:
      'A pure WORDMARK: the company name set as the logo itself. No symbol, no icon, no line, no crest, no container. The typography IS the logo, so the letterforms must carry all of the character — one considered detail is enough.',
  },
  {
    id: 'monogram',
    label: 'Lettermark / monogram',
    suits: 'Long or unwieldy names. Institutions.',
    direction:
      'A MONOGRAM built from the initials only, constructed geometrically so the letters interlock or share strokes as one deliberate form. Not letters placed side by side — a single built object.',
  },
  {
    id: 'pictorial',
    label: 'Pictorial mark',
    suits: 'A concrete object genuinely stands for the business.',
    direction:
      'A PICTORIAL mark: one recognisable object, reduced to its simplest confident silhouette. Simplified to the fewest shapes that still read instantly — not an illustration, not a detailed drawing.',
  },
  {
    id: 'abstract',
    label: 'Abstract mark',
    suits: 'Categories with no obvious object, or businesses spanning several.',
    direction:
      'An ABSTRACT geometric mark: a non-representational form that suggests the idea without depicting anything literal. It must feel constructed and inevitable rather than decorative.',
  },
  {
    id: 'combination',
    label: 'Combination mark',
    suits: 'The safe default. Works split apart or together.',
    direction:
      'A COMBINATION mark: one simple symbol above the company name, sized so the two read as a single balanced lockup and either part could stand alone.',
  },
  {
    id: 'emblem',
    label: 'Emblem',
    suits: 'Heritage, craft, institutions. Poor at small sizes.',
    direction:
      'An EMBLEM: the name held inside a single contained shape, drawn as one unified badge. Restrained — a small number of elements, not a crowded crest.',
  },
]

// =============================================================================
// MONOGRAM CONSTRUCTION
//
// The premium end of identity work, and the hardest. A monogram is not letters
// placed side by side — it is letters BUILT into a single object. That
// construction decision is the whole design, so it has to be an explicit
// instruction rather than something hoped for.
//
// Every one of these is flat and solid, which keeps the vector conversion clean
// (see the tracing work — the house style is load-bearing in two places).
// =============================================================================

export type MonogramStyleId =
  | 'interlock' | 'stacked' | 'nested' | 'shared-stem' | 'contained'
  | 'negative' | 'modular' | 'ligature' | 'overlap' | 'rotational'

export const MONOGRAM_STYLES: { id: MonogramStyleId; label: string; direction: string }[] = [
  {
    id: 'interlock',
    label: 'Interlocked',
    direction:
      'The letters INTERLOCK — they merge and share strokes so the result reads as ONE continuous constructed object rather than separate characters. Where two letters meet they become the same line.',
  },
  {
    id: 'stacked',
    label: 'Stacked block',
    direction:
      'The letters are STACKED into a tight rectangular block, each sized and stretched so their edges align flush on all sides — a solid slab of type with no gaps at the outer edge.',
  },
  {
    id: 'nested',
    label: 'Nested',
    direction:
      'The smaller letters sit NESTED inside the counter — the enclosed white space — of the largest letter, sized so the whole thing reads as one balanced shape.',
  },
  {
    id: 'shared-stem',
    label: 'Shared stem',
    direction:
      'The letters SHARE a single vertical stroke, so one stem does the work of two or three characters. The economy of it is the idea.',
  },
  {
    id: 'contained',
    label: 'Contained',
    direction:
      'The letters sit inside a simple geometric container — a circle or a square — sized so they nearly touch its edge. The container is a plain solid shape with no ornament, no ring of text, no border pattern.',
  },
  {
    id: 'negative',
    label: 'Negative space',
    direction:
      'The letters are formed ENTIRELY by the negative space cut out of one solid geometric shape. The ink is the background; the letters are the gaps. It must still read instantly.',
  },
  {
    id: 'modular',
    label: 'Modular grid',
    direction:
      'The letters are constructed from a strict geometric module — the same circle radius, the same square, the same 45-degree angle used throughout — so every curve and corner in the mark is visibly the same size. A visible underlying system.',
  },
  {
    id: 'ligature',
    label: 'Ligature',
    direction:
      'The letters are joined as a LIGATURE, flowing into one another as a single connected stroke, the way an ampersand joins an E and a T. One unbroken form.',
  },
  {
    id: 'overlap',
    label: 'Overlapping',
    direction:
      'The letters OVERLAP, and where they cross, the intersection is filled with a third flat colour — a deliberate transparency effect built from solid shapes, never a gradient. The overlaps are the point of interest.',
  },
  {
    id: 'rotational',
    label: 'Rotational',
    direction:
      'The letters are arranged with rotational symmetry — one form repeated at 90 or 180 degrees to build the others — so the mark reads as a deliberate geometric system rather than a row of characters.',
  },
]

// =============================================================================
// COLOUR
//
// The first eight samples were all single-ink, which is correct for testing
// craft and wrong for showing a customer what they are buying. Colour is a
// large part of what makes an identity feel considered rather than austere.
//
// All of these stay FLAT and countable — no gradients — because a gradient
// breaks the vector conversion and fails the one-colour test at the same time.
// =============================================================================

export type ColourWayId = 'mono' | 'two-tone' | 'overlap-blend' | 'block' | 'accent' | 'duo-split'

export const COLOUR_WAYS: { id: ColourWayId; label: string; direction: string }[] = [
  { id: 'mono', label: 'Single ink', direction: 'ONE solid ink on white. No second colour anywhere.' },
  {
    id: 'two-tone', label: 'Two flat colours',
    direction: 'TWO flat solid colours, used deliberately — one per letter, or one for the mark and one for its counterpart. Both must be strong enough to hold their own; no tints, no gradients, no transparency.',
  },
  {
    id: 'overlap-blend', label: 'Two colours plus overlap',
    direction: 'TWO flat solid colours, plus a THIRD flat colour only where the shapes overlap — a built transparency effect made from solid shapes. Exactly three flat colours, no gradients.',
  },
  {
    id: 'block', label: 'Knockout of a colour block',
    direction: 'The mark is knocked OUT of a solid block of one strong colour — the letters are the white of the paper showing through. Two colours at most: the block, and the paper.',
  },
  {
    id: 'accent', label: 'One ink plus an accent',
    direction: 'Mostly ONE dark ink, with a SINGLE small element in one bright accent colour — a counter, a dot, a joining stroke. The accent must be small enough that the mark still works without it.',
  },
  {
    id: 'duo-split', label: 'Split colour',
    direction: 'The mark is split across a straight edge — one half in one flat colour, the other half in a second — as if lit from one side. Two flat colours, a clean straight division, no blending.',
  },
]

// =============================================================================
// THE HOUSE RULES
//
// Each is separately identified so exactly one can be removed and the effect
// measured. The assumption is that they all matter; the strong suspicion is
// that three of them do most of the work and the rest are ceremony. Until that
// is measured, nobody knows which — including whoever wrote them.
// =============================================================================

export type HouseRule = { id: string; text: string }

export const HOUSE_RULES: HouseRule[] = [
  {
    id: 'flat',
    text: 'FLAT VECTOR. Pure solid shapes only. No gradient, no 3D, no bevel, no emboss, no drop shadow, no glow, no reflection, no texture, no photorealism.',
  },
  {
    id: 'one-idea',
    text: 'ONE IDEA, executed simply. Not a scene, not a collage of symbols, not a mascot, not several concepts combined.',
  },
  {
    id: 'geometry',
    text: 'Built geometrically: consistent stroke weights, deliberate optical balance, clean curves and true tangents where curves meet lines.',
  },
  {
    id: 'small-test',
    text: 'It must still read at 8mm on a business card and remain distinguishable at 16 pixels.',
  },
  {
    id: 'one-colour',
    text: 'It must work in ONE colour. If it needs more than one ink to be legible, it has failed.',
  },
  {
    id: 'ban-list',
    text: 'NO clipart, NO swooshes, NO generic globes, NO lightbulbs, NO gears, NO handshakes, NO cartoon characters, NO shields-with-everything, NO stock startup gradients, NO sparkles, NO circles-of-dots-around-a-word.',
  },
  {
    id: 'not-literal',
    text: 'Do NOT draw the literal thing the business sells. Distinctive beats descriptive — a mark should be memorable, not explanatory.',
  },
  {
    id: 'clean-frame',
    text: 'NOTHING in the frame except the logo itself, centred on plain white with generous empty margin. No mockup, no business card, no packaging, no hand, no desk, no presentation board, no colour swatches, no alternate versions, no grid lines, no annotations, no text describing the logo.',
  },
  {
    id: 'lettering',
    text: 'Any lettering must be flawlessly spelled, evenly spaced and properly kerned.',
  },
  {
    id: 'reduction',
    text: 'Reduce until nothing more can be removed. If it could not be drawn from memory after seeing it twice, it is too complicated.',
  },
  {
    id: 'negative-space',
    text: 'If negative space is used, the shape must read correctly FIRST and reveal the second reading afterwards. Cleverness that has to be pointed out has failed.',
  },
]

// =============================================================================
// STYLE STEERS
//
// The most important experiment in the whole product. These models learned from
// the internet's logo corpus, and that corpus is dominated by Dribbble — which
// rewards a thumbnail that pops in a feed rather than a mark that survives
// being embroidered on a shirt.
//
// `plain` is what every competitor writes. `studios` is the claim. Running them
// against each other settles it — and if `plain` wins, the premise of the
// product is wrong and it is worth knowing that cheaply.
// =============================================================================

export type SteerId = 'none' | 'plain' | 'era' | 'studios' | 'anti' | 'full'

export const STYLE_STEERS: Record<SteerId, string> = {
  none: '',

  plain: 'Style: modern, professional, clean, minimal.',

  era: 'VISUAL LANGUAGE: the tradition of 1950s–1970s corporate identity design — the era that invented the modern trademark. Confident, reduced, systematic, built to last decades rather than to look current.',

  studios: 'VISUAL LANGUAGE: in the tradition of Chermayeff & Geismar, Paul Rand, Saul Bass, Otl Aicher and Massimo Vignelli. Reduced, geometric, confident, timeless. The kind of mark a serious institution commissions once and keeps for forty years.',

  anti: 'AVOID ENTIRELY the aesthetic of Dribbble, Behance trending, Fiverr, stock vector marketplaces and logo template sites: gradient blobs, line-art animals, decorative negative-space tricks, isometric shapes, and lowercase geometric sans with a dot. This must not look like a template.',

  // Everything at once — the version the product would actually ship if the
  // combination beats each part alone.
  full: [
    'VISUAL LANGUAGE: in the tradition of Chermayeff & Geismar, Paul Rand, Saul Bass, Otl Aicher and Massimo Vignelli. Reduced, geometric, confident, timeless. The kind of mark a serious institution commissions once and keeps for forty years.',
    'AVOID ENTIRELY the aesthetic of Dribbble, Behance trending, Fiverr, stock vector marketplaces and logo template sites: gradient blobs, line-art animals, decorative negative-space tricks, isometric shapes, and lowercase geometric sans with a dot. This must not look like a template.',
  ].join('\n'),
}

// =============================================================================
// THE BRIEF
// =============================================================================

export type LogoBrief = {
  /** The company name, spelled exactly as it must appear. */
  name: string
  /** The initials, for a monogram. e.g. "AHG" for Affinity Health Group. */
  initials?: string
  /** What the business actually does, in a sentence. */
  what: string
  /** ONE thing the mark should say. Not four. Forcing this choice is the job. */
  positioning?: string
  /** Concrete art direction for the symbol — the concept, not adjectives. */
  concept?: string
  /** e.g. "a single solid deep green ink on white" */
  colour?: string
}

export type PromptOptions = {
  markType?: MarkTypeId
  steer?: SteerId
  /** How the letters are BUILT. The whole design decision for a monogram. */
  monogramStyle?: MonogramStyleId
  /** How many inks, and how they are used. */
  colourWay?: ColourWayId
  /** The actual colours to use, e.g. "deep teal and warm coral". */
  palette?: string
  /** Which house rules to include. Omit for all — name a subset to ablate. */
  rules?: string[]
  /**
   * Draw the SYMBOL ONLY, with no lettering at all.
   *
   * The architecture worth testing: let the model invent the symbol and set the
   * words in a real typeface in code. That removes kerning and spelling — the
   * two things models reliably get wrong — from the model's job entirely.
   */
  symbolOnly?: boolean
}

/** Build the instruction. Every part of it is addressable so it can be tested. */
export function buildLogoPrompt(brief: LogoBrief, opts: PromptOptions = {}): string {
  const mark = MARK_TYPES.find((m) => m.id === opts.markType) ?? MARK_TYPES[4]
  const steer = STYLE_STEERS[opts.steer ?? 'full']
  const rules = opts.rules
    ? HOUSE_RULES.filter((r) => opts.rules!.includes(r.id))
    : HOUSE_RULES

  const parts: string[] = []

  parts.push(
    opts.symbolOnly
      ? 'A professional logo SYMBOL — the mark only, with NO lettering, NO words, NO letters and NO company name anywhere in the image.'
      : 'A professional company logo, the finished trademark itself.',
  )

  parts.push('', `THE BUSINESS: ${brief.what}`)
  // PHRASED SO IT CANNOT BE READ AS COPY. Written as "IT MUST SAY ONE THING:
  // steady care", the model printed "steady care." underneath the monogram as
  // a tagline. It is a feeling to design toward, not words to set.
  if (brief.positioning) {
    parts.push(`THE FEELING TO DESIGN TOWARD — this is a direction for the shapes, NOT text to render, and these words must appear nowhere in the image: ${brief.positioning}`)
  }

  const monogram = opts.monogramStyle
    ? MONOGRAM_STYLES.find((m) => m.id === opts.monogramStyle)
    : undefined

  if (monogram && brief.initials) {
    // A monogram is its own thing: the letters ARE the artwork, so the
    // construction instruction replaces the mark-type direction entirely.
    parts.push('', `A MONOGRAM built from exactly these letters and no others: "${brief.initials.split('').join(' ')}" — the letters ${brief.initials}.`)
    parts.push(monogram.direction)
    parts.push(
      `Draw ONLY those ${brief.initials.length} letters and nothing else. NO company name, NO tagline, NO strapline, NO descriptive words, NO extra characters — not above, not below, not beside the monogram. The letters ${brief.initials} are the entire image.`,
    )
  } else if (!opts.symbolOnly) {
    parts.push('', mark.direction)
    // Quoted exactly, the way the flyer engine does it — this is what keeps a
    // name from drifting into something that merely looks similar.
    parts.push(`THE NAME, spelled EXACTLY as written and with no other words added: "${brief.name}"`)
  } else {
    parts.push('', 'A single symbol, standing alone. It will be paired with typography later, so it must be complete and balanced on its own.')
  }

  if (brief.concept) parts.push('', `THE CONCEPT: ${brief.concept}`)

  // Colour: an explicit strategy when one is named, otherwise the brief's own
  // line, otherwise single ink. Kept flat in every case — a gradient breaks
  // both the one-colour test and the vector conversion.
  const way = opts.colourWay ? COLOUR_WAYS.find((c) => c.id === opts.colourWay) : undefined
  if (way) {
    parts.push('', `COLOUR: ${way.direction}${opts.palette ? ` Use ${opts.palette}.` : ''} Flat solid fills only — absolutely no gradients, no tints, no opacity.`)
  } else {
    parts.push('', `COLOUR: ${brief.colour ?? 'a single solid near-black ink on white'}. No second colour.`)
  }

  if (steer) parts.push('', steer)

  if (rules.length) {
    parts.push('', 'ABSOLUTE RULES — this is a professional identity, not an illustration:')
    parts.push(...rules.map((r) => `- ${r.text}`))
  }

  return parts.join('\n')
}

/** Every rule id, for ablation runs. */
export const ALL_RULE_IDS = HOUSE_RULES.map((r) => r.id)
