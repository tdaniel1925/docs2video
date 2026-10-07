import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { QUICK_BRAND_DEFAULT_COLORS, pickBrandColors, quickBrandPrefill } from '../app/_lib/brand-quick'

/*
 * BRAND INSIDE THE FIRST PROJECT (overhaul phase 5). Step 3's "Add your
 * brand" piece replaces the brand page new people used to go through first.
 * It must reuse the brand code (not copy it) and keep the logo rule: real
 * logos only, never drawn; no logo → the name as text.
 */
const ROOT = path.resolve(__dirname, '..')
const read = (f: string) => readFileSync(path.join(ROOT, f), 'utf8')
const PIECE = 'app/(dashboard)/create/_components/make/AddBrandPiece.tsx'

describe('Add your brand — prefill', () => {
  it('starts from what the project read (website, name, colours), then the person’s company or name', () => {
    const fromSite = quickBrandPrefill({ autoBrandInfo: { name: 'Rivera Co', website: 'https://rivera.example', primary_color: '#112233', secondary_color: 'blue' } }, { company_name: 'Other' })
    expect(fromSite).toEqual({ name: 'Rivera Co', website: 'https://rivera.example', primary: '#112233', secondary: QUICK_BRAND_DEFAULT_COLORS.secondary })
    expect(quickBrandPrefill({ contactWebsite: 'agency.example' }, { company_name: '', full_name: 'Sam Lee' }))
      .toMatchObject({ name: 'Sam Lee', website: 'agency.example', primary: QUICK_BRAND_DEFAULT_COLORS.primary })
    expect(quickBrandPrefill(null, null).name).toBe('')
  })

  it('takes only plain hex colours from a website, two at most, no repeats', () => {
    expect(pickBrandColors(['#aabbcc', 'rgb(1,2,3)', '#AABBCC', '#123456', '#654321'])).toEqual({ primary: '#AABBCC', secondary: '#123456' })
    expect(pickBrandColors(null)).toEqual({ primary: undefined, secondary: undefined })
  })
})

describe('Add your brand — reuses the brand code, keeps the logo rule', () => {
  const piece = read(PIECE)

  it('saves through createProjectBrand, which builds the row with the Brands page’s own code', () => {
    expect(piece).toContain('createProjectBrand(fd)')
    expect(piece).not.toMatch(/from\('brands'\)\.(insert|update)/)
    const actions = read('app/_actions/brands.ts')
    expect(actions).toMatch(/export async function createBrand[\s\S]*?insert\(newBrandRow\(formData, user\.id\)\)/)
    expect(actions).toMatch(/export async function createProjectBrand[\s\S]*?insert\(newBrandRow\(formData, user\.id\)\)/)
    // A person's first brand becomes the default for their next projects.
    expect(actions).toMatch(/formData\.set\('is_default', \(existing \?\? \[\]\)\.length === 0 \? 'true' : 'false'\)/)
  })

  it('logos go through the Brands page’s logo processing; website reading is the no-AI reader', () => {
    expect(piece).toContain("fetch('/api/brands/logo'")
    expect(piece).toContain("fetch('/api/brand-from-url'")
    // Never a drawn logo: no image-generation or logo-maker routes.
    expect(piece).not.toMatch(/generate-logo|logo-chat|logo-creator|gpt-image|styleLogo|generateImage/i)
    expect(piece).toContain('Only your real logo — we never draw one. No logo? Your name shows as text')
  })

  it('step 3 opens it in place for a first project, and saving puts the brand on this project', () => {
    const theme = read('app/(dashboard)/create/theme/page.tsx')
    expect(theme).toMatch(/setAddingBrand\(!found && d\.brandId === undefined\)/)
    expect(theme).toMatch(/onClick=\{\(\) => setAddingBrand\(\(o\) => !o\)\}>Add your brand<\/button>/)
    expect(piece).toMatch(/updates: \{ brandId: made\.id \}/)
  })

  it('types no colours of its own (colour names only; the defaults live in brand-quick.ts)', () => {
    const HEX = /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/
    expect(piece).not.toMatch(HEX)
    expect(read('app/(dashboard)/create/_components/make/AddBrandPiece.module.css')).not.toMatch(HEX)
  })
})
