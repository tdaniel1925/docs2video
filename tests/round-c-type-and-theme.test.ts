import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import path from 'path'
import { THEME_BOOT_SCRIPT, THEME_KEY, parsePref, resolveTheme, type ThemePref } from '../app/_lib/theme-pref'

/**
 * UI round C (2026-10): one type + spacing scale, and a light/dark switch.
 *
 *  - The converted customer screens use ONLY the type scale (var(--fs-*)).
 *    A hand-typed px size there fails this test. Big hero numbers are the
 *    allow-listed exceptions below. Emails are not screens (share-email.ts).
 *  - Dark mode re-points the colour names once; every words-on-ground pair
 *    stays ≥ 4.5:1 in dark too.
 *  - The before-paint script decides exactly what resolveTheme() decides.
 *  - Dark reaches only Docs2Video's signed-in screens; the share page and
 *    the unchecked screens stay light.
 */
const ROOT = path.resolve(__dirname, '..')
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8')
const rel = (f: string) => path.relative(ROOT, f).replace(/\\/g, '/')

function walk(p: string, out: string[] = []): string[] {
  const abs = path.join(ROOT, p)
  if (statSync(abs).isDirectory()) { for (const e of readdirSync(abs)) walk(path.join(p, e), out) }
  else if (/\.(tsx?|css)$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(abs)
  return out
}

/** The converted screens (and the shared parts they wear). */
const CONVERTED = [
  'app/(dashboard)/dashboard', 'app/(dashboard)/videos', 'app/(dashboard)/create',
  'app/(dashboard)/clients', 'app/(dashboard)/brands', 'app/(dashboard)/settings',
  'app/(dashboard)/help', 'app/(dashboard)/affiliate', 'app/(dashboard)/analytics',
  'app/(dashboard)/activity', 'app/(public)/watch', 'app/kit.css', 'app/_components/kit',
  'app/_components/Header.tsx', 'app/_components/NotificationBell.tsx', 'app/_components/HelpChatWidget.tsx',
  'app/_components/BuyCreditsModal.tsx', 'app/_components/ScriptEditor.tsx', 'app/_components/SceneEditChat.tsx',
  'app/_components/SmtpSetupModal.tsx', 'app/_components/SharePagePreview.tsx', 'app/_components/SendEmailModal.tsx',
  'app/_components/UpgradeModal.tsx', 'app/_components/InlineConfirm.tsx', 'app/_components/Toast.tsx',
  'app/_components/StepRow.tsx', 'app/_components/VideoPlayer.tsx', 'app/_components/SocialShareButton.tsx',
]
/** Not screens: email HTML must keep real px sizes for mail apps. */
const NOT_SCREENS = [/share-email\.ts$/]
/** Legit sizes outside the scale: one big number each. "file: what". */
const ALLOWED = new Set([
  'app/(dashboard)/videos/[id]/making/MakingProgress.tsx: fontSize: 56',
  'app/(dashboard)/create/_components/make/make.module.css: font-size: clamp(32px, 5vw, 44px)',
])

/** Every font size in a source that is NOT a scale token. */
export function handSetSizes(src: string): string[] {
  const out: string[] = []
  const rx = [
    /fontSize\s*:\s*[^,}\n]+/g,
    /font-size\s*:\s*[^;}\n"'`]+/g,
    /(?<![\w-])font\s*:\s*(?:\d{3}\s+|italic\s+|bold\s+)*[\d.]+(?:px|rem)/g,
    /(?<![\w-])(?:[a-z]+:)*text-\[[\d.]+(?:px|rem)\]/g,
    /(?<![\w-])(?:[a-z]+:)*text-(?:xs|sm|base|lg|xl|[2-7]xl)(?![\w-])/g,
  ]
  for (const r of rx) for (const m of src.matchAll(r)) {
    const hit = m[0].trim()
    if (/var\(--(fs|font)-/.test(hit)) continue
    if (/fontSize\s*:\s*(number|string)\b/.test(hit)) continue // a type, not a size
    out.push(hit)
  }
  return out
}

/** A css block's custom properties. */
function tokens(body: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}
const css = read('app/globals.css')
function blockAfter(marker: string): string {
  const at = css.indexOf(marker)
  if (at < 0) throw new Error(`no ${marker} in globals.css`)
  return css.slice(css.indexOf('{', at), css.indexOf('}', at))
}
const DARK_SELECTOR = "html[data-brand='docs2video'][data-theme='dark']:has(.app-themed):not(:has([data-light-only]))"

function lum(h: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function lowPairs(t: Record<string, string>): string[] {
  const hex = (n: string) => { const v = t[n]; if (!/^#[0-9a-fA-F]{6}$/.test(v ?? '')) throw new Error(`${n} should be a 6-digit hex, is ${v}`); return v }
  const ratio = (a: string, b: string) => { const [x, y] = [lum(hex(a)), lum(hex(b))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  const GROUNDS = ['--bg', '--bg-soft', '--bg-card', '--surface', '--surface-raised']
  const pairs: [string, string][] = []
  for (const fg of ['--ink', '--ink-body', '--ink-soft', '--ink-light', '--accent-ink', '--link', '--success', '--error-text', '--warning-text'])
    for (const bg of GROUNDS) pairs.push([fg, bg])
  for (const fg of ['--gold', '--error']) for (const bg of ['--bg', '--bg-soft', '--bg-card']) pairs.push([fg, bg])
  pairs.push(
    ['--accent-ink', '--accent-soft'], ['--ink', '--accent-soft'], ['--ink', '--accent'], ['--accent-ink', '--accent'],
    ['--gold', '--gold-soft'], ['--success', '--success-bg'], ['--error', '--error-bg'], ['--error-text', '--error-bg'],
    ['--warning-text', '--warning-bg'],
    ['--on-ink', '--ink'], ['--accent', '--ink'], ['--on-ink', '--accent-ink'], ['--on-ink', '--link'], ['--on-ink', '--error'],
  )
  return pairs.map(([f, b]) => [f, b, ratio(f, b)] as const).filter(([, , r]) => r < 4.5).map(([f, b, r]) => `${f} on ${b}: ${r.toFixed(2)}`)
}

describe('round C — one type scale', () => {
  it('the scale is defined once, with a line height per size, plus kit classes and Tailwind names', () => {
    const root = tokens(blockAfter(':root'))
    const want = { caption: '12px', small: '13px', ui: '14px', body: '15px', lead: '18px', h3: '22px', h2: '28px', h1: '34px' }
    for (const [name, px] of Object.entries(want)) {
      expect(root[`--fs-${name}`], name).toBe(px)
      expect(root[`--lh-${name}`], name).toMatch(/^1(\.\d+)?$/)
      expect(read('app/kit.css')).toContain(`.kit-text-${name}`)
      expect(css).toContain(`--text-${name}: var(--fs-${name});`)
    }
    for (const n of [1, 2, 3, 4, 5, 6, 7]) expect(root[`--space-${n}`]).toBe(`${[4, 8, 12, 16, 24, 32, 48][n - 1]}px`)
  })

  it('the checker catches hand-typed sizes (and lets scale tokens through)', () => {
    expect(handSetSizes(`<div style={{ fontSize: 13 }} />`)).toEqual(['fontSize: 13'])
    expect(handSetSizes(`.a { font-size: 14px; }`)).toEqual(['font-size: 14px'])
    expect(handSetSizes(`<p className="text-sm md:text-[15px]" />`)).toHaveLength(2)
    expect(handSetSizes(`.b { font: 600 13px/1.4 inherit; }`)).toHaveLength(1)
    expect(handSetSizes(`<div style={{ fontSize: 'var(--fs-small)' }} /> .c { font-size: var(--fs-body); }`)).toEqual([])
  })

  it('no hand-typed font sizes on the converted screens (big hero numbers allow-listed)', () => {
    const hits: string[] = []
    for (const p of CONVERTED) for (const f of walk(p)) {
      const r = rel(f)
      if (NOT_SCREENS.some((x) => x.test(r))) continue
      for (const h of handSetSizes(readFileSync(f, 'utf8'))) if (!ALLOWED.has(`${r}: ${h}`)) hits.push(`${r}: ${h}`)
    }
    expect(hits, 'use var(--fs-caption|small|ui|body|lead|h3|h2|h1) — see globals.css TYPE SCALE').toEqual([])
  })
})

describe('round C — light / dark', () => {
  it('dark mode has a value for every colour name light mode has, and every pair still reads (4.5:1)', () => {
    const light = tokens(blockAfter(':root'))
    const dark = tokens(blockAfter(DARK_SELECTOR))
    const colourNames = Object.keys(light).filter((k) => /^#[0-9a-fA-F]{6}$/.test(light[k]))
    expect(colourNames.length).toBeGreaterThan(25)
    expect(colourNames.filter((k) => k !== '--ink-body' && k !== '--orange-cta' && !dark[k])).toEqual([])
    expect(lowPairs({ ...light, ...dark })).toEqual([])
  })

  it('the contrast check would catch an unreadable dark value', () => {
    const light = tokens(blockAfter(':root'))
    const dark = tokens(blockAfter(DARK_SELECTOR))
    expect(lowPairs({ ...light, ...dark, '--ink-light': '#3A4658' }).length).toBeGreaterThan(0)
  })

  it('dark reaches Docs2Video signed-in screens only; unchecked screens and the share page stay light', () => {
    expect(css).toContain(`${DARK_SELECTOR} {`)
    const layout = read('app/(dashboard)/layout.tsx')
    expect(layout).toMatch(/brand\.id === 'docs2video' \? 'app-themed'/)
    expect(layout).toContain('<ThemeSync />')
    // The share page is not inside the dashboard layout, and wears no themed wrapper.
    expect(read('app/(public)/watch/[id]/page.tsx')).not.toContain('app-themed')
    // Still light: Text2Art's screens and the retired makers. Admin, pricing,
    // AI Social and the photo fixer were checked in dark on 2026-10-09
    // (tests/videos-only-dark.test.ts keeps their markers off).
    for (const p of ['design/layout.tsx', 'library/layout.tsx', 'flyers/layout.tsx', 'deck-builder/layout.tsx'])
      expect(read(`app/(dashboard)/${p}`), p).toContain('<LightOnly />')
  })

  it('the before-paint script decides exactly what resolveTheme decides', () => {
    const run = (saved: string | null | 'throw', systemDark: boolean | 'throw') => {
      const attrs: Record<string, string> = {}
      const document = { documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v } } }
      const localStorage = { getItem: (k: string) => { if (saved === 'throw') throw new Error('blocked'); expect(k).toBe(THEME_KEY); return saved } }
      const window = { matchMedia: () => { if (systemDark === 'throw') throw new Error('old'); return { matches: systemDark } } }
      new Function('document', 'localStorage', 'window', THEME_BOOT_SCRIPT)(document, localStorage, window)
      return attrs['data-theme']
    }
    for (const saved of [null, 'light', 'dark', 'system', 'nonsense']) for (const sys of [true, false]) {
      expect(run(saved, sys), `${saved}/${sys}`).toBe(resolveTheme(parsePref(saved), sys))
    }
    expect(run('throw', false)).toBe('dark') // blocked storage = the default, Dark
    expect(run('dark', 'throw')).toBe('dark')
    expect(run(null, 'throw')).toBe('dark') // nothing picked = Dark (2026-10-09)
    expect(run('light', 'throw')).toBe('light')
    expect(read('app/layout.tsx')).toMatch(/__html: THEME_BOOT_SCRIPT/)
  })

  it('choices: System / Light / Dark in Profile, a one-line switch in the account menu', () => {
    const prefs: ThemePref[] = ['system', 'light', 'dark']
    expect(prefs.map((p) => resolveTheme(p, true))).toEqual(['dark', 'light', 'dark'])
    expect(read('app/(dashboard)/settings/page.tsx')).toContain('<ThemeChoice />')
    expect(read('app/_components/Header.tsx')).toContain('<ThemeToggle')
    const theme = read('app/_components/theme.tsx')
    // Every storage touch is guarded.
    const lines = theme.split('\n')
    const unguarded = lines.filter((l, i) => /localStorage\.\w+\(/.test(l) && !/try/.test(l) && ![lines[i - 1], lines[i - 2]].some((p) => /try \{\s*$/.test(p ?? '')))
    expect(lines.filter((l) => /localStorage\.\w+\(/.test(l)).length).toBeGreaterThan(1)
    expect(unguarded).toEqual([])
  })
})
