import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { brandTemplatePalette, isTemplateColors, VIDEO_TEMPLATE_IDS } from '../app/_lib/video-templates'
import { brandSkin, contrast } from '../app/_lib/template-palette'

/*
 * Owner, 2026-10-18: "templates need to be able to change to brand colors."
 * Colors: Template | My brand on the Look step (Templates only, and only when
 * the chosen brand has colors); the cards recolor live with the engine's own
 * pages and rules; the choice is saved on the draft and reaches the job with
 * the CHOSEN brand's colors — never the account's.
 */
const ROOT = join(__dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const LOOK = 'app/(dashboard)/create/_components/steps/LookVoiceReview.tsx'

describe('the colors a brand gives a template', () => {
  it('its main, second and accent color, valid hex only, in that order', () => {
    expect(brandTemplatePalette({ primary_color: '#1B365D', secondary_color: 'blue', accent_color: ' #F2A93B ' })).toEqual(['#1B365D', '#F2A93B'])
    expect(brandTemplatePalette(null)).toEqual([])
    expect(brandTemplatePalette({ primary_color: null, secondary_color: null, accent_color: null })).toEqual([])
  })
  it('the choice is the template’s own or the brand’s, nothing else', () => {
    expect(isTemplateColors('brand')).toBe(true)
    expect(isTemplateColors('template')).toBe(true)
    expect(isTemplateColors('neon')).toBe(false)
  })
})

describe('the engine’s rules, copied whole', () => {
  it('template-palette.ts is the engine’s palette.ts, imported by the script (no imports of its own)', () => {
    const p = read('app/_lib/template-palette.ts')
    expect(p).toMatch(/^\/\/ COPIED from One Dollar Decks lib\/code-deck\/templates\/palette\.ts/)
    expect(p).not.toMatch(/^import /m)
    expect(read('scripts/import-template-previews.mjs')).toMatch(/writeFileSync\('app\/_lib\/template-palette\.ts'/)
  })
  it('recolors every template’s preview so its words stay readable, for pages marked "bc" only', () => {
    const previews = JSON.parse(read('public/templates/previews.json')) as Record<string, { skin: string }>
    for (const id of VIDEO_TEMPLATE_IDS) {
      const s = brandSkin(id, previews[id].skin, ['#FFF7AE'])
      expect(s.css, id).toMatch(new RegExp(`\\.t-${id}\\.bc`))
      expect(Object.values(s.map).length, id).toBeGreaterThan(0)
    }
    // A pale yellow is darkened until it reads on Swiss's white.
    const swiss = brandSkin('swiss', previews.swiss.skin, ['#FFF7AE'])
    expect(contrast(swiss.map['#1D4ED8'], '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
  })
})

describe('the preview pages', () => {
  it('are the engine’s fitted pages: every template, its cover, number, cards and closing, every picture on the site', () => {
    const previews = JSON.parse(read('public/templates/previews.json')) as Record<string, { css: string; fonts: string; pages: { layout: string; html: string }[] }>
    expect(Object.keys(previews).sort()).toEqual([...VIDEO_TEMPLATE_IDS].sort())
    for (const id of VIDEO_TEMPLATE_IDS) {
      expect(previews[id].pages.map((p) => p.layout), id).toEqual(['cover', 'bignumber', 'cards', 'closing'])
      for (const p of previews[id].pages) {
        expect(p.html, `${id} ${p.layout}`).not.toMatch(/ART_|PORTRAIT_URL|LOGO_URL/)
        for (const src of p.html.match(/\/templates\/[^"')\s]+\.jpg/g) ?? []) expect(existsSync(join(ROOT, 'public', src)), `${id} ${src}`).toBe(true)
      }
    }
  })
})

describe('the Look step', () => {
  const look = read(LOOK)
  it('offers Colors: Template | My brand on Templates, only when the chosen brand has colors; the template’s own by default', () => {
    expect(look).toMatch(/useState<TemplateColors>\('template'\)/)
    expect(look).toMatch(/const brandPalette = brandTemplatePalette\(brand\)/)
    expect(look).toMatch(/\{isVideo && lookTab === 'templates' && brandPalette\.length \? \(/)
    expect(look).toMatch(/>Template<\/button>/)
    expect(look).toMatch(/My brand\s*<\/button>/)
  })
  it('shows the cards in the brand’s colors, live, when chosen', () => {
    expect(look).toMatch(/palette=\{brandPalette\.length && templateColors === 'brand' \? brandPalette : null\}/)
    const picker = read('app/(dashboard)/create/_components/make/TemplatePicker.tsx')
    expect(picker).toMatch(/<TemplateLive id=\{t\.id\} page=\{0\}/)
    expect(picker).toMatch(/<TemplateLiveStyles palette=\{palette!\} \/>/)
    expect(read('app/(dashboard)/create/_components/make/TemplateLive.tsx')).toMatch(/replace\(\/class="slide tp \(\[\^"\]\*\)"\/, 'class="slide tp \$1 bc"'\)/)
  })
  it('saves the choice on the draft and sends it to be made', () => {
    expect(look).toMatch(/if \(isTemplateColors\(d\.templateColors\)\) setTemplateColors\(d\.templateColors\)/)
    // Saved on the draft, sent with Make it, and sent with the free preview (template-preview.ts).
    expect((look.match(/templateColors: brandPalette\.length \? templateColors : 'template',/g) ?? []).length).toBe(3)
    expect(read('app/api/videos/draft/route.ts')).toMatch(/if \('templateColors' in u && !isTemplateColors\(u\.templateColors\)\) u\.templateColors = 'template'/)
  })
})

describe('the job', () => {
  it('carries the CHOSEN brand’s colors only when the brand’s colors were asked for (never the account’s, never a default)', () => {
    const g = read('app/api/generate-video/route.ts')
    expect(g).toMatch(/\.\.\.\(templateColors === 'brand' \? \{ templateColors, templatePalette: brandTemplatePalette\(brand\) \} : \{\}\)/)
    // `brand` is the chosen brand, scoped to the user; no account fallback.
    expect(g).toMatch(/let brand: Brand \| null = null/)
    expect(g).toMatch(/if \(!brand\) return failAndRefund\(409/)
    const e = read('app/_lib/explainer-engine.ts')
    expect(e).toMatch(/const templatePalette = template && o\.templateColors === 'brand' \? /)
    expect(e).toMatch(/\.\.\.\(templatePalette\.length \? \{ templateColors: 'brand' as const, templatePalette \} : \{\}\)/)
  })
})
