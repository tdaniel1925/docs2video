import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import {
  calculateVideoCost,
  CREDIT_COSTS,
  GRANDFATHERED_USER_IDS,
  MULTI_FILE_SURCHARGE,
} from '../app/_lib/credits'
import {
  outputsOffered,
  presentationCreditCost,
  quoteOutput,
  videoCreditCost,
  videoPriceInputs,
} from '../app/_lib/price-quote'
import { VOICE_OPTIONS } from '../app/_lib/types'

// Step 3 ("Make it yours") shows a price and one button that spends it. The
// price shown MUST be the price charged: both come from app/_lib/price-quote,
// reading the same saved draft. These tests pin that down — the helper's
// numbers, and (source-level) that no page works a price out on its own.

const root = path.resolve(__dirname, '..')
const read = (p: string) => readFileSync(path.join(root, p), 'utf8')
const AZIZ = [...GRANDFATHERED_USER_IDS][0]
const NOT_FREE = { video: false, presentation: false }

describe('price-quote helper = the charge', () => {
  it('prices a video from the SAVED draft length, not the row default', () => {
    const row = { output_type: 'video', detail_level: 'standard', draft_data: { detailLevel: 'detailed' } }
    const inputs = videoPriceInputs(row)
    expect(inputs.detailLevel).toBe('detailed')
    expect(videoCreditCost(inputs, 'u1')).toBe(calculateVideoCost({ outputType: 'video', detailLevel: 'detailed' }))
  })

  it('ignores a length from the request unless it is a trusted internal call', () => {
    const row = { output_type: 'video', draft_data: {} }
    expect(videoPriceInputs(row).detailLevel).toBe('standard')
    expect(videoPriceInputs(row, { detailLevel: 'quick' }).detailLevel).toBe('quick')
  })

  it('quote total equals the charge, and the lines add up to it', () => {
    const row = { output_type: 'video', draft_data: { detailLevel: 'standard', extractedDocs: [{}, {}, {}] } }
    const q = quoteOutput(row, 'video', 'u1', NOT_FREE)
    const charge = videoCreditCost(videoPriceInputs(row), 'u1')
    expect(q.total).toBe(charge)
    expect(q.lines.reduce((a, l) => a + l.credits, 0)).toBe(q.total)
    expect(q.lines.some((l) => l.credits === 2 * MULTI_FILE_SURCHARGE)).toBe(true)
  })

  it('quoting another output prices it as if saved as that output', () => {
    const row = { output_type: 'video', draft_data: { outputType: 'video' } }
    expect(quoteOutput(row, 'pptx', 'u1', NOT_FREE).total).toBe(calculateVideoCost({ outputType: 'pptx' }))
    expect(quoteOutput(row, 'interactive', 'u1', NOT_FREE).total).toBe(CREDIT_COSTS.interactive)
    expect(quoteOutput(row, 'deck', 'u1', NOT_FREE).total).toBe(CREDIT_COSTS.deck)
    expect(presentationCreditCost('deck')).toBe(CREDIT_COSTS.deck)
  })

  it('grandfathered customers are quoted their old rate, admins nothing', () => {
    const row = { output_type: 'video', draft_data: {} }
    expect(quoteOutput(row, 'video', AZIZ, NOT_FREE).total).toBe(calculateVideoCost({ outputType: 'video', userId: AZIZ }))
    expect(quoteOutput(row, 'video', 'u1', { video: true, presentation: true }).total).toBe(0)
  })

  it('offers the three products, plus pptx/pdf only for a project that already is one', () => {
    expect(outputsOffered('video')).toEqual(['video', 'interactive', 'deck'])
    expect(outputsOffered('pptx')).toEqual(['video', 'interactive', 'deck', 'pptx'])
  })
})

// ── Source-level: the screen gets its price from the server helper ──────────

const SCREEN_FILES = [
  'app/(dashboard)/create/theme/page.tsx',
  'app/(dashboard)/create/_components/make/PricePanel.tsx',
  'app/(dashboard)/create/_components/make/Pickers.tsx',
  'app/(dashboard)/create/_components/make/usePriceQuote.ts',
  'app/(dashboard)/create/_components/make/looks.ts',
  'app/(dashboard)/create/_components/CreditCost.tsx',
]
/** A price worked out in the browser: the credit tables or calculators, or a
 *  runtime import of the credits module. */
function browserPricing(src: string): string | null {
  // The helper is server code (it reaches the credits module) — browser files may import its TYPES only.
  const runtimeImport = src.match(/import\s+(?!type\b)[^'"]*from ['"][^'"]*_lib\/price-quote['"]/)
  if (runtimeImport) return runtimeImport[0]
  const m = src.match(/\b(calculateVideoCost|CREDIT_COSTS|costForUser|MULTI_FILE_SURCHARGE|getCreditCost|videoCreditCost|presentationCreditCost|quoteOutput)\b|from ['"][^'"]*_lib\/credits['"]/)
  return m ? m[0] : null
}

describe('the Make screen never prices in the browser', () => {
  it('the check itself catches a browser-side price (so a pass means something)', () => {
    expect(browserPricing(`import { calculateVideoCost } from '../../../_lib/credits'`)).not.toBeNull()
    expect(browserPricing(`const c = CREDIT_COSTS.video`)).not.toBeNull()
    expect(browserPricing(`import { normalizeOutput, type MakeOutput } from '../../../_lib/price-quote'`)).not.toBeNull()
    expect(browserPricing(`import type { OutputQuote } from '../../../../_lib/price-quote'`)).toBeNull()
  })

  for (const f of SCREEN_FILES) {
    it(`${f} has no price of its own`, () => {
      expect(browserPricing(read(f))).toBeNull()
    })
  }

  it('the screen reads the price from /api/price-quote', () => {
    expect(read('app/(dashboard)/create/_components/make/usePriceQuote.ts')).toContain('/api/price-quote')
    const page = read('app/(dashboard)/create/theme/page.tsx')
    expect(page).toMatch(/usePriceQuote\(videoId\)/)
    // The shown total comes from the quote; before starting, the price is re-read.
    expect(page).toMatch(/quote\?\.options\?\.\[output\]/)
    expect(page).toMatch(/await refresh\(\)/)
  })

  it('/api/price-quote and both make routes use the same helper', () => {
    const quoteRoute = read('app/api/price-quote/route.ts')
    expect(quoteRoute).toMatch(/quoteOutput\(/)
    expect(quoteRoute).toMatch(/from '..\/..\/_lib\/price-quote'/)
    const gv = read('app/api/generate-video/route.ts')
    expect(gv).toMatch(/videoCost = videoCreditCost\(priceInputs, user\.id\)/)
    expect(gv).toMatch(/const priceInputs = videoPriceInputs\(/)
    expect(gv).not.toMatch(/calculateVideoCost\(/)
    const gp = read('app/api/generate-presentation/route.ts')
    expect(gp).toMatch(/const cost = presentationCreditCost\(outputType\)/)
  })
})

// ── Every choice reaches the API that makes it ─────────────────────────────

describe('choices made on step 3 are sent and read', () => {
  const page = read('app/(dashboard)/create/theme/page.tsx')
  const gv = read('app/api/generate-video/route.ts')
  const gp = read('app/api/generate-presentation/route.ts')

  it('the output is saved to the draft before starting (the server prices from the draft)', () => {
    expect(page).toMatch(/outputType: output,/)
    expect(page.indexOf("method: 'PATCH'")).toBeLessThan(page.indexOf("'/api/generate-video'"))
    expect(page.indexOf("method: 'PATCH'")).toBeLessThan(page.indexOf("'/api/generate-presentation'"))
  })

  it('video: look, voice, music and photo backgrounds are in the body the route reads', () => {
    for (const k of ['videoStyle: videoLook', 'voiceId,', 'aiMusic,', 'musicPrompt:', 'slidePhotos,', 'brandId:']) expect(page).toContain(k)
    expect(gv).toMatch(/\(body as any\)\.videoStyle/)
    expect(gv).toMatch(/\(body as any\)\.slidePhotos/)
    expect(gv).toMatch(/const \{ videoId, policyData, brandId, voiceId,[^}]*aiMusic, musicPrompt/)
  })

  it('presentation: look and type in the body; voice and brand from the saved draft', () => {
    expect(page).toMatch(/templateId: presLook, outputType: output/)
    expect(gp).toMatch(/body\.templateId/)
    expect(gp).toMatch(/body\.outputType/)
    expect(page).toMatch(/updates: \{[^}]*voiceId,/)
    expect(gp).toMatch(/draft\.voiceId/)
    expect(gp).toMatch(/draft\.brandId/)
  })

  it('default voice is Sarah (nova), first in VOICE_OPTIONS', () => {
    expect(VOICE_OPTIONS[0].id).toBe('nova')
    expect(VOICE_OPTIONS[0].name).toBe('Sarah')
    expect(page).toMatch(/const DEFAULT_VOICE = VOICE_OPTIONS\[0\]\.id/)
  })
})

// ── The protections on the Make button stay ────────────────────────────────

describe('Make button protections', () => {
  const page = read('app/(dashboard)/create/theme/page.tsx')

  it('card_required goes to /setup-payment and back; not-enough-credits never does (the old loop)', () => {
    expect(page).toMatch(/g\.code === 'card_required'\) \{\s*router\.push\(`\/setup-payment\?next=\$\{encodeURIComponent\(`\/create\/theme\?id=\$\{videoId\}`\)\}`\)/)
    const insufficient = page.slice(page.indexOf("g.code === 'insufficient_credits'"))
    const block = insufficient.slice(0, insufficient.indexOf('}'))
    expect(block).not.toContain('setup-payment')
    expect(block).toContain('setBuyCredits')
  })

  it('a double click cannot start two jobs', () => {
    expect(page).toMatch(/if \(!videoId \|\| !draft \|\| !shown \|\| inFlight\.current\) return/)
    expect(page).toMatch(/inFlight\.current = true/)
  })

  it('the one-at-a-time limit and other refusals are shown, not swallowed', () => {
    expect(page).toMatch(/return stop\(\{ message: g\.error \|\| /)
  })
})
