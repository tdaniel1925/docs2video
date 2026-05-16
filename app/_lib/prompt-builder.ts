import sharp from 'sharp'

/**
 * Generate a 400x100 color swatch image showing 5 brand colors side by side.
 * This gets passed as a reference image to Gemini for better brand consistency.
 */
export async function generateColorSwatch(colors: {
  primary: string
  secondary: string
  accent: string
  background: string
  text: string
}): Promise<Buffer> {
  const width = 400
  const height = 100
  const blockWidth = width / 5

  const colorList = [
    colors.primary,
    colors.secondary,
    colors.accent,
    colors.background,
    colors.text,
  ]

  const svgBlocks = colorList
    .map((color, i) => {
      const x = i * blockWidth
      return `<rect x="${x}" y="0" width="${blockWidth}" height="${height}" fill="${color}" />`
    })
    .join('\n')

  const svgLabels = ['Primary', 'Secondary', 'Accent', 'Background', 'Text']
    .map((label, i) => {
      const x = i * blockWidth + blockWidth / 2
      const hex = colorList[i].replace('#', '')
      const r = parseInt(hex.substring(0, 2), 16)
      const g = parseInt(hex.substring(2, 4), 16)
      const b = parseInt(hex.substring(4, 6), 16)
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      const textColor = luminance > 0.5 ? '#000000' : '#ffffff'
      return `<text x="${x}" y="58" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="bold" fill="${textColor}">${label}</text>
<text x="${x}" y="74" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" fill="${textColor}">${colorList[i]}</text>`
    })
    .join('\n')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
${svgBlocks}
${svgLabels}
</svg>`

  return sharp(Buffer.from(svg)).png().toBuffer()
}

/**
 * 6-Component Structured Prompt Builder for image generation.
 *
 * Every raw slide description is wrapped in the professional formula:
 *   Subject -> Action -> Environment -> Art Style -> Lighting -> Details
 *
 * This produces dramatically better results from any image-generation model
 * because each component gives the model a clear, non-overlapping dimension
 * to optimise for.
 */

export function buildStructuredPrompt(opts: {
  subject: string
  action?: string
  environment?: string
  artStyle: string // from the template style prompt
  lighting?: string
  details?: string
  brandName?: string | null
  brandColors?: { primary: string; secondary: string; accent: string; background: string; text: string }
}): string {
  const {
    subject,
    action,
    environment,
    artStyle,
    lighting,
    details,
    brandName,
    brandColors,
  } = opts

  // 1. Subject
  const subjectBlock = `[SUBJECT]: ${subject}`

  // 2. Action — default to a sensible static-scene action
  const actionBlock = `[ACTION]: ${action || 'Displayed as a polished, static presentation slide with clear visual hierarchy'}`

  // 3. Environment — default to an abstract professional backdrop
  const environmentBlock = `[ENVIRONMENT]: ${environment || 'Clean, modern abstract background with subtle geometric accents'}`

  // 4. Art Style — always use the template style prompt verbatim
  const artStyleBlock = `[ART STYLE]: ${artStyle}`

  // 5. Lighting — always be specific, never "good lighting"
  const lightingBlock = `[LIGHTING]: ${lighting || 'Soft directional key light from upper-left at 45 degrees, gentle ambient fill, subtle rim highlights on edges for depth'}`

  // 6. Details — lens / texture / finishing
  const defaultDetails = 'Shot on 85mm f/1.4 lens, shallow depth of field on background elements, 4K resolution, ultra-detailed, professional presentation slide, crisp typography'
  const detailsBlock = `[DETAILS]: ${details ? `${details}. ${defaultDetails}` : defaultDetails}`

  // Brand colour instructions — adapt template palette to harmonize with brand
  let brandBlock = ''
  if (brandColors) {
    brandBlock = `\n[BRAND COLOR ADAPTATION — CRITICAL]:
You MUST adapt this template's color palette to complement and harmonize with these brand colors:
- Primary: ${brandColors.primary}
- Secondary: ${brandColors.secondary}
- Accent: ${brandColors.accent}
- Background base: ${brandColors.background}
- Text: ${brandColors.text}

COLOR HARMONY RULES:
- Use the brand's primary color as the dominant accent throughout the slide
- Adapt the template's default palette so it complements (not clashes with) the brand colors
- If the template has a signature color (e.g. neon green, gold, teal), shift it toward the brand's primary/accent hue
- Background and text colors should create proper contrast for readability
- The slide should feel like it was DESIGNED for this brand — not a generic template with colors overlaid
- Keep the template's artistic STYLE (textures, shapes, effects) but adapt the COLOR PALETTE to the brand`
  }
  if (brandName) {
    brandBlock += `\n[BRAND]: "${brandName}" — render as styled text only, never as a logo`
  }

  return [subjectBlock, actionBlock, environmentBlock, artStyleBlock, lightingBlock, detailsBlock, brandBlock]
    .filter(Boolean)
    .join('\n')
}
