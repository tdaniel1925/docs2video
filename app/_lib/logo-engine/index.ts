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
  if (brief.positioning) parts.push(`IT MUST SAY ONE THING: ${brief.positioning}.`)

  if (!opts.symbolOnly) {
    parts.push('', mark.direction)
    // Quoted exactly, the way the flyer engine does it — this is what keeps a
    // name from drifting into something that merely looks similar.
    parts.push(`THE NAME, spelled EXACTLY as written and with no other words added: "${brief.name}"`)
  } else {
    parts.push('', 'A single symbol, standing alone. It will be paired with typography later, so it must be complete and balanced on its own.')
  }

  if (brief.concept) parts.push('', `THE CONCEPT: ${brief.concept}`)
  parts.push('', `COLOUR: ${brief.colour ?? 'a single solid near-black ink on white'}. No second colour.`)

  if (steer) parts.push('', steer)

  if (rules.length) {
    parts.push('', 'ABSOLUTE RULES — this is a professional identity, not an illustration:')
    parts.push(...rules.map((r) => `- ${r.text}`))
  }

  return parts.join('\n')
}

/** Every rule id, for ablation runs. */
export const ALL_RULE_IDS = HOUSE_RULES.map((r) => r.id)
