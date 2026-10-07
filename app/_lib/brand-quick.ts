// =============================================================================
// "ADD YOUR BRAND" INSIDE THE FIRST PROJECT — the pure parts.
//
// Since the light start there is no separate brand page before the first
// project. Step 3 ("Make it yours") has a small "Add your brand" piece instead:
// name, website, logo, two colours. It saves through the SAME code as the
// Brands page (createProjectBrand in app/_actions/brands.ts) and the same logo
// processing (/api/brands/logo), so nothing about brands is duplicated.
//
// Logo rule (CLAUDE.md): real logos only — one the person uploads, or the one
// on their own website. Never drawn by AI. No logo → their name as text.
// =============================================================================

/** The same starting colours the Brands page uses when nothing is known. */
export const QUICK_BRAND_DEFAULT_COLORS = { primary: '#1B365D', secondary: '#4A90D9' } as const

const HEX6 = /^#[0-9a-f]{6}$/i

/** Plain 6-digit hex colours only, first two, no repeats (website colours). */
export function pickBrandColors(colors: unknown): { primary?: string; secondary?: string } {
  const list = Array.isArray(colors) ? colors : []
  const seen: string[] = []
  for (const c of list) {
    if (typeof c !== 'string' || !HEX6.test(c.trim())) continue
    const v = c.trim().toUpperCase()
    if (!seen.includes(v)) seen.push(v)
    if (seen.length === 2) break
  }
  return { primary: seen[0], secondary: seen[1] }
}

type Draft = Record<string, unknown> | null | undefined
type ProfileBits = { company_name?: string | null; full_name?: string | null } | null | undefined

/**
 * What the piece starts with: what the project already knows (a website it
 * read on step 1, the contact website), then the person's company or name.
 */
export function quickBrandPrefill(draft: Draft, profile: ProfileBits): {
  name: string; website: string; primary: string; secondary: string
} {
  const auto = (draft?.autoBrandInfo ?? {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const colors = pickBrandColors([auto.primary_color, auto.secondary_color])
  return {
    name: str(auto.name) || str(profile?.company_name) || str(profile?.full_name),
    website: str(auto.website) || str(draft?.contactWebsite),
    primary: colors.primary ?? QUICK_BRAND_DEFAULT_COLORS.primary,
    secondary: colors.secondary ?? QUICK_BRAND_DEFAULT_COLORS.secondary,
  }
}
