/**
 * Generates logo + title text overlays using Sharp (no AI API calls).
 *
 * Cover slide: Large centered logo + title + subtitle
 * Closing slide: Large centered logo + "Thank You" + contact info
 * Middle slides: Small logo watermark in top-left corner
 *
 * All overlays are transparent PNGs composited onto Gemini slides.
 * This is 100% reliable, pixel-perfect, and free (no API cost).
 */

interface CoverOverlayOptions {
  logoBuffer: Buffer
  title: string
  subtitle?: string
  contactInfo?: { phone?: string; website?: string }
  colors: { primary: string; secondary: string; accent: string; background: string; text: string }
  isCover: boolean // true = cover slide, false = closing slide
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

/**
 * Generate a cover or closing overlay: large centered logo + title text.
 * Returns a transparent 1920x1080 PNG.
 */
export async function generateCoverOverlay(options: CoverOverlayOptions): Promise<Buffer> {
  const { logoBuffer, title, subtitle, contactInfo, colors, isCover } = options
  const sharpMod = await import('sharp')
  const sharp = sharpMod.default ?? sharpMod

  const width = 1920
  const height = 1080

  // Resize logo — large and prominent
  const logoMaxW = isCover ? 500 : 400
  const logoMaxH = isCover ? 280 : 220
  const resizedLogo = await sharp(logoBuffer)
    .resize(logoMaxW, logoMaxH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  const logoMeta = await sharp(resizedLogo).metadata()
  const logoW = logoMeta.width ?? logoMaxW
  const logoH = logoMeta.height ?? logoMaxH

  // Position logo in upper-center area
  const logoLeft = Math.round((width - logoW) / 2)
  const logoTop = isCover ? Math.round(height * 0.18) : Math.round(height * 0.2)

  // Build text lines
  const lines: { text: string; size: number; weight: string; opacity: number }[] = []
  if (isCover) {
    lines.push({ text: title, size: 56, weight: 'bold', opacity: 1 })
    if (subtitle) lines.push({ text: subtitle, size: 30, weight: 'normal', opacity: 0.85 })
  } else {
    lines.push({ text: 'Thank You', size: 52, weight: 'bold', opacity: 1 })
    if (subtitle) lines.push({ text: subtitle, size: 28, weight: 'normal', opacity: 0.85 })
    if (contactInfo?.phone) lines.push({ text: contactInfo.phone, size: 24, weight: 'normal', opacity: 0.7 })
    if (contactInfo?.website) lines.push({ text: contactInfo.website, size: 24, weight: 'normal', opacity: 0.7 })
  }

  // Build SVG text
  const textStartY = logoTop + logoH + 50
  const svgLines = lines.map((line, i) => {
    const y = textStartY + i * (line.size + 18)
    return `<text x="${width / 2}" y="${y}" font-family="Plus Jakarta Sans, Helvetica Neue, Arial, sans-serif" font-size="${line.size}" font-weight="${line.weight}" fill="${esc(colors.text)}" fill-opacity="${line.opacity}" text-anchor="middle" dominant-baseline="hanging">${esc(line.text)}</text>`
  })

  // Add a subtle text shadow for readability on any background
  const shadowLines = lines.map((line, i) => {
    const y = textStartY + i * (line.size + 18) + 2
    return `<text x="${width / 2 + 1}" y="${y}" font-family="Plus Jakarta Sans, Helvetica Neue, Arial, sans-serif" font-size="${line.size}" font-weight="${line.weight}" fill="black" fill-opacity="0.4" text-anchor="middle" dominant-baseline="hanging">${esc(line.text)}</text>`
  })

  const svgText = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${shadowLines.join('\n      ')}
      ${svgLines.join('\n      ')}
    </svg>`
  )

  // Composite logo + text on transparent canvas
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

/**
 * Generate a small logo watermark for middle slides.
 * Returns a transparent 1920x1080 PNG with logo in top-left corner.
 */
export async function generateLogoWatermark(logoBuffer: Buffer): Promise<Buffer> {
  const sharpMod = await import('sharp')
  const sharp = sharpMod.default ?? sharpMod

  const width = 1920
  const height = 1080

  // Small logo for corner watermark
  const resizedLogo = await sharp(logoBuffer)
    .resize(160, 60, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  return sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([
      { input: resizedLogo, left: 40, top: 30 },
    ])
    .png()
    .toBuffer()
}
