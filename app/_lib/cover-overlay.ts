/**
 * Generates logo + title text overlays for cover and closing slides
 * using OpenAI GPT Image. The overlay has a transparent background
 * and gets composited onto Gemini-generated decorative backgrounds.
 *
 * This replaces the logo-kit approach: instead of 65 styled logos,
 * we generate 2 overlays per video (cover + closing).
 */
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface OverlayOptions {
  logoBuffer: Buffer
  title: string
  subtitle?: string
  contactInfo?: { phone?: string; website?: string }
  colors: { primary: string; secondary: string; accent: string; background: string; text: string }
  isCover: boolean // true = cover slide, false = closing slide
}

/**
 * Generate a logo + text overlay PNG with transparent background.
 * GPT Image renders the uploaded logo at large size with title text.
 */
export async function generateCoverOverlay(options: OverlayOptions): Promise<Buffer> {
  const { logoBuffer, title, subtitle, contactInfo, colors, isCover } = options

  let textInstructions: string
  if (isCover) {
    textInstructions = `COVER SLIDE OVERLAY:
- Place the provided logo prominently in the CENTER of the image, sized at roughly 300x300 pixels
- Below the logo, render the title text: "${title}"
- ${subtitle ? `Below the title, render subtitle: "${subtitle}"` : 'No subtitle needed'}
- Use clean, modern typography that complements the logo
- Title text should be large (50-60pt equivalent), bold, and highly readable`
  } else {
    textInstructions = `CLOSING SLIDE OVERLAY:
- Place the provided logo in the CENTER of the image, sized at roughly 250x250 pixels
- Below the logo, render: "Thank You"
- ${subtitle ? `Below that: "${subtitle}"` : ''}
- ${contactInfo?.phone ? `Contact: ${contactInfo.phone}` : ''}
- ${contactInfo?.website ? `Website: ${contactInfo.website}` : ''}
- Use clean, professional typography`
  }

  const prompt = `Generate a 1920x1080 PNG image with a COMPLETELY TRANSPARENT background.

${textInstructions}

CRITICAL RULES:
- The background MUST be fully transparent (alpha = 0) — this is an overlay
- Use text color: ${colors.text} for primary text
- Use accent color: ${colors.accent} for decorative elements if any
- The logo must be rendered EXACTLY as provided — do not redraw, simplify, or modify it
- Center everything horizontally on the 1920px canvas
- Position content in the vertical center-to-upper-third area
- Do NOT add any background color, gradient, or pattern — ONLY transparent
- Do NOT add borders, frames, or decorative backgrounds
- Keep it clean: just the logo and text on transparent background`

  try {
    const logoFile = new File([new Uint8Array(logoBuffer)], 'logo.png', { type: 'image/png' })
    const response = await openai.images.edit({
      model: 'gpt-image-1',
      image: logoFile,
      prompt,
      size: '1536x1024' as any, // Closest to 16:9 that GPT Image supports
    })

    const imageData = response.data?.[0]
    if (!imageData) throw new Error('No image returned from GPT Image')

    // GPT Image returns base64
    const b64 = (imageData as any).b64_json
    if (b64) {
      return Buffer.from(b64, 'base64')
    }

    // Fallback: URL-based response
    const url = (imageData as any).url
    if (url) {
      const res = await fetch(url)
      return Buffer.from(await res.arrayBuffer())
    }

    throw new Error('GPT Image returned neither b64_json nor url')
  } catch (err) {
    console.error('[cover-overlay] GPT Image failed, using Sharp fallback:', err)
    return generateFallbackOverlay(options)
  }
}

/**
 * Fallback: if GPT Image fails, use Sharp to composite the raw logo
 * with text rendered as SVG. Not as polished but functional.
 */
async function generateFallbackOverlay(options: OverlayOptions): Promise<Buffer> {
  const { logoBuffer, title, subtitle, contactInfo, colors, isCover } = options
  const sharpMod = await import('sharp')
  const sharp = sharpMod.default ?? sharpMod

  const width = 1920
  const height = 1080

  // Resize logo
  const logoSize = isCover ? 280 : 220
  const resizedLogo = await sharp(logoBuffer)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  const logoMeta = await sharp(resizedLogo).metadata()
  const logoW = logoMeta.width ?? logoSize
  const logoH = logoMeta.height ?? logoSize

  // Build text lines
  const lines: string[] = []
  if (isCover) {
    lines.push(title)
    if (subtitle) lines.push(subtitle)
  } else {
    lines.push('Thank You')
    if (subtitle) lines.push(subtitle)
    if (contactInfo?.phone) lines.push(contactInfo.phone)
    if (contactInfo?.website) lines.push(contactInfo.website)
  }

  // Escape XML entities
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  // Build SVG text overlay
  const titleSize = isCover ? 52 : 44
  const subSize = 28
  const textStartY = height / 2 + logoH / 2 + 40
  const textLines = lines.map((line, i) => {
    const fontSize = i === 0 ? titleSize : subSize
    const fontWeight = i === 0 ? 'bold' : 'normal'
    const y = textStartY + i * (fontSize + 16)
    return `<text x="${width / 2}" y="${y}" font-family="Plus Jakarta Sans, Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="${fontWeight}" fill="${esc(colors.text)}" text-anchor="middle">${esc(line)}</text>`
  })

  const svgText = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${textLines.join('\n      ')}
    </svg>`
  )

  // Composite logo + text on transparent canvas
  const logoLeft = Math.round((width - logoW) / 2)
  const logoTop = Math.round(height / 2 - logoH / 2 - 40)

  return sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([
      { input: resizedLogo, left: logoLeft, top: logoTop },
      { input: svgText, left: 0, top: 0 },
    ])
    .png()
    .toBuffer()
}
