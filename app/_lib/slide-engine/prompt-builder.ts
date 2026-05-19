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

  // Use specialized prompts for cover/closing, generic for content slides
  if (content.layout === 'title') {
    return buildCoverPrompt(template, resolvedColors, logoDescription, content)
  }
  if (content.layout === 'closing') {
    return buildClosingPrompt(template, resolvedColors, logoDescription, content)
  }

  // Content slide prompt
  const prompt = `Create a ${template.name} style presentation slide at 1536x1024 pixels.

=== VISUAL DESIGN (follow EXACTLY) ===
BACKGROUND: ${spec.background.base}${spec.background.texture ? `. Texture: ${spec.background.texture}` : ''}${spec.background.gradient ? `. ${spec.background.gradient}` : ''}

DECORATIVE ELEMENTS:
- Primary: ${spec.decorativeElements.primary}
- ${spec.decorativeElements.secondary ? `Secondary: ${spec.decorativeElements.secondary}` : ''}
- ${spec.decorativeElements.accents ? `Accents: ${spec.decorativeElements.accents}` : ''}

COLOR PALETTE (derived from brand logo — use these EXACT colors):
- Primary accent color: ${resolvedColors.primary} (use for highlights, borders, main accents)
- Secondary accent color: ${resolvedColors.secondary} (use for secondary highlights, accent text)
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
${logoDescription ? `Small brand logo (120px wide) in the top-right or bottom-right corner. Keep it in its ORIGINAL colors.` : 'No logo.'}

=== CONTENT ===
${contentSection}

=== FOOTER ===
${content.brandName ? `${content.brandName}` : ''} ${content.contactInfo?.website ? `| ${content.contactInfo.website}` : ''} ${content.pageNumber ? `| ${content.pageNumber} / ${content.totalPages || '?'}` : ''}

=== CRITICAL RULES ===
- 80px safe padding on ALL edges — nothing cut off
- Every letter, number, and symbol must be complete and readable
- Follow the color palette EXACTLY
- The design must feel cohesive — every element belongs to the same visual world
- Maximum visual polish — gradients, glows, shadows, depth, texture
- 1536x1024 pixels`

  return prompt
}

/**
 * Build a cinematic cover slide prompt.
 * Rich background, large centered logo with glow, title below, accent line separator.
 */
function buildCoverPrompt(
  template: TemplateSpec,
  colors: { primary: string; secondary: string; text: string; background: string; highlight?: string },
  logoDescription: string | undefined,
  content: SlideContent,
): string {
  const spec = template.designSpec
  return `Create a CINEMATIC COVER SLIDE in ${template.name} style. 1536x1024 pixels.

=== BACKGROUND ===
Rich, dramatic background using the ${template.name} design language.
Base: ${spec.background.base}${spec.background.texture ? `. Texture: ${spec.background.texture}` : ''}
Add depth with a radial gradient — slightly lighter in the center where the logo sits, darker at edges.
${spec.decorativeElements.primary ? `Decorative touches: ${spec.decorativeElements.primary} — subtle, framing the content, not competing with it.` : ''}

=== COLOR PALETTE ===
- Primary: ${colors.primary}
- Secondary: ${colors.secondary}
- Text: ${colors.text}
- Background: ${colors.background}

=== LOGO (HERO ELEMENT) ===
${logoDescription
    ? `The brand logo is the HERO of this slide. Place it LARGE and centered (about 400px wide) in the upper-center area of the slide. Add a subtle glow or soft shadow behind the logo for depth and premium feel. Keep the logo in its ORIGINAL colors — do NOT recolor it.`
    : 'No logo provided — use a stylish decorative monogram or abstract shape as the centerpiece instead.'}

=== TITLE ===
Below the logo, add a thin accent line (2px) in ${colors.secondary} as a separator (about 200px wide, centered).

Then the title: "${content.headline}" — rendered in ${spec.typography.headline}. Large, bold, commanding.
${content.subtitle ? `Below the title: "${content.subtitle}" in ${spec.typography.body}, lighter weight, ${colors.text} at 80% opacity.` : ''}

=== BOTTOM ===
${content.brandName ? `"${content.brandName}" in small uppercase text at the very bottom center, letter-spaced, subtle.` : ''}

=== CRITICAL RULES ===
- This is the FIRST thing viewers see — it must feel premium, polished, cinematic
- Logo is the dominant visual element — large, centered, with depth
- Title text must be crisp, fully readable, no letters cut off
- 80px safe padding on ALL edges
- NO clutter — logo, accent line, title, subtitle. That's it.
- 1536x1024 pixels`
}

/**
 * Build a Call-to-Action closing slide prompt.
 * Logo top center, bold headline, contact info with icons, drives action.
 */
function buildClosingPrompt(
  template: TemplateSpec,
  colors: { primary: string; secondary: string; text: string; background: string; highlight?: string },
  logoDescription: string | undefined,
  content: SlideContent,
): string {
  const spec = template.designSpec
  const contact = content.contactInfo || {}
  const contactItems: string[] = []
  if (contact.phone) contactItems.push(`PHONE ICON + "${contact.phone}"`)
  if (contact.email) contactItems.push(`EMAIL ICON + "${contact.email}"`)
  if (contact.website) contactItems.push(`GLOBE ICON + "${contact.website}"`)
  if (contact.calendly) contactItems.push(`CALENDAR ICON + "${contact.calendly}"`)

  return `Create a CALL-TO-ACTION CLOSING SLIDE in ${template.name} style. 1536x1024 pixels.

=== BACKGROUND ===
Match the cover slide's dramatic feel — same ${template.name} design language.
Base: ${spec.background.base}${spec.background.texture ? `. Texture: ${spec.background.texture}` : ''}
Slightly different from the cover — perhaps a complementary gradient angle or inverted emphasis.

=== COLOR PALETTE ===
- Primary: ${colors.primary}
- Secondary: ${colors.secondary}
- Text: ${colors.text}
- Background: ${colors.background}

=== LOGO ===
${logoDescription
    ? `Brand logo centered near the top, about 250px wide. Subtle glow/shadow for depth. Keep ORIGINAL logo colors.`
    : 'No logo — use a decorative accent element at the top instead.'}

=== HEADLINE ===
"${content.headline}" — large, bold, in ${spec.typography.headline}. Centered below the logo.
This should feel like an invitation — warm, confident, actionable.

=== CONTACT INFO ===
Below the headline, display contact information in a clean, styled layout:
${contactItems.length > 0
    ? contactItems.map(item => `- ${item}`).join('\n')
    : '- No specific contact info — show a generic "Visit us online" message'}

Each contact item should have:
- A small, clean icon (line-art style) in ${colors.secondary}
- The text beside it in ${spec.typography.body}
- Arranged vertically, centered, with comfortable spacing between items

=== DECORATIVE ===
${spec.decorativeElements.primary ? `Subtle decorative elements: ${spec.decorativeElements.primary} — framing the content elegantly.` : ''}
A thin accent line above the contact section (matching the cover slide's accent line) in ${colors.secondary}.

=== CRITICAL RULES ===
- This is the LAST slide — it must leave a strong impression and drive action
- Contact info must be 100% readable — every phone number, email, URL perfectly clear
- Logo + headline + contact info — clean hierarchy, no clutter
- 80px safe padding on ALL edges
- Must feel like a bookend to the cover slide — same visual world
- 1536x1024 pixels`
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
