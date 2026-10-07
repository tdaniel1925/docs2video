import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, relative } from 'path'
import { PLANS } from '../app/_lib/pricing'
import { CREDIT_COSTS, TIER_CREDITS, MULTI_FILE_SURCHARGE } from '../app/_lib/credits'
import { CREDIT_PACKS } from '../app/_lib/credit-packs'

/*
 * Guard: no dashboard screen types a price by hand.
 *
 * Plan prices live in pricing.ts, credit costs in credits.ts, top-up packs in
 * credit-packs.ts. Screens used to repeat them as text — Settings typed
 * $79/$199/$499, the commercial page typed COMMERCIAL_COST = 600, the help
 * articles typed every number — so a price change in one place left the old
 * price showing everywhere else. This test fails if a screen types a dollar
 * price or a credit amount that exists in those tables. Read the value from
 * the table instead (e.g. {CREDIT_COSTS.commercial}).
 *
 * Comments are ignored, so an explanation that mentions an old price is fine.
 */

const ROOT = join(__dirname, '..')

// Every dashboard screen, plus the two pieces of the dashboard frame that
// talk about money (the header and the top-up window).
const DIRS = ['app/(dashboard)']
const FILES = ['app/_components/Header.tsx', 'app/_components/BuyCreditsModal.tsx']

/*
 * Screens that still type prices, owned by work outside this change. The test
 * insists each one STILL has a typed price: when someone fixes the file, the
 * test fails until it is taken off this list — so the list can only shrink.
 */
const KNOWN_LEFTOVERS: Record<string, string> = {
}

// ── What counts as a typed price ────────────────────────────────────────────

const dollars = (cents: number) => String(Math.round(cents / 100))
const PLAN_DOLLARS = PLANS.filter(p => p.monthlyPrice > 0).map(p => dollars(p.monthlyPrice))
const CREDIT_AMOUNTS = [...new Set([
  ...Object.values(CREDIT_COSTS),
  ...Object.values(TIER_CREDITS),
  MULTI_FILE_SURCHARGE,
  ...CREDIT_PACKS.map(p => p.credits),
])]
/** 2500 → "2,?500", so "2500" and "2,500" both match. */
const numberPattern = (n: number) => n.toLocaleString('en-US').replace(/,/g, ',?')

const RULES: { why: string; re: RegExp }[] = [
  // "$79", "$199/mo", "($499/month)"
  ...PLAN_DOLLARS.map(d => ({ why: `plan price $${d}`, re: new RegExp(`\\$\\s?${d}(?![\\d,.])`) })),
  // "600 credits", "2,000 free credits", "25,000 Credits"
  ...CREDIT_AMOUNTS.map(n => ({
    why: `credit amount ${n.toLocaleString('en-US')}`,
    re: new RegExp(`(?<![\\d,.$])${numberPattern(n)}\\s*(free\\s+|monthly\\s+|top-up\\s+|bonus\\s+)?credits?\\b`, 'i'),
  })),
  // a price-list row typed by hand: ['Commercial', '600'], ['Power Pack', '7,500', …]
  ...CREDIT_AMOUNTS.map(n => ({
    why: `price-list row ${n.toLocaleString('en-US')}`,
    re: new RegExp(`\\[\\s*(['"\`])[^'"\`]+\\1\\s*,\\s*(['"\`])\\+?${numberPattern(n)}\\2`),
  })),
  // const COMMERCIAL_COST = 600 / needed={600}
  ...CREDIT_AMOUNTS.map(n => ({
    why: `typed cost constant ${n}`,
    re: new RegExp(`(\\w*COST\\w*\\s*[:=]\\s*${n}\\b)|(needed=\\{\\s*${n}\\s*\\})`, 'i'),
  })),
  // "top up from $10", "packs start at $10"
  ...CREDIT_PACKS.map(p => ({
    why: `pack price ${'$' + dollars(p.priceCents)} after "from"/"at"`,
    re: new RegExp(`\\b(from|at)\\s+\\$${dollars(p.priceCents)}(?![\\d,.])`, 'i'),
  })),
  // a pack written out by hand: its credits and its price on one line
  ...CREDIT_PACKS.map(p => ({
    why: `pack ${p.name} typed (credits + price on one line)`,
    re: new RegExp(`(?<![\\d,.$])${numberPattern(p.credits)}(?![\\d]).*\\$${dollars(p.priceCents)}(?![\\d,.])`),
  })),
]

/** Strip block, JSX and line comments (but not the "//" inside a URL). */
export function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
}

/** Every typed price in a piece of source, as "why: matched text". */
export function findTypedPrices(src: string): string[] {
  const hits: string[] = []
  const code = stripComments(src)
  for (const line of code.split('\n')) {
    for (const r of RULES) {
      const m = line.match(r.re)
      if (m) hits.push(`${r.why}: ${m[0].trim().slice(0, 60)}`)
    }
  }
  return hits
}

function walk(dir: string, out: string[]) {
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p)
  }
}

function scannedFiles(): string[] {
  const out: string[] = []
  for (const d of DIRS) walk(join(ROOT, d), out)
  for (const f of FILES) if (existsSync(join(ROOT, f))) out.push(join(ROOT, f))
  return out
}

const rel = (p: string) => relative(ROOT, p).replace(/\\/g, '/')

describe('no typed prices on dashboard screens', () => {
  it('the checker catches planted prices (so a pass means something)', () => {
    // Each of these is a real line this change removed.
    expect(findTypedPrices("const COMMERCIAL_COST = 600")).not.toEqual([])
    expect(findTypedPrices("                  price: '$79',")).not.toEqual([])
    expect(findTypedPrices("Pro — $199/month — 75,000 Credits")).not.toEqual([])
    expect(findTypedPrices("{ name: 'Starter', credits: '2,500', price: '$10' },")).not.toEqual([])
    expect(findTypedPrices("['No monthly fee', 'Top up any time from $10']")).not.toEqual([])
    expect(findTypedPrices('🎬 Export video (400 credits)')).not.toEqual([])
    expect(findTypedPrices('New accounts get **2,000 free credits** once.')).not.toEqual([])
    expect(findTypedPrices('<BuyCreditsModal needed={600} />')).not.toEqual([])
    expect(findTypedPrices("                ['Commercial', '600'],")).not.toEqual([])
    expect(findTypedPrices("                ['Medium video (2–3 min)', '1,000'],")).not.toEqual([])
  })

  it('leaves alone what is not a typed price', () => {
    expect(findTypedPrices('{CREDIT_COSTS.commercial.toLocaleString()} credits')).toEqual([])
    expect(findTypedPrices('price={`$${plan.monthlyPrice / 100}`}')).toEqual([])
    expect(findTypedPrices('// Starter ($29) is retired — kept for old subscribers.')).toEqual([])
    expect(findTypedPrices('{/* the old $79 card */}')).toEqual([])
    expect(findTypedPrices('Posting to 3 platforms = 75 credits.')).toEqual([])
    expect(findTypedPrices("<a href=\"https://example.com/x\">link</a> // 600 credits")).toEqual([])
    expect(findTypedPrices('width: 200, height: 600')).toEqual([])
    expect(findTypedPrices("  ['AI Social post (per platform)', '25'],")).toEqual([])
    expect(findTypedPrices("['Commercial', n(CREDIT_COSTS.commercial)],")).toEqual([])
  })

  it('scans the real dashboard', () => {
    const files = scannedFiles().map(rel)
    expect(files.length).toBeGreaterThan(30)
    expect(files).toContain('app/(dashboard)/settings/page.tsx')
    expect(files).toContain('app/(dashboard)/create/commercial/page.tsx')
    expect(files).toContain('app/_components/BuyCreditsModal.tsx')
  })

  it('no dashboard screen types a plan price, pack price or credit cost', () => {
    const problems: string[] = []
    for (const f of scannedFiles()) {
      const name = rel(f)
      if (name in KNOWN_LEFTOVERS) continue
      const hits = findTypedPrices(readFileSync(f, 'utf8'))
      if (hits.length) problems.push(`${name}: ${hits.join(' | ')}`)
    }
    expect(problems).toEqual([])
  })

  it('the leftovers list only shrinks (a fixed or deleted file must come off it)', () => {
    const stale: string[] = []
    for (const name of Object.keys(KNOWN_LEFTOVERS)) {
      const p = join(ROOT, name)
      if (!existsSync(p) || findTypedPrices(readFileSync(p, 'utf8')).length === 0) stale.push(name)
    }
    expect(stale).toEqual([])
  })
})

describe('credit packs match what the buy route sells', () => {
  it('same keys and same credits as app/api/credits/buy CREDIT_PACKS', () => {
    const route = readFileSync(join(ROOT, 'app/api/credits/buy/route.ts'), 'utf8')
    const block = route.match(/CREDIT_PACKS[^=]*=\s*\{([\s\S]*?)\n\}/)
    expect(block, 'CREDIT_PACKS block in the buy route').not.toBeNull()
    const sold = [...block![1].matchAll(/(\w+):\s*\{\s*credits:\s*(\d+)/g)].map(m => `${m[1]}=${m[2]}`)
    expect(sold.sort()).toEqual(CREDIT_PACKS.map(p => `${p.key}=${p.credits}`).sort())
  })

  it('no pack is called "Starter" (that is the retired $29 plan)', () => {
    expect(CREDIT_PACKS.map(p => p.name.toLowerCase())).not.toContain('starter')
  })
})
