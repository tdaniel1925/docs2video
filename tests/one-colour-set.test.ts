import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import path from 'path'

/**
 * One colour set (Overhaul phase 2, step 1 — 2026-10).
 *
 * The app, the share page and the marketing site now share ONE set of colour
 * names in app/globals.css (warm cream, mint, navy). These checks keep it that
 * way:
 *  - --mint is gone. It was the logo's cyan doing two jobs (fills AND words);
 *    mint is too pale for words, so uses now say their job: --accent (fills),
 *    --accent-ink (words), --link (links).
 *  - Hand-typed hex colours in the dashboard, shared components and share page
 *    may only go DOWN. A new screen should use the names, not paste a hex.
 *  - The marketing --mk-* names stay aliases of the app's names (no values of
 *    their own to drift).
 *  - Every words-on-ground pair the names produce stays readable (4.5:1).
 *  - Text2Art (the second storefront) keeps its own blue for the new names.
 */
const ROOT = path.resolve(__dirname, '..')
const APP = path.join(ROOT, 'app')

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(tsx?|css)$/.test(e.name)) out.push(p)
  }
  return out
}
const rel = (f: string) => path.relative(ROOT, f).replace(/\\/g, '/')
const css = readFileSync(path.join(APP, 'globals.css'), 'utf8')

/** The body of the first rule whose selector is exactly `selector`. */
function block(selector: string): string {
  const at = css.indexOf(`${selector} {`)
  if (at < 0) throw new Error(`no ${selector} block in globals.css`)
  return css.slice(at, css.indexOf('}', at))
}
function tokens(body: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

describe('one colour set', () => {
  it('nothing in app/ uses var(--mint) (or its -deep / -soft / -light forms)', () => {
    const MINT = /var\(--mint(?:-deep|-soft|-light)?\s*[,)]/
    // Text2Art's own rules are the one exception: there --mint IS its blue.
    const TEXT2ART_RULE = /^\[data-brand='text2art'\]/
    const hits: string[] = []
    for (const f of walk(APP)) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (MINT.test(line) && !TEXT2ART_RULE.test(line)) hits.push(`${rel(f)}:${i + 1}  ${line.trim().slice(0, 100)}`)
      })
    }
    expect(hits, 'use --accent for a fill, --accent-ink for words, --link for a link').toEqual([])
  })

  it('typed hex colours in the dashboard, components and share page do not grow', () => {
    // Measured 2026-10-06: 811 before step 1, 219 after. Of those 219, 121 are
    // in Text2Art's design wizard (design/**), the logo creator and the look
    // swatches; most of the rest are content (brand defaults, social logos, the
    // black behind video, email HTML). Lower this when you remove more; never
    // raise it — use a name from app/globals.css instead.
    const CEILING = 219
    const HEX = /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g
    const dirs = ['app/(dashboard)', 'app/_components', 'app/(public)/watch'].map((d) => path.join(ROOT, d))
    let total = 0
    const perFile: string[] = []
    for (const d of dirs) {
      for (const f of walk(d)) {
        const n = (readFileSync(f, 'utf8').match(HEX) || []).length
        if (n) perFile.push(`${n}\t${rel(f)}`)
        total += n
      }
    }
    expect(total, `typed hex colours rose above ${CEILING}:\n${perFile.join('\n')}`).toBeLessThanOrEqual(CEILING)
  })

  it('the marketing --mk-* colours are aliases of the app names, not values of their own', () => {
    const mk = tokens(block('.mk'))
    const colourNames = Object.keys(mk).filter((k) => !/radius|gutter|max|shadow/.test(k))
    expect(colourNames.length).toBeGreaterThan(10)
    for (const k of colourNames) expect(mk[k], k).toMatch(/^var\(--[a-z-]+\)$/)
  })

  it('every words-on-ground pair is at least 4.5:1', () => {
    const t = tokens(block(':root, .light-island'))
    const hex = (name: string) => {
      const v = t[name]
      if (!/^#[0-9a-fA-F]{6}$/.test(v ?? '')) throw new Error(`${name} should be a 6-digit hex in :root, is ${v}`)
      return v
    }
    const lum = (h: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(h.slice(i, i + 2), 16) / 255
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const ratio = (a: string, b: string) => {
      const [x, y] = [lum(hex(a)), lum(hex(b))].sort((p, q) => q - p)
      return (x + 0.05) / (y + 0.05)
    }
    const LIGHT = ['--bg', '--bg-soft', '--bg-card', '--surface', '--surface-raised']
    const pairs: [string, string][] = []
    for (const fg of ['--ink', '--ink-body', '--ink-soft', '--ink-light', '--accent-ink', '--link', '--success', '--error-text', '--warning-text'])
      for (const bg of LIGHT) pairs.push([fg, bg])
    // Gold (money) and the --error red sit on white, cream or their own tints only.
    for (const fg of ['--gold', '--error']) for (const bg of ['--bg', '--bg-soft', '--bg-card']) pairs.push([fg, bg])
    pairs.push(
      ['--accent-ink', '--accent-soft'], ['--ink', '--accent-soft'], ['--ink', '--accent'], ['--accent-ink', '--accent'],
      ['--gold', '--gold-soft'], ['--success', '--success-bg'], ['--error', '--error-bg'], ['--error-text', '--error-bg'],
      ['--warning-text', '--warning-bg'],
      ['--on-ink', '--ink'], ['--accent', '--ink'], ['--on-ink', '--accent-ink'], ['--on-ink', '--link'], ['--on-ink', '--error'],
    )
    const low = pairs.map(([f, b]) => [f, b, ratio(f, b)] as const).filter(([, , r]) => r < 4.5)
    expect(low.map(([f, b, r]) => `${f} on ${b}: ${r.toFixed(2)}`)).toEqual([])
  })

  it('Text2Art points the new names back at its own blue', () => {
    const t2a = css.slice(css.indexOf('TEXT2ART KEEPS ITS LOOK'))
    const pins = tokens(t2a.slice(t2a.indexOf('{'), t2a.indexOf('}')))
    for (const k of ['--accent', '--accent-ink', '--link', '--surface', '--success']) expect(pins[k], k).toBeTruthy()
    expect(pins['--accent']).toBe('#2E7BF6')
  })
})
