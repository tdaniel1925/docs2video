import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

/*
 * THE APP IN DOCS2VIDEO'S NAVY AND LOGO BLUE (redesign 2026-10-18, the
 * approved mockups). Dark is the default; Light is the same blue on pale
 * grounds. Every words-on-ground pair reads (4.5:1), the main button's words
 * included, in both.
 */
const ROOT = join(__dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const css = read('app/globals.css')

function tokens(body: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}
const blockAfter = (marker: string) => { const at = css.indexOf(marker); if (at < 0) throw new Error(`no ${marker}`); return css.slice(css.indexOf('{', at), css.indexOf('}', at)) }
const ROOT_T = tokens(blockAfter(':root'))
const DARK = tokens(blockAfter("html[data-brand='docs2video'][data-theme='dark']:has(.app-themed):not(:has([data-light-only]))"))
const LIGHT = tokens(blockAfter("html[data-brand='docs2video']:not([data-theme='dark']):has(.app-themed):not(:has([data-light-only]))"))

function lum(h: string) {
  const [r, g, b] = [1, 3, 5].map((i) => { const c = parseInt(h.slice(i, i + 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export function lowPairs(t: Record<string, string>): string[] {
  const hex = (n: string) => { const v = t[n]; if (!/^#[0-9a-fA-F]{6}$/.test(v ?? '')) throw new Error(`${n} should be a 6-digit hex, is ${v}`); return v }
  const ratio = (a: string, b: string) => { const [x, y] = [lum(hex(a)), lum(hex(b))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  const GROUNDS = ['--bg', '--bg-soft', '--bg-card', '--surface', '--surface-raised']
  const pairs: [string, string][] = []
  for (const fg of ['--ink', '--ink-body', '--ink-soft', '--ink-light', '--accent-ink', '--link']) for (const bg of GROUNDS) pairs.push([fg, bg])
  pairs.push(['--on-cta', '--cta'], ['--on-cta', '--cta-hover'], ['--ink', '--accent'], ['--ink', '--accent-soft'], ['--accent-ink', '--accent-soft'], ['--on-ink', '--ink'])
  return pairs.map(([f, b]) => [f, b, ratio(f, b)] as const).filter(([, , r]) => r < 4.5).map(([f, b, r]) => `${f} on ${b}: ${r.toFixed(2)}`)
}

describe('the app skin', () => {
  it('dark (the default) is the mockups’ navy and logo blue, and every pair reads', () => {
    expect(DARK['--bg']).toBe('#06142E')
    expect(DARK['--cta']).toBe('#22B5FF')
    expect(lowPairs({ ...ROOT_T, ...DARK })).toEqual([])
  })

  it('light is the same blue on pale grounds, and every pair reads', () => {
    expect(lowPairs({ ...ROOT_T, ...LIGHT })).toEqual([])
  })

  it('the checker catches an unreadable value', () => {
    expect(lowPairs({ ...ROOT_T, ...DARK, '--ink-light': '#2A4F86' }).length).toBeGreaterThan(0)
  })

  it('the public site keeps its own colours: the light app block only applies inside the signed-in app', () => {
    expect(css).toContain("html[data-brand='docs2video']:not([data-theme='dark']):has(.app-themed):not(:has([data-light-only])) {")
    expect(read('app/(public)/watch/[id]/page.tsx')).not.toContain('app-themed')
  })
})
