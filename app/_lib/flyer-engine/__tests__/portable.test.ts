import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { FLYER_SIZES, FLYER_TEMPLATES, apiSize, flyerPrompt } from '../index'

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

// The rules below were measured against the live image API, not assumed. They
// are the expensive knowledge in this file — each one cost a failed request to
// discover, and a regression would be invisible until a size silently broke.
describe('every size can actually be generated', () => {
  it('asks for dimensions the API will accept', () => {
    for (const s of FLYER_SIZES) {
      const a = apiSize(s)
      const [w, h] = a.size.split('x').map(Number)
      expect(w % 16, `${s.id}: width ${w} must divide by 16`).toBe(0)
      expect(h % 16, `${s.id}: height ${h} must divide by 16`).toBe(0)
      expect(Math.max(w / h, h / w), `${s.id}: ${w}x${h} exceeds the 3:1 limit`).toBeLessThanOrEqual(3.0001)
      expect(Math.max(w, h), `${s.id}: longest edge over 3840`).toBeLessThanOrEqual(3840)
      expect(w * h, `${s.id}: over the pixel budget`).toBeLessThanOrEqual(4_450_000)
      expect(w * h, `${s.id}: under the minimum pixel budget`).toBeGreaterThanOrEqual(1_000_000)
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
