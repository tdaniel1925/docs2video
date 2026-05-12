export type BrandContext = {
  companyName: string
  primaryHex: string
  secondaryHex: string
  accentHex: string
  phone: string
  website: string
  hasLogo: boolean
}

export type SlideContent = {
  slideType: 'cover' | 'content' | 'data' | 'quote' | 'closing'
  headline: string
  subheadline?: string
  bodyBlocks: string[]
  stats?: { value: string; label: string }[]
}

// Contact bar text — consistent across all slides
function contactBarText(brand: BrandContext): string {
  const parts: string[] = []
  if (brand.website) parts.push(brand.website)
  if (brand.phone) parts.push(brand.phone)
  return parts.join('  |  ')
}

// Content block — only actual displayable text, no labels
function contentBlock(slide: SlideContent): string {
  const lines: string[] = []
  lines.push(`The main headline to display: "${slide.headline}"`)
  if (slide.subheadline) lines.push(`A smaller subheadline below: "${slide.subheadline}"`)
  if (slide.bodyBlocks.length > 0) {
    lines.push('Display these points as a list or cards:')
    slide.bodyBlocks.forEach(b => lines.push(`  • ${b}`))
  }
  if (slide.stats && slide.stats.length > 0) {
    lines.push('Display these key statistics prominently with large numbers:')
    slide.stats.forEach(s => lines.push(`  ${s.value} — ${s.label}`))
  }
  return lines.join('\n')
}

// =============================================================
// LOGO-INTEGRATED PROMPTS
// =============================================================

export const LOGO_LOOK_ANCHORED_PANEL = (brand: BrandContext, slide: SlideContent) => `
Create a 1920x1080 editorial infographic illustration.

The attached image is the company's official logo. Place it EXACTLY as provided in the upper portion of a solid ${brand.primaryHex} vertical panel on the left side (roughly the left quarter of the canvas). Do not modify, redraw, or restyle the logo in any way.

The main content area fills the remaining right portion with a white or light background. A smooth curved or angular transition separates the panel from the content.

At the very bottom of the entire image, draw a narrow horizontal band in ${brand.primaryHex} spanning the full width. Inside this band, center the text "${contactBarText(brand)}" in small white letters.

${contentBlock(slide)}

Use an editorial infographic style with flat illustration, geometric icons, bold sans-serif headlines, and generous whitespace. Colors: ${brand.primaryHex} dominant, ${brand.secondaryHex} supporting, ${brand.accentHex} for accents.

Do NOT redraw or modify the logo. Do NOT invent additional logos, lettermarks, or brand badges. Do NOT add the company name as separate text — the logo carries it.
`.trim()

export const LOGO_LOOK_CORNER_MARK = (brand: BrandContext, slide: SlideContent) => `
Create a 1920x1080 editorial infographic illustration.

The attached image is the company's official logo. Place it EXACTLY as provided in the upper-left corner of the image, small enough to not dominate but clearly visible. Do not modify, redraw, or restyle the logo.

The headline should appear prominently in the upper area. The main content fills the center of the canvas in a clean grid layout. Generous whitespace throughout.

At the very bottom, draw a narrow horizontal band in ${brand.primaryHex} spanning the full width with centered white text: "${contactBarText(brand)}"

${contentBlock(slide)}

Minimalist editorial infographic style. Colors: ${brand.primaryHex} primary, ${brand.secondaryHex} supporting, ${brand.accentHex} highlights. Refined geometric icons, modern sans-serif typography, magazine-quality layout.

Do NOT redraw or modify the logo. Do NOT invent additional logos or brand marks. Do NOT add the company name as separate text.
`.trim()

export const LOGO_LOOK_SCENE_INTEGRATED = (brand: BrandContext, slide: SlideContent) => `
Create a 1920x1080 editorial infographic illustration.

The attached image is the company's official logo. Integrate it EXACTLY as provided into an abstract geometric composition in the upper-left area. The logo should feel like part of the design system — surrounded by geometric shapes in brand colors that guide the eye into the main content.

The main infographic content fills the right two-thirds of the canvas.

At the very bottom, draw a narrow horizontal band in ${brand.primaryHex} spanning the full width with centered white text: "${contactBarText(brand)}"

${contentBlock(slide)}

Bold editorial infographic with geometric flair. Colors: ${brand.primaryHex} dominant, ${brand.secondaryHex} supporting, ${brand.accentHex} accents. Sharp geometric shapes, strong typographic hierarchy, design-forward.

Do NOT redraw or modify the logo. Do NOT invent additional logos, monograms, or lettermarks.
`.trim()

// =============================================================
// CONTACT-BAR-ONLY PROMPTS (no logo)
// =============================================================

export const FALLBACK_LOOK_BAR_HEADER = (brand: BrandContext, slide: SlideContent) => `
Create a 1920x1080 editorial infographic illustration.

At the very top, draw a solid ${brand.primaryHex} horizontal band spanning the full width. Inside this band, left-aligned, display "${brand.companyName}" in clean white bold sans-serif text.

The main content area below has a white background filling most of the canvas.

At the very bottom, draw a narrow horizontal band in ${brand.primaryHex} spanning the full width with centered white text: "${contactBarText(brand)}"

${contentBlock(slide)}

Editorial infographic style with flat illustration, geometric icons, bold sans-serif typography, clean grid layout, generous whitespace. Colors: ${brand.primaryHex} dominant, ${brand.secondaryHex} supporting, ${brand.accentHex} accents.

Do NOT invent or draw any logos, lettermarks, monograms, brand badges, shields, or initials. The company name appears ONLY in the top header band as plain text — nowhere else on the slide.
`.trim()

export const FALLBACK_LOOK_MINIMAL_FOOTER = (brand: BrandContext, slide: SlideContent) => `
Create a 1920x1080 editorial infographic illustration.

In the upper-left corner, display "${brand.companyName}" as clean text in ${brand.primaryHex}, bold sans-serif. No box, no decoration, just typography.

The main content fills the bulk of the canvas.

At the very bottom, draw a narrow horizontal band in ${brand.primaryHex} spanning the full width with centered white text: "${contactBarText(brand)}"

${contentBlock(slide)}

Minimalist editorial infographic. Colors: ${brand.primaryHex} dominant, ${brand.secondaryHex} supporting, ${brand.accentHex} accents. Refined geometric icons, modern sans-serif typography, significant whitespace, restrained composition.

Do NOT invent or draw ANY logos, lettermarks, monograms, brand badges, or initials. The company name appears ONLY as the upper-left text — nowhere else.
`.trim()

export const FALLBACK_LOOK_GEOMETRIC_HERO = (brand: BrandContext, slide: SlideContent) => `
Create a 1920x1080 editorial infographic illustration.

On the left side (roughly the left quarter), draw a solid ${brand.primaryHex} panel with "${brand.companyName}" rendered as bold white typography in the upper portion. A curved or angular transition leads into the main content area on the right with a white or light background.

At the very bottom, draw a narrow horizontal band in ${brand.primaryHex} spanning the full width with centered white text: "${contactBarText(brand)}"

${contentBlock(slide)}

Bold editorial infographic with geometric structure. Colors: ${brand.primaryHex} dominant, ${brand.secondaryHex} supporting, ${brand.accentHex} accents. Sharp geometric shapes, confident layout, strong typographic hierarchy.

Do NOT invent or draw ANY logos, lettermarks, monograms, brand badges, or initials. The company name appears ONLY in the left panel typography — nowhere else.
`.trim()

// =============================================================
// RENDERING RULES — appended to EVERY prompt
// =============================================================

const RENDERING_RULES = `

WHAT MUST BE VISIBLE on the final image:
- The headline text
- The list items or statistics
- The contact bar text at the bottom
- The company name (where specified above)

WHAT MUST NOT appear on the final image:
- No pixel measurements, dimensions, or coordinates
- No instruction labels like "Headline:", "Block:", "Subheadline:", "Stats:"
- No color hex codes
- No percentage breakdowns
- No layout descriptions or design instructions
- No periods at the end of headline text
- No quotation marks around displayed text
- Just render the actual content text naturally as part of the design`

// =============================================================
// VARIANT REGISTRY
// =============================================================

export const LOGO_VARIANTS = [
  { id: 'anchored_panel', fn: LOGO_LOOK_ANCHORED_PANEL, description: 'Logo on solid left panel, content right' },
  { id: 'corner_mark', fn: LOGO_LOOK_CORNER_MARK, description: 'Logo top-left corner, minimal layout' },
  { id: 'scene_integrated', fn: LOGO_LOOK_SCENE_INTEGRATED, description: 'Logo as geometric anchor in composition' },
]

export const FALLBACK_VARIANTS = [
  { id: 'bar_header', fn: FALLBACK_LOOK_BAR_HEADER, description: 'Brand name in top header bar' },
  { id: 'minimal_footer', fn: FALLBACK_LOOK_MINIMAL_FOOTER, description: 'Brand name as top-left text, minimalist' },
  { id: 'geometric_hero', fn: FALLBACK_LOOK_GEOMETRIC_HERO, description: 'Brand name in geometric left panel' },
]

export function getLookVariants(hasLogo: boolean) {
  return hasLogo ? LOGO_VARIANTS : FALLBACK_VARIANTS
}

export function getLookPrompt(hasLogo: boolean, variantId: string) {
  const variants = getLookVariants(hasLogo)
  const variant = variants.find(v => v.id === variantId) ?? variants[0]
  return {
    ...variant,
    fn: (brand: BrandContext, slide: SlideContent) => variant.fn(brand, slide) + RENDERING_RULES,
  }
}

export function getDefaultLookId(hasLogo: boolean): string {
  return hasLogo ? 'corner_mark' : 'bar_header'
}
