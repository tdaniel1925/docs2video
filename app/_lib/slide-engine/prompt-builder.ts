/**
 * Prompt Builder — assembles template spec + brand colors + content
 * into a detailed prompt for OpenAI image generation.
 */
import type { SlideGenerationInput, SlideContent, BrandColors, TemplateSpec } from './types'

/**
 * Build the full prompt for OpenAI image generation.
 */
export function buildSlidePrompt(input: SlideGenerationInput): string {
  const { template, brandColors, logoDescription, content } = input
  const spec = template.designSpec

  // Resolve color slots
  const resolvedColors = resolveColors(spec.colorSlots, brandColors)

  // Build content section based on layout
  const contentSection = buildContentSection(content)

  // Build the full prompt
  const prompt = `Create a ${template.name} style presentation slide at 1536x1024 pixels.

=== VISUAL DESIGN (follow EXACTLY) ===
BACKGROUND: ${spec.background.base}${spec.background.texture ? `. Texture: ${spec.background.texture}` : ''}${spec.background.gradient ? `. ${spec.background.gradient}` : ''}

DECORATIVE ELEMENTS:
- Primary: ${spec.decorativeElements.primary}
- ${spec.decorativeElements.secondary ? `Secondary: ${spec.decorativeElements.secondary}` : ''}
- ${spec.decorativeElements.accents ? `Accents: ${spec.decorativeElements.accents}` : ''}

COLOR PALETTE (derived from brand logo — use these EXACT colors):
- Primary accent color: ${resolvedColors.primary} (use for splatters, borders, highlights, main accents)
- Secondary accent color: ${resolvedColors.secondary} (use for secondary highlights, accent text, tags)
- Text color: ${resolvedColors.text}
- Background: ${resolvedColors.background}
${resolvedColors.highlight ? `- Highlight: ${resolvedColors.highlight}` : ''}

TYPOGRAPHY:
- Headlines: ${spec.typography.headline}
- ${spec.typography.accent ? `Accent text: ${spec.typography.accent}` : ''}
- Numbers/stats: ${spec.typography.numbers}
- Body text: ${spec.typography.body}
- Labels: ${spec.typography.labels}

${spec.cardStyle ? `CARD STYLE: ${spec.cardStyle}` : ''}
${spec.chartStyle ? `CHART STYLE: ${spec.chartStyle}` : ''}

=== LOGO ===
${logoDescription ? `Place the brand logo in the top area, fully visible, about 250px wide. The logo shows: ${logoDescription}. Keep it in its ORIGINAL colors — do NOT change the logo colors to match the slide palette. The SLIDE adapts to the LOGO, not the other way around.` : 'No logo — skip logo placement.'}

=== CONTENT ===
${contentSection}

=== FOOTER ===
${content.brandName ? `${content.brandName}` : ''} ${content.contactInfo?.website ? `| ${content.contactInfo.website}` : ''} ${content.pageNumber ? `| ${content.pageNumber} / ${content.totalPages || '?'}` : ''}

=== CRITICAL RULES ===
- 80px safe padding on ALL edges — nothing cut off
- Every letter, number, and symbol must be complete and readable
- Follow the color palette EXACTLY — primary accent for main elements, secondary for highlights
- The design must feel cohesive — every element belongs to the same visual world
- Maximum visual polish — gradients, glows, shadows, depth, texture
- 1536x1024 pixels`

  return prompt
}

/**
 * Resolve color slots — replace FROM_LOGO_PRIMARY/SECONDARY with actual brand colors.
 */
function resolveColors(
  slots: TemplateSpec['designSpec']['colorSlots'],
  brand: BrandColors
): { primary: string; secondary: string; text: string; background: string; highlight?: string } {
  const resolve = (value: string): string => {
    if (value === 'FROM_LOGO_PRIMARY') return brand.primary
    if (value === 'FROM_LOGO_SECONDARY') return brand.secondary
    return value
  }
  return {
    primary: resolve(slots.primary),
    secondary: resolve(slots.secondary),
    text: slots.text,
    background: slots.background,
    highlight: slots.highlight ? resolve(slots.highlight) : undefined,
  }
}

/**
 * Build the content section of the prompt based on slide layout.
 */
function buildContentSection(content: SlideContent): string {
  const parts: string[] = []

  parts.push(`HEADLINE: "${content.headline}" in the headline typography style`)
  if (content.subtitle) parts.push(`SUBTITLE: "${content.subtitle}"`)
  if (content.accentText) parts.push(`ACCENT TEXT: "${content.accentText}" in accent/cursive style`)

  switch (content.layout) {
    case 'title':
      parts.push('LAYOUT: Title/cover slide — headline centered prominently with subtitle below')
      break

    case 'stats':
      if (content.stats) {
        parts.push(`LAYOUT: ${content.stats.length} large stat displays in a row:`)
        content.stats.forEach((s, i) => {
          parts.push(`- Stat ${i + 1}: "${s.value}" in massive number style, "${s.label}" as label below${s.sublabel ? `, "${s.sublabel}" as sub-label` : ''}`)
        })
      }
      break

    case 'bullets':
      if (content.bullets) {
        parts.push('LAYOUT: Bullet point list:')
        content.bullets.forEach(b => {
          parts.push(`- "${b.text}"${b.highlight ? ' (HIGHLIGHTED — bold, prominent)' : ''}${b.tag ? ` [TAG: "${b.tag}"]` : ''}`)
        })
      }
      break

    case 'chart':
      if (content.chartData) {
        parts.push(`LAYOUT: ${content.chartData.type.toUpperCase()} CHART`)
        parts.push(`Chart title: "${content.chartData.title}"`)
        content.chartData.series.forEach(s => {
          const dataStr = s.data.map(d => `${d.label}: ${d.value}`).join(', ')
          parts.push(`- Series "${s.name}": ${dataStr}`)
        })
      }
      break

    case 'comparison':
      parts.push('LAYOUT: Two-column comparison:')
      if (content.leftLabel) parts.push(`LEFT COLUMN: "${content.leftLabel}"`)
      content.leftColumn?.forEach(item => parts.push(`  - ${item.text}`))
      if (content.rightLabel) parts.push(`RIGHT COLUMN: "${content.rightLabel}"`)
      content.rightColumn?.forEach(item => parts.push(`  - ${item.text}`))
      break

    case 'table':
      if (content.tableData) {
        parts.push('LAYOUT: Data table:')
        parts.push(`Headers: ${content.tableData.headers.join(' | ')}`)
        content.tableData.rows.forEach(row => {
          parts.push(`Row: ${row.join(' | ')}`)
        })
      }
      break

    case 'closing':
      parts.push('LAYOUT: Closing/thank you slide — headline centered with contact info below')
      if (content.contactInfo) {
        if (content.contactInfo.phone) parts.push(`Phone: ${content.contactInfo.phone}`)
        if (content.contactInfo.email) parts.push(`Email: ${content.contactInfo.email}`)
        if (content.contactInfo.website) parts.push(`Website: ${content.contactInfo.website}`)
        if (content.contactInfo.calendly) parts.push(`Book a meeting: ${content.contactInfo.calendly}`)
      }
      break
  }

  // Add table data if present alongside other layouts
  if (content.layout !== 'table' && content.tableData) {
    parts.push('\nADDITIONAL TABLE DATA:')
    parts.push(`Headers: ${content.tableData.headers.join(' | ')}`)
    content.tableData.rows.forEach(row => {
      parts.push(`Row: ${row.join(' | ')}`)
    })
  }

  return parts.join('\n')
}

/**
 * Extract dominant colors from a logo image using Sharp.
 */
export async function extractLogoColors(logoBuffer: Buffer): Promise<BrandColors> {
  const sharpMod = await import('sharp')
  const sharp = sharpMod.default ?? sharpMod

  // Get dominant colors by resizing to tiny image and reading pixels
  const { data, info } = await sharp(logoBuffer)
    .resize(10, 10, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  // Collect unique-ish colors (skip white/black/gray)
  const colors: { r: number; g: number; b: number; count: number }[] = []
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    // Skip near-white, near-black, and gray
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    const saturation = max === 0 ? 0 : (max - min) / max
    if (saturation < 0.15) continue // skip grays
    if (max < 30) continue // skip blacks
    if (min > 225) continue // skip whites

    const existing = colors.find(c =>
      Math.abs(c.r - r) < 40 && Math.abs(c.g - g) < 40 && Math.abs(c.b - b) < 40
    )
    if (existing) {
      existing.count++
    } else {
      colors.push({ r, g, b, count: 1 })
    }
  }

  // Sort by frequency
  colors.sort((a, b) => b.count - a.count)

  const toHex = (c: { r: number; g: number; b: number }) =>
    '#' + [c.r, c.g, c.b].map(v => v.toString(16).padStart(2, '0')).join('')

  return {
    primary: colors[0] ? toHex(colors[0]) : '#1B365D',
    secondary: colors[1] ? toHex(colors[1]) : '#C0392B',
    tertiary: colors[2] ? toHex(colors[2]) : undefined,
  }
}
