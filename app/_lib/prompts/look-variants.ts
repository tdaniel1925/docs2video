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

// =============================================================
// LOGO-INTEGRATED PROMPTS
// =============================================================

export const LOGO_LOOK_ANCHORED_PANEL = (
  brand: BrandContext,
  slide: SlideContent
) => `
Create a 1920x1080 editorial infographic illustration, 16:9 aspect ratio.

The attached image is the company's official logo. Use it EXACTLY as
provided — original colors, original proportions, no modifications, no
restyling, no recoloring. Place it as the centerpiece of a vertical
anchor panel on the left side of the composition.

LAYOUT:
- Left anchor panel (0 to 480px wide, full height): solid ${brand.primaryHex}
  background with the logo centered in the upper third
- Below the logo within the panel: tagline space and supporting brand
  text in white
- Main content area (480px to 1920px): white or light background hosting
  the infographic content
- Smooth curved transition between panel and content area
- Bottom contact bar (1840px to 1920px y-coordinate): solid ${brand.primaryHex}
  band, full width, with white text reading exactly:
  "${brand.website}  |  ${brand.phone}"

CONTENT TO RENDER:
Headline: "${slide.headline}"
${slide.subheadline ? `Subheadline: "${slide.subheadline}"` : ''}
${slide.bodyBlocks.map((b, i) => `Block ${i + 1}: "${b}"`).join('\n')}
${slide.stats ? `Stats row: ${slide.stats.map(s => `${s.value} ${s.label}`).join(' | ')}` : ''}

STYLE:
- Editorial infographic, flat illustration aesthetic
- Color palette: ${brand.primaryHex} (60%), ${brand.secondaryHex} (30%),
  ${brand.accentHex} (10%)
- Geometric icon set, consistent stroke weight
- Bold sans-serif typography for headlines
- Clean grid layout, generous whitespace
- Professional, confident, modern

CRITICAL EXCLUSIONS:
- Do NOT redraw, modify, recolor, or restyle the logo
- Do NOT invent additional logos, lettermarks, monograms, or brand badges
- Do NOT add placeholder text like "Logo here" or reserved boxes
- Do NOT add company name as separate text element (the logo carries it)
- Do NOT add taglines beyond what is specified in the content
- Do NOT use stock photo aesthetics; this is flat editorial illustration
`.trim()

export const LOGO_LOOK_CORNER_MARK = (
  brand: BrandContext,
  slide: SlideContent
) => `
Create a 1920x1080 editorial infographic illustration, 16:9 aspect ratio.

The attached image is the company's official logo. Use it EXACTLY as
provided — original colors, original proportions, no modifications.
Place it in the top-left corner at approximately 200px wide, with
40px margin from edges.

LAYOUT:
- Logo: top-left corner, 200px wide, 40px margin
- Headline area: top-center, large bold typography
- Main content: distributed grid across the canvas
- Bottom contact bar: solid ${brand.primaryHex} band, 80px tall,
  full width, white text: "${brand.website}  |  ${brand.phone}"
- Generous whitespace, content-forward composition

CONTENT TO RENDER:
Headline: "${slide.headline}"
${slide.subheadline ? `Subheadline: "${slide.subheadline}"` : ''}
${slide.bodyBlocks.map((b, i) => `Block ${i + 1}: "${b}"`).join('\n')}
${slide.stats ? `Stats: ${slide.stats.map(s => `${s.value} ${s.label}`).join(' | ')}` : ''}

STYLE:
- Minimalist editorial infographic
- Color palette: ${brand.primaryHex} (50%), ${brand.secondaryHex} (40%),
  ${brand.accentHex} (10%)
- Refined geometric icons
- Modern sans-serif typography
- Lots of breathing room, magazine-quality layout

CRITICAL EXCLUSIONS:
- Do NOT redraw, modify, recolor, or restyle the logo
- Do NOT invent additional logos or brand marks anywhere on the slide
- Do NOT add the company name as separate text
- Do NOT add placeholder boxes or reserved space markers
- Do NOT clutter the composition; restraint is the goal
`.trim()

export const LOGO_LOOK_SCENE_INTEGRATED = (
  brand: BrandContext,
  slide: SlideContent
) => `
Create a 1920x1080 editorial infographic illustration, 16:9 aspect ratio.

The attached image is the company's official logo. Use it EXACTLY as
provided — original colors, original proportions, no modifications.
Integrate it as a visual anchor within an abstract geometric composition
in the upper-left quadrant, treated as if part of the design system
rather than an overlay.

LAYOUT:
- Logo integrated into upper-left geometric composition, approximately
  220px wide
- Abstract geometric shapes in brand colors fan out from the logo area,
  guiding the eye into the content
- Main infographic content occupies the right two-thirds of the canvas
- Bottom contact bar: solid ${brand.primaryHex} band, 80px tall,
  white text: "${brand.website}  |  ${brand.phone}"

CONTENT TO RENDER:
Headline: "${slide.headline}"
${slide.subheadline ? `Subheadline: "${slide.subheadline}"` : ''}
${slide.bodyBlocks.map((b, i) => `Block ${i + 1}: "${b}"`).join('\n')}
${slide.stats ? `Stats: ${slide.stats.map(s => `${s.value} ${s.label}`).join(' | ')}` : ''}

STYLE:
- Bold editorial infographic with geometric flair
- Color palette: ${brand.primaryHex} (50%), ${brand.secondaryHex} (35%),
  ${brand.accentHex} (15%)
- Sharp geometric shapes, layered composition
- Strong typographic hierarchy
- Confident, modern, design-forward

CRITICAL EXCLUSIONS:
- Do NOT redraw or modify the logo in any way
- Do NOT invent additional logos, monograms, or lettermarks
- Do NOT add placeholder content
- Do NOT add company name as separate text
`.trim()

// =============================================================
// CONTACT-BAR-ONLY PROMPTS (no logo)
// =============================================================

export const FALLBACK_LOOK_BAR_HEADER = (
  brand: BrandContext,
  slide: SlideContent
) => `
Create a 1920x1080 editorial infographic illustration, 16:9 aspect ratio.

LAYOUT:
- Top header bar: solid ${brand.primaryHex} band, 100px tall, full width
  - Inside the header, left-aligned with 40px margin, render the text
    "${brand.companyName}" in clean white sans-serif, bold weight,
    approximately 36pt
- Main content area: white background, occupies 100px to 1840px y-coordinate
- Bottom contact bar: solid ${brand.primaryHex} band, 80px tall, full width
  - White text centered: "${brand.website}  |  ${brand.phone}"

CONTENT TO RENDER:
Headline: "${slide.headline}"
${slide.subheadline ? `Subheadline: "${slide.subheadline}"` : ''}
${slide.bodyBlocks.map((b, i) => `Block ${i + 1}: "${b}"`).join('\n')}
${slide.stats ? `Stats: ${slide.stats.map(s => `${s.value} ${s.label}`).join(' | ')}` : ''}

STYLE:
- Editorial infographic, flat illustration aesthetic
- Color palette: ${brand.primaryHex} (50%), ${brand.secondaryHex} (35%),
  ${brand.accentHex} (15%)
- Geometric icon set with consistent stroke weight
- Bold sans-serif typography
- Clean grid, generous whitespace
- Professional and modern

CRITICAL EXCLUSIONS:
- Do NOT invent or draw any logos, lettermarks, monograms, brand badges,
  shields, or initials in circles anywhere on the slide
- Do NOT add a logo placeholder or "logo here" text
- The company name appears ONLY in the top header bar as text — nowhere else
- Do NOT add additional taglines or marketing copy beyond what is specified
- Do NOT use stock photo aesthetics
`.trim()

export const FALLBACK_LOOK_MINIMAL_FOOTER = (
  brand: BrandContext,
  slide: SlideContent
) => `
Create a 1920x1080 editorial infographic illustration, 16:9 aspect ratio.

LAYOUT:
- Top of canvas: company name "${brand.companyName}" rendered as clean
  text in ${brand.primaryHex}, top-left corner, 40px margin, 32pt bold
  sans-serif. No box, no decoration, just typography.
- Main content area: occupies the bulk of the canvas
- Bottom contact bar: solid ${brand.primaryHex} band, 80px tall, full
  width, white text centered: "${brand.website}  |  ${brand.phone}"

CONTENT TO RENDER:
Headline: "${slide.headline}"
${slide.subheadline ? `Subheadline: "${slide.subheadline}"` : ''}
${slide.bodyBlocks.map((b, i) => `Block ${i + 1}: "${b}"`).join('\n')}
${slide.stats ? `Stats: ${slide.stats.map(s => `${s.value} ${s.label}`).join(' | ')}` : ''}

STYLE:
- Minimalist editorial infographic
- Color palette: ${brand.primaryHex} (60%), ${brand.secondaryHex} (30%),
  ${brand.accentHex} (10%)
- Refined geometric icons, thin stroke weight
- Modern sans-serif typography with strong hierarchy
- Significant whitespace, restrained composition

CRITICAL EXCLUSIONS:
- Do NOT invent or draw ANY logos, lettermarks, monograms, brand badges,
  shields, or initials in circles
- Do NOT add a logo placeholder or reserved space
- The company name appears ONLY as the top-left text — nowhere else
- Do NOT add taglines or additional marketing copy
- Do NOT use stock photo aesthetics
`.trim()

export const FALLBACK_LOOK_GEOMETRIC_HERO = (
  brand: BrandContext,
  slide: SlideContent
) => `
Create a 1920x1080 editorial infographic illustration, 16:9 aspect ratio.

LAYOUT:
- Left side (0 to 480px wide, full height): solid ${brand.primaryHex}
  panel with "${brand.companyName}" rendered vertically or in stacked
  bold typography in white, occupying the upper portion of the panel
- Curved or angular transition into the main content area
- Main content area (480px to 1920px): white or light background
- Bottom contact bar (1840px to 1920px y-coordinate): solid
  ${brand.primaryHex} band extending full width, white text:
  "${brand.website}  |  ${brand.phone}"

CONTENT TO RENDER:
Headline: "${slide.headline}"
${slide.subheadline ? `Subheadline: "${slide.subheadline}"` : ''}
${slide.bodyBlocks.map((b, i) => `Block ${i + 1}: "${b}"`).join('\n')}
${slide.stats ? `Stats: ${slide.stats.map(s => `${s.value} ${s.label}`).join(' | ')}` : ''}

STYLE:
- Bold editorial infographic with geometric structure
- Color palette: ${brand.primaryHex} (55%), ${brand.secondaryHex} (35%),
  ${brand.accentHex} (10%)
- Sharp geometric shapes, confident layout
- Strong typographic hierarchy
- Design-forward, magazine-quality

CRITICAL EXCLUSIONS:
- Do NOT invent or draw ANY logos, lettermarks, monograms, brand badges,
  shields, or initials in circles anywhere on the slide
- The company name appears ONLY as styled typography in the left panel
- Do NOT add a separate logo or brand mark
- Do NOT add placeholder boxes or reserved space markers
- Do NOT add taglines beyond what is specified
`.trim()

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

// Get a specific variant by ID
export function getLookPrompt(hasLogo: boolean, variantId: string) {
  const variants = getLookVariants(hasLogo)
  return variants.find(v => v.id === variantId) ?? variants[0]
}

// Default variant per mode
export function getDefaultLookId(hasLogo: boolean): string {
  return hasLogo ? 'corner_mark' : 'bar_header'
}
