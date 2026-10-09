import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import path from 'path'
import { NAMES } from '../app/_lib/names'
import { DOCS2VIDEO, TEXT2ART } from '../app/_lib/brand'
import { ACCOUNT_MENU, SIGN_OUT, creditLevel, topBarWords } from '../app/_lib/top-bar'
import { CREDIT_COSTS } from '../app/_lib/credits'

/**
 * The top bar (overhaul phase 2, step 4) and the kit it's built from (step 3).
 *  - Docs2Video's bar is four words from names.ts: + New, Library, Clients,
 *    Brands. The logo goes Home; "Dashboard" is gone.
 *  - Text2Art keeps its own bar exactly as it was.
 *  - The credit chip is gold (money) and amber when low — it used to be a
 *    bright green at 2.2:1, and its "low" test could never fire.
 *  - Brands left the avatar menu for the bar; the rest of the menu stays.
 *  - The kit types no colours and keeps corners at 10px or less.
 */
const ROOT = path.resolve(__dirname, '..')
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8')
// Strip comments so an explanation that names an old label doesn't trip a guard.
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

describe('Docs2Video top bar', () => {
  it('is exactly the four words from names.ts, in order', () => {
    expect(topBarWords(DOCS2VIDEO)).toEqual([NAMES.newButton, NAMES.library, NAMES.clients, NAMES.brands])
    expect(DOCS2VIDEO.create?.href).toBe('/create')
    expect(DOCS2VIDEO.nav.map((n) => n.href)).toEqual(['/videos', '/clients', '/brands'])
    expect(DOCS2VIDEO.topBar).toBe('kit')
  })

  it('has no "Dashboard" word — the logo goes Home', () => {
    expect(topBarWords(DOCS2VIDEO)).not.toContain('Dashboard')
    expect(DOCS2VIDEO.home).toBe('/dashboard')
    const header = code('app/_components/Header.tsx')
    expect(header).toMatch(/<Link href=\{brand\.home\} className="kit-topbar-logo"/)
    expect(header).toMatch(/aria-label=\{`\$\{brand\.name\} — Home`\}/)
  })

  it('draws the create button, then the nav, from the brand (no hand-typed words)', () => {
    const header = code('app/_components/Header.tsx')
    expect(header).toMatch(/brand\.create\.label/)
    expect(header).toMatch(/brand\.nav\.map/)
    for (const word of ['Library', 'Clients', 'Brands', 'Dashboard']) {
      expect(header, `"${word}" typed into the bar`).not.toMatch(new RegExp(`>\\s*${word}\\s*<`))
    }
  })

  it('has a How to use button that opens the pop-up', () => {
    const header = code('app/_components/Header.tsx')
    expect(header).toMatch(/NAMES\.howToUse/)
    expect(header).toMatch(/<HowToUseDialog open=\{howToOpen\}/)
  })
})

describe('Text2Art keeps its own bar', () => {
  it('nav, create button and bar are unchanged', () => {
    expect(TEXT2ART.nav).toEqual([
      { href: '/design', label: 'Designs' },
      { href: '/library', label: 'My Library' },
      { href: '/brands', label: NAMES.brands },
    ])
    expect(TEXT2ART.create).toBeNull()
    expect(TEXT2ART.topBar).toBe('classic')
  })

  it('a classic brand gets the frozen ClassicHeader, not the kit bar', () => {
    const header = code('app/_components/Header.tsx')
    expect(header).toMatch(/if \(brand\.topBar === 'classic'\) return <ClassicHeader/)
    const classic = code('app/_components/ClassicHeader.tsx')
    expect(classic).not.toMatch(/kit-credit|HowToUse/)
  })
})

describe('the account menu', () => {
  it('keeps plan, the account shortcuts (Settings, Billing & credits, Analytics, AI Social, Affiliate), Help Center, Admin and Sign out — and not Brands', () => {
    expect(ACCOUNT_MENU.map((i) => i.label)).toEqual(['Settings', 'Billing & credits', 'Analytics', 'AI Social', 'Affiliate', 'Help Center', 'Admin'])
    expect(ACCOUNT_MENU.map((i) => i.href)).not.toContain('/brands')
    expect(ACCOUNT_MENU.find((i) => i.label === 'Admin')?.adminOnly).toBe(true)
    expect(SIGN_OUT).toBe('Sign out')
    const header = code('app/_components/Header.tsx')
    expect(header).toMatch(/planLabel\(profile\.subscription_status\)/)
    expect(header).toMatch(/ACCOUNT_MENU\.filter\(\(item\) => !item\.adminOnly \|\| profile\.is_admin === true\)/)
    expect(header).toMatch(/\{SIGN_OUT\}/)
    expect(header, 'Brands is linked by hand somewhere in the bar').not.toMatch(/href="\/brands"/)
  })
})

describe('the credit chip', () => {
  const kit = read('app/kit.css')
  const rule = (selector: string) => {
    const at = kit.indexOf(`${selector} {`)
    expect(at, `${selector} rule in kit.css`).toBeGreaterThanOrEqual(0)
    return kit.slice(at, kit.indexOf('}', at))
  }

  it('is gold — money only — with readable gold words on the soft gold', () => {
    const chip = rule('.kit-credit')
    expect(chip).toMatch(/color: var\(--gold\);/)
    expect(chip).toMatch(/background: var\(--gold-soft\);/)
    expect(chip).not.toMatch(/--accent|--success|--mint/)
    expect(code('app/_components/Header.tsx')).toMatch(/className="kit-credit"\s+data-level=\{level\}/)
  })

  it('turns amber below one standard video, read from credits.ts', () => {
    const low = rule(".kit-credit[data-level='low']")
    expect(low).toMatch(/color: var\(--warning-text\)/)
    expect(low).toMatch(/background: var\(--warning-bg\)/)
    expect(creditLevel(CREDIT_COSTS.videoStandard - 1, CREDIT_COSTS.videoStandard)).toBe('low')
    expect(creditLevel(CREDIT_COSTS.videoStandard, CREDIT_COSTS.videoStandard)).toBe('ok')
    expect(creditLevel(0, CREDIT_COSTS.videoStandard)).toBe('low')
    expect(code('app/(dashboard)/layout.tsx')).toMatch(/lowCreditsAt=\{CREDIT_COSTS\.videoStandard\}/)
  })

  it('keeps "+ Top Up"', () => {
    expect(read('app/_components/Header.tsx')).toContain('+ Top Up')
  })
})

describe('the kit', () => {
  const kitFiles = [
    'app/kit.css',
    ...readdirSync(path.join(ROOT, 'app/_components/kit')).map((f) => `app/_components/kit/${f}`),
    'app/_components/Header.tsx',
    'app/_components/HowToUse.tsx',
    'app/(dashboard)/dashboard/page.tsx',
    'app/(dashboard)/dashboard/_home/home.module.css',
  ]

  it('types no colours — only the names from globals.css', () => {
    const HEX = /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/
    for (const f of kitFiles) {
      const lines = code(f).split('\n').filter((l) => HEX.test(l))
      expect(lines, `${f} types a colour`).toEqual([])
      expect(read(f), `${f} uses --mint`).not.toMatch(/var\(--mint/)
    }
  })

  it('keeps corners at 10px or less', () => {
    for (const f of ['app/kit.css', 'app/(dashboard)/dashboard/_home/home.module.css']) {
      for (const m of read(f).matchAll(/border-radius:\s*([^;]+);/g)) {
        for (const v of m[1].trim().split(/\s+/)) {
          if (v === '50%' || v === '0') continue
          expect(Number.parseFloat(v), `${f}: border-radius ${m[1]}`).toBeLessThanOrEqual(10)
        }
      }
    }
  })

  it('is loaded once, right after globals.css', () => {
    const layout = read('app/layout.tsx')
    expect(layout.indexOf('import "./kit.css"')).toBeGreaterThan(layout.indexOf('import "./globals.css"'))
    expect(layout.match(/kit\.css/g)?.length).toBe(1)
  })

  it('has the parts later phases move screens onto', () => {
    const index = read('app/_components/kit/index.ts')
    for (const part of ['Button', 'Card', 'Choices', 'Note', 'Tabs', 'Chip', 'EmptyState', 'Dialog']) {
      expect(index, part).toMatch(new RegExp(`as ${part}\\b`))
    }
    const css = read('app/kit.css')
    for (const tone of ['info', 'ok', 'warn', 'stop']) expect(css).toContain(`.kit-note--${tone}`)
    for (const v of ['primary', 'secondary', 'quiet']) expect(css).toContain(`.kit-btn--${v}`)
    expect(css).toContain('.kit-btn-price')
    expect(css).toContain('.kit-btn-reason')
  })
})
