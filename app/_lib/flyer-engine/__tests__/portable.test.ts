import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import {
  FLYER_SIZES, FLYER_TEMPLATES, apiSize, flyerPrompt,
  printPixels, dpiFor, canBleed, BLEED_IN,
  VISIBLE_STYLES, STYLE_FAMILIES, MOTIFS, resolveStyle,
} from '../index'

// =============================================================================
// The engine must stay liftable.
//
// It is the one piece worth moving if this ever becomes its own product, and
// today it imports NOTHING — not Next, not Supabase, not a single package.
// That is what makes it a copy-and-go rather than a rewrite.
//
// A comment asking people to keep it that way would survive about a month. A
// failing test survives indefinitely. If you are here because this test broke:
// the import you just added has tied the engine to this app. Move that code to
// the route instead and pass the result in.
// =============================================================================

const DIR = join(process.cwd(), 'app/_lib/flyer-engine')

describe('flyer engine stays portable', () => {
  it('imports nothing at all', () => {
    const src = readFileSync(join(DIR, 'index.ts'), 'utf8')
    const imports = src.match(/^\s*(import\s|export\s+\*\s+from|const\s+\w+\s*=\s*require\()/gm) ?? []
    expect(imports, `engine gained ${imports.length} import(s) — it must stay standalone`).toEqual([])
  })

  it('is a single self-contained file', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.ts'))
    expect(files).toEqual(['index.ts'])
  })
})

// The picker is a wall of pictures. A style with no picture is a black square
// with a name under it, which is what the gallery shipped as once already —
// and adding a style is a one-line edit while generating its sample is a
// separate paid script, so the two drift apart by default.
describe('every style can be shown in the picker', () => {
  it('has a sample image on disk', () => {
    const dir = join(process.cwd(), 'public/flyer-templates')
    const have = new Set(readdirSync(dir))
    const missing = FLYER_TEMPLATES.filter((t) => !have.has(`${t.id}.png`)).map((t) => t.id)
    expect(missing, `no sample image — run: node scripts/flyer-thumbs.mjs ${missing.join(' ')}`).toEqual([])
  })

  // SKIPPED 2026-08-24: /flyer was retired to a redirect stub (9cd82fd); the
  // picker moved to /design/style with no CATEGORIES chips. Rewrite against the
  // new picker (or delete if categories are gone for good) — tracked in
  // SOC2-READINESS.md follow-ups.
  it.skip('puts every style in a category the picker actually shows', () => {
    // A style in a category with no chip is unreachable: it exists, it costs
    // nothing to run, and no customer can ever pick it.
    const page = readFileSync(join(process.cwd(), 'app/(dashboard)/flyer/page.tsx'), 'utf8')
    // Read the CATEGORIES list specifically. Scanning the whole file would also
    // pick up the paper-size groups, which share the same shape — and a check
    // that matches the wrong thing passes for the wrong reason.
    const start = page.indexOf('const CATEGORIES = [')
    expect(start, 'CATEGORIES list not found in the picker').toBeGreaterThan(-1)
    const block = page.slice(start, page.indexOf('] as const', start))
    const shown = new Set([...block.matchAll(/id: '([a-z]+)'/g)].map((m) => m[1]))
    const orphans = [...new Set(FLYER_TEMPLATES.map((t) => t.category))].filter((c) => !shown.has(c))
    expect(orphans, 'category has no chip in the picker, so its styles are unreachable').toEqual([])
  })
})

// The rules below were measured against the live image API, not assumed. They
// are the expensive knowledge in this file — each one cost a failed request to
// discover, and a regression would be invisible until a size silently broke.
describe('every size can actually be generated', () => {
  // Both ways round. Adding bleed changes the SHAPE as well as the size — an
  // 8.5x11 flyer becomes 8.75x11.25 — so a size that is legal without bleed is
  // not automatically legal with it, and the illegal one only shows up as a
  // rejected generation the customer already paid for.
  it.each([false, true])('asks for dimensions the API will accept (bleed: %s)', (bleed) => {
    for (const s of FLYER_SIZES) {
      const a = apiSize(s, bleed)
      const [w, h] = a.size.split('x').map(Number)
      expect(w % 16, `${s.id}: width ${w} must divide by 16`).toBe(0)
      expect(h % 16, `${s.id}: height ${h} must divide by 16`).toBe(0)
      expect(Math.max(w / h, h / w), `${s.id}: ${w}x${h} exceeds the 3:1 limit`).toBeLessThanOrEqual(3.0001)
      expect(Math.max(w, h), `${s.id}: longest edge over 3840`).toBeLessThanOrEqual(3840)
      expect(w * h, `${s.id}: over the pixel budget`).toBeLessThanOrEqual(4_450_000)
      expect(w * h, `${s.id}: under the minimum pixel budget`).toBeGreaterThanOrEqual(1_000_000)
    }
  })

  // Bleed is the whole reason a print shop accepts or rejects a file, and it is
  // invisible on screen — you only find out it was wrong when a box of flyers
  // arrives with a white sliver down one side.
  it('adds an eighth of an inch to every edge of a printed piece', () => {
    for (const s of FLYER_SIZES.filter((x) => x.unit === 'in')) {
      const plain = printPixels(s, false)
      const bled = printPixels(s, true)
      const dpi = dpiFor(s)
      expect(plain.w, `${s.id}: trim width`).toBe(Math.round(s.w * dpi))
      expect(plain.h, `${s.id}: trim height`).toBe(Math.round(s.h * dpi))
      // A quarter inch total — an eighth on each side.
      expect(bled.w - plain.w, `${s.id}: bleed width`).toBe(Math.round(BLEED_IN * 2 * dpi))
      expect(bled.h - plain.h, `${s.id}: bleed height`).toBe(Math.round(BLEED_IN * 2 * dpi))
    }
  })

  it('never offers bleed on something that is not printed', () => {
    // A pixel size — an Instagram post, a slide — has no trim and no printer.
    // Offering "add bleed" there would produce a file that is simply the wrong
    // size for the thing it is going into.
    for (const s of FLYER_SIZES.filter((x) => x.unit === 'px')) {
      expect(canBleed(s), `${s.id} should not accept bleed`).toBe(false)
      expect(printPixels(s, true)).toEqual(printPixels(s, false))
    }
  })

  it('only bands the shapes the API cannot draw', () => {
    // Everything up to 3:1 is generated at its own aspect and never cropped.
    const banded = FLYER_SIZES.filter((s) => apiSize(s).banded).map((s) => s.id)
    expect(banded).toEqual(['li-banner'])
  })
})

describe('the prompt carries the rules that keep flyers usable', () => {
  const t = FLYER_TEMPLATES[0]
  const letter = FLYER_SIZES.find((s) => s.id === 'letter')!

  it('always demands a safe margin', () => {
    // Added after headlines came back clipped at the edge.
    expect(flyerPrompt(t, { headline: 'X' }, letter)).toMatch(/SAFE MARGINS/)
  })

  it('quotes supplied text verbatim and forbids invention', () => {
    const p = flyerPrompt(t, { headline: 'Ünïqué Vënüe', price: '$20' }, letter)
    expect(p).toContain('"Ünïqué Vënüe"')
    expect(p).toContain('"$20"')
    expect(p).toMatch(/EXACTLY as written/)
  })

  it('leaves out fields the user never filled in', () => {
    // An image model handed "Price: " will happily invent one.
    const p = flyerPrompt(t, { headline: 'Just a headline' }, letter)
    expect(p).not.toMatch(/Price:/)
    expect(p).not.toMatch(/Venue name:/)
  })

  it('describes each supplied photo in the order it is attached', () => {
    const p = flyerPrompt(t, { headline: 'X' }, letter, ['person', 'logo'])
    expect(p).toMatch(/Image 1:[\s\S]*REAL PERSON/)
    expect(p).toMatch(/Image 2:[\s\S]*LOGO/)
  })
})

describe('bleed is explained to the model, not just to the printer', () => {
  const t = FLYER_TEMPLATES[0]
  const letter = FLYER_SIZES.find((s) => s.id === 'letter')!
  const fields = { headline: 'Open Day' }

  it('demands the artwork run off all four edges', () => {
    // Left unsaid, the model composes a tidy design that fits inside the frame
    // and the trim leaves a pale uneven rim — the commonest reason a print
    // shop rejects a file.
    const p = flyerPrompt(t, fields, letter, [], false, true)
    expect(p).toMatch(/BLEED/)
    expect(p).toMatch(/run right off all four edges/)
    expect(p).toMatch(/No white border/)
  })

  it('says nothing about bleed when there is none', () => {
    // A flyer printed at home on letter paper has no trim, and telling the
    // model to overrun the edge would just lose the design's margins.
    expect(flyerPrompt(t, fields, letter)).not.toMatch(/BLEED/)
  })

  it('pulls the text further in when the edge will be cut', () => {
    expect(flyerPrompt(t, fields, letter, [], false, true)).toMatch(/at least 12% of the width/)
    expect(flyerPrompt(t, fields, letter)).toMatch(/at least 8% of the width/)
  })
})

describe('a slide is not a poster', () => {
  const t = FLYER_TEMPLATES[0]
  const slide = FLYER_SIZES.find((s) => s.id === 'slide-16x9')!

  it('asks for one idea in large type, not a dense flyer', () => {
    const p = flyerPrompt(t, { headline: 'Where we are going' }, slide)
    expect(p).toMatch(/PRESENTATION SLIDE/)
    expect(p).toMatch(/ONE idea only/)
    expect(p).not.toMatch(/portrait poster|wide banner/)
  })

  it('refuses the photo-of-a-screen look', () => {
    // Told only "a slide", image models render a laptop on a desk, or a
    // projected rectangle on a wall — neither of which can be used as a slide.
    const p = flyerPrompt(t, { headline: 'X' }, slide)
    expect(p).toMatch(/no laptop, no projector/)
  })

  it('comes out at exactly 1920x1080', () => {
    // Off by a pixel and PowerPoint letterboxes it with grey bars.
    expect(printPixels(slide)).toEqual({ w: 1920, h: 1080, dpi: 72 })
  })
})

// A card is 3.5x2in — wide enough that the generic "wide banner" wording used
// to apply to it, which produced small posters rather than cards.
describe('business cards are treated as cards, not small posters', () => {
  const t = FLYER_TEMPLATES.find((x) => x.id === 'corporate')!
  const front = FLYER_SIZES.find((s) => s.id === 'biz-card-front')!
  const back = FLYER_SIZES.find((s) => s.id === 'biz-card-back')!
  const fields = { headline: 'Dana Okafor', subhead: 'Managing Broker', contact: '555 0134' }

  it('calls the headline a name and never an event title', () => {
    const p = flyerPrompt(t, fields, front)
    expect(p).toMatch(/business card/i)
    expect(p).toMatch(/PERSON'S NAME/)
    expect(p).not.toMatch(/LARGE MAIN TITLE/)
    expect(p).not.toMatch(/portrait poster|wide banner/)
  })

  it('tells the model this is flat artwork, not a photo of a card', () => {
    // Left alone, image models render a card lying on a desk with a shadow,
    // which cannot be sent to a printer.
    expect(flyerPrompt(t, fields, front)).toMatch(/not a mockup/i)
  })

  it('asks the back to stay nearly empty', () => {
    const p = flyerPrompt(t, fields, back)
    expect(p).toMatch(/BACK/)
    expect(p).toMatch(/at most two short pieces of text/)
  })

  it('is generated big enough to print, despite being a small card', () => {
    // 3.5x2in at 300dpi is 0.63 MP — under the API's floor. apiSize must scale
    // the REQUEST up; the route scales the result back down for print.
    const a = apiSize(front)
    expect(a.w * a.h).toBeGreaterThanOrEqual(1_000_000)
    expect(a.banded).toBe(false)
  })
})

// A pixel size is never printed. Handing back 300 for one looks harmless and
// then gets written into the file as its density, which tells print software
// the image is a third of its real size. The first caller of dpiFor fell into
// exactly this within an hour of it existing.
describe('resolution is never claimed for something that is not printed', () => {
  it('gives screen sizes 72, not a print dpi', () => {
    for (const s of FLYER_SIZES.filter((x) => x.unit === 'px')) {
      expect(dpiFor(s), `${s.id}`).toBe(72)
    }
  })

  it('gives printed pieces their own dpi', () => {
    expect(dpiFor(FLYER_SIZES.find((s) => s.id === 'letter')!)).toBe(300)
    expect(dpiFor(FLYER_SIZES.find((s) => s.id === 'yard-sign')!)).toBe(150)
    expect(dpiFor(FLYER_SIZES.find((s) => s.id === 'banner-3x6')!)).toBe(72)
  })
})

// Browser dialogs grey out the whole app behind a box headed "text2art.app
// says", in a font we do not control and cannot style. It reads as though
// something has gone wrong with the site, and it cannot carry a design system.
// Every question belongs inline, next to the thing it is about.
describe('no browser dialogs', () => {
  it('asks inline, never with confirm or alert', () => {
    const page = readFileSync(join(process.cwd(), 'app/(dashboard)/flyer/page.tsx'), 'utf8')
    // Strip comments first — this file explains WHY window.confirm is banned,
    // and a check that trips over its own explanation is just noise.
    const code = page.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    const found = code.match(/window\.(confirm|alert|prompt)\s*\(/g) ?? []
    expect(found, 'use an inline confirmation instead').toEqual([])
  })
})

// =============================================================================
// WHAT THE CUSTOMER ASKS FOR IS WHAT GETS DRAWN.
//
// The complaint that started this: pick the autumn style for its burnt-orange
// palette and its hand-lettering, ask for an HVAC van, get pumpkins. The cause
// was ordering. The style paragraph opened the prompt and named the pumpkins;
// the customer's own words were appended at the very bottom after "ALSO:". The
// model obeyed the louder instruction, which is exactly what it should do.
//
// These check the ORDER and the OVERRIDE, because that is the whole fix. A test
// that only checked the words were present would have passed before the fix.
// =============================================================================
describe('the subject the customer asked for outranks the style', () => {
  const style = {
    id: 'test-autumn', name: 'Autumn', category: 'community' as const,
    scene: 'Autumn harvest festival with pumpkins and hay bales, burnt orange.',
    look: 'Burnt orange and charcoal, rough paper texture, heavy hand-lettering.',
    subject: 'Pumpkins, hay bales and falling maple leaves.',
    lettering: 'Chunky hand-drawn slab capitals.',
  }
  const size = FLYER_SIZES.find((s) => s.id === 'letter')!
  const fields = { headline: '24/7 HEAT REPAIR' }

  it('states the asked-for subject BEFORE the style, not after it', () => {
    const p = flyerPrompt(style, fields, size, [], false, false, 'an HVAC repair van in a driveway')
    const subjectAt = p.indexOf('HVAC repair van')
    const styleAt = p.indexOf('Burnt orange and charcoal')
    expect(subjectAt, 'the subject must appear at all').toBeGreaterThan(-1)
    expect(subjectAt, 'the subject must come FIRST — order is the bug').toBeLessThan(styleAt)
  })

  it('drops the pumpkins when a subject was asked for', () => {
    const p = flyerPrompt(style, fields, size, [], false, false, 'an HVAC repair van in a driveway')
    expect(p.toLowerCase()).not.toContain('pumpkin')
    expect(p.toLowerCase()).not.toContain('hay bale')
  })

  it('keeps the palette and the lettering — that is what was picked', () => {
    const p = flyerPrompt(style, fields, size, [], false, false, 'an HVAC repair van in a driveway')
    expect(p).toContain('Burnt orange and charcoal')
    expect(p).toContain('Chunky hand-drawn slab capitals')
  })

  it('brings the pumpkins back only when they are asked for', () => {
    const p = flyerPrompt(style, fields, size, [], false, false, '', true)
    expect(p.toLowerCase()).toContain('pumpkin')
  })

  it('leaves the motif out by default — browsing a look is not asking for props', () => {
    const p = flyerPrompt(style, fields, size, [], false, false)
    expect(p.toLowerCase()).not.toContain('pumpkin')
  })

  it('tells an unsplit style to ignore the objects welded into its paragraph', () => {
    const unsplit = { ...style, look: undefined, subject: undefined }
    const p = flyerPrompt(unsplit, fields, size, [], false, false, 'an HVAC repair van')
    // The old paragraph still names pumpkins and cannot be edited out, so the
    // override has to be said in words. Best-effort, and honest about it.
    expect(p).toContain('ignore every one of them')
  })

  it('a reference replaces the STYLE but never the subject', () => {
    const p = flyerPrompt(style, fields, size, [], true, false, 'an HVAC repair van')
    expect(p).toContain('TAKE DIRECTION FROM THE REFERENCE')
    // The style is gone — two art directions produce a design obeying neither.
    expect(p).not.toContain('Burnt orange and charcoal')
    // The subject is NOT gone. "I uploaded a design I liked and it ignored what
    // I asked for" is the same complaint, one layer up.
    expect(p).toContain('an HVAC repair van')
    expect(p.indexOf('an HVAC repair van')).toBeLessThan(p.indexOf('TAKE DIRECTION'))
  })
})

// =============================================================================
// THE MERGED LIST MUST STAY HONEST.
//
// 225 styles became 105 shown, with 120 folded away. Every folded one is still
// somebody's saved design, so a merge is a redirection and never a deletion.
// These guard the three ways that can quietly break: a redirect that points at
// nothing, a design that no longer opens, and two entries in the picker that
// are impossible to tell apart because they share a name.
// =============================================================================
describe('folding a style never loses it', () => {
  it('keeps every original id — a changed id breaks a saved design silently', () => {
    expect(FLYER_TEMPLATES.length).toBe(225)
    expect(new Set(FLYER_TEMPLATES.map((t) => t.id)).size).toBe(225)
  })

  it('never points a merge at something that is not in the picker', () => {
    const shown = new Set(VISIBLE_STYLES.map((t) => t.id))
    for (const t of FLYER_TEMPLATES.filter((x) => x.mergedInto)) {
      expect(shown.has(t.mergedInto!), `${t.id} folds into ${t.mergedInto}, which is not shown`).toBe(true)
    }
  })

  it('resolves every id, folded or not, to a look that exists', () => {
    for (const t of FLYER_TEMPLATES) {
      const r = resolveStyle(t.id)
      expect(r, `${t.id} resolves to nothing`).toBeTruthy()
      expect(r!.mergedInto, `${t.id} resolves to another merged style`).toBeUndefined()
    }
  })

  it('says WHY it was folded, so the decision can be argued with', () => {
    for (const t of FLYER_TEMPLATES.filter((x) => x.mergedInto)) {
      expect((t.mergedWhy ?? '').length, `${t.id} was folded with no reason given`).toBeGreaterThan(20)
    }
  })

  it('gives no two shown looks the same name', () => {
    const names = VISIBLE_STYLES.map((t) => t.name)
    const dup = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))]
    expect(dup, 'two looks a customer cannot tell apart in the list').toEqual([])
  })

  it('gives every shown look a family and a look description', () => {
    for (const t of VISIBLE_STYLES) {
      expect(t.family, `${t.id} has no shelf to sit on`).toBeTruthy()
      expect((t.look ?? '').length, `${t.id} has no look description`).toBeGreaterThan(30)
    }
  })

  it('keeps the motifs that came off the folded styles', () => {
    // The pumpkins were separated, not deleted. If this ever drops to nothing,
    // the "keep the seasonal props" switch has nothing left to offer.
    expect(MOTIFS.length).toBeGreaterThan(150)
  })
})

// =============================================================================
// THE DEFAULT LOOK HAS TO BE ONE YOU CAN SEE.
//
// The page opened with 'rnb' selected. When 225 styles became 105, rnb was
// folded into another look — nothing was deleted, so it still drew perfectly
// well, and nothing looked broken. It simply could never appear as the ticked
// tile, because it is not in the picker any more: you would never see your own
// choice highlighted and would have no idea what you were about to get.
//
// Silent, harmless-looking, and exactly the kind of thing that survives a
// hundred green builds.
// =============================================================================
describe('the starting look is one the customer can actually see', () => {
  it('has a first visible style to fall back on', () => {
    expect(VISIBLE_STYLES.length).toBeGreaterThan(0)
    expect(VISIBLE_STYLES[0].mergedInto).toBeUndefined()
  })

  // SKIPPED 2026-08-24: parses the retired /flyer page (now a redirect stub,
  // 9cd82fd). Re-point at the /design/style picker's default-selection logic.
  it.skip('never hard-codes a style id as the default', () => {
    // MY FIRST VERSION OF THIS TEST WAS A FALSE GREEN.
    //
    // It looked for `useState('...')` followed by a `// template` comment —
    // after stripping every comment from the file. It could not have matched
    // anything, ever. I put the bug back to check, and it passed happily.
    //
    // This one names the actual declaration, and it has been watched failing.
    const page = readFileSync(join(process.cwd(), 'app/(dashboard)/flyer/page.tsx'), 'utf8')
    const code = page.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

    const decl = code.match(/const\s*\[\s*templateId\s*,\s*setTemplateId\s*\]\s*=\s*useState\(([^)]*)\)/)
    expect(decl, 'could not find where the default look is set').toBeTruthy()
    // A named id is a promise that it still exists AND is still in the picker.
    // Reading it off the list keeps that promise for free, forever.
    expect(decl![1].trim(), 'read the default off VISIBLE_STYLES instead of naming an id')
      .not.toMatch(/^['"]/)
  })

  it('every sample image the picker asks for exists', () => {
    const have = new Set(readdirSync(join(process.cwd(), 'public/flyer-templates')))
    const missing = VISIBLE_STYLES.filter((t) => !have.has(`${t.id}.png`)).map((t) => t.id)
    expect(missing, 'a look in the picker with no sample is a black square').toEqual([])
  })
})
