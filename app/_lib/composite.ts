/**
 * Composites branding onto Gemini-generated slides.
 * Gemini generates brand-free content slides. This function adds:
 * - Logo (cover + closing slides only, top-left)
 * - Branded bottom bar with company name + contact info (all slides)
 * - Agent photo (cover = headshot circle, closing = standing photo)
 */
export async function compositeSlide(
  slideBuffer: Buffer,
  photoUrl: string | null,
  logoUrl: string | null,
  isFirstSlide: boolean,
  isLastSlide: boolean = false,
  standingPhotoUrl: string | null = null,
  brandName: string | null = null,
  primaryColor: string | null = null,
  contactInfo?: { phone?: string; website?: string }
): Promise<Buffer> {
  const sharpMod = await import('sharp')
  const sharp = sharpMod.default ?? sharpMod

  let image = sharp(slideBuffer)
  const metadata = await image.metadata()
  const width = metadata.width ?? 1920
  const height = metadata.height ?? 1080

  const composites: any[] = []

  // ═══ BRANDED BOTTOM BAR (all slides) ═══
  // Draw a colored bar with company name and contact info
  const barHeight = 52
  const barColor = primaryColor ?? '#1B365D'
  const barY = height - barHeight

  // Build bar text
  const barParts: string[] = []
  if (brandName) barParts.push(brandName)
  if (contactInfo?.phone) barParts.push(contactInfo.phone)
  if (contactInfo?.website) barParts.push(contactInfo.website)
  const barText = barParts.join('  |  ')

  if (barText) {
    // Create the bar background
    const barBg = Buffer.from(
      `<svg width="${width}" height="${barHeight}">
        <rect x="0" y="0" width="${width}" height="${barHeight}" fill="${barColor}"/>
      </svg>`
    )
    composites.push({ input: barBg, left: 0, top: barY })

    // Create the bar text
    // Escape XML entities in text
    const safeText = barText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const textSvg = Buffer.from(
      `<svg width="${width}" height="${barHeight}">
        <text x="${width / 2}" y="${barHeight / 2 + 5}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="500" fill="white" letter-spacing="1">${safeText}</text>
      </svg>`
    )
    composites.push({ input: textSvg, left: 0, top: barY })
  }

  // ═══ LOGO (cover + closing only, top-left) ═══
  if (logoUrl && (isFirstSlide || isLastSlide)) {
    try {
      const logoRes = await fetch(logoUrl)
      if (logoRes.ok) {
        const logoBuffer = Buffer.from(await logoRes.arrayBuffer())
        const logoWidth = 240
        const logoHeight = 80
        const logoImage = await sharp(logoBuffer)
          .resize({ width: logoWidth, height: logoHeight, fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer()

        // Get actual resized dimensions
        const logoMeta = await sharp(logoImage).metadata()
        const actualLogoW = logoMeta.width ?? logoWidth
        const actualLogoH = logoMeta.height ?? logoHeight

        // Add a subtle semi-transparent backdrop behind the logo for readability
        const logoBackdrop = Buffer.from(
          `<svg width="${actualLogoW + 20}" height="${actualLogoH + 16}">
            <rect x="0" y="0" width="${actualLogoW + 20}" height="${actualLogoH + 16}" rx="8" fill="rgba(255,255,255,0.85)"/>
          </svg>`
        )

        const logoWithBackdrop = await sharp(logoBackdrop)
          .composite([{ input: logoImage, left: 10, top: 8 }])
          .png()
          .toBuffer()

        composites.push({
          input: logoWithBackdrop,
          left: 30,
          top: 22,
        })
      }
    } catch {
      // Skip logo if fetch fails
    }
  }

  // ═══ AGENT PHOTO ═══
  const shouldShowPhoto = isFirstSlide || isLastSlide
  const photoToUse = isLastSlide
    ? (standingPhotoUrl ?? photoUrl)
    : photoUrl
  const useCircularCrop = isFirstSlide

  if (shouldShowPhoto && photoToUse) {
    try {
      const photoRes = await fetch(photoToUse)
      if (photoRes.ok) {
        const photoBuffer = Buffer.from(await photoRes.arrayBuffer())

        if (useCircularCrop) {
          // Circular photo with border (title slide)
          const photoSize = 200
          const borderSize = 6
          const totalSize = photoSize + borderSize * 2

          const circleMask = Buffer.from(
            `<svg width="${photoSize}" height="${photoSize}">
              <circle cx="${photoSize / 2}" cy="${photoSize / 2}" r="${photoSize / 2}" fill="white"/>
            </svg>`
          )

          const circularPhoto = await sharp(photoBuffer)
            .resize(photoSize, photoSize, { fit: 'cover' })
            .composite([{ input: circleMask, blend: 'dest-in' }])
            .png()
            .toBuffer()

          const shadowPadding = 8
          const shadowTotal = totalSize + shadowPadding * 2
          const borderCircle = Buffer.from(
            `<svg width="${shadowTotal}" height="${shadowTotal}">
              <defs>
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="rgba(0,0,0,0.4)"/>
                </filter>
              </defs>
              <circle cx="${shadowTotal / 2}" cy="${shadowTotal / 2}" r="${totalSize / 2}" fill="rgba(255,255,255,0.3)" filter="url(#shadow)"/>
            </svg>`
          )

          const photoWithBorder = await sharp(borderCircle)
            .composite([{
              input: circularPhoto,
              left: borderSize + shadowPadding,
              top: borderSize + shadowPadding,
            }])
            .png()
            .toBuffer()

          composites.push({
            input: photoWithBorder,
            left: width - shadowTotal - 42,
            top: height - shadowTotal - barHeight - 20,
          })
        } else {
          // Rectangular photo (CTA/last slide)
          const photoHeight = 400
          const photoWidth = 280

          const resizedPhoto = await sharp(photoBuffer)
            .resize(photoWidth, photoHeight, { fit: 'cover' })
            .png()
            .toBuffer()

          const roundedMask = Buffer.from(
            `<svg width="${photoWidth}" height="${photoHeight}">
              <rect x="0" y="0" width="${photoWidth}" height="${photoHeight}" rx="16" ry="16" fill="white"/>
            </svg>`
          )

          const maskedPhoto = await sharp(resizedPhoto)
            .composite([{ input: roundedMask, blend: 'dest-in' }])
            .png()
            .toBuffer()

          const rectShadowPad = 10
          const shadowW = photoWidth + rectShadowPad * 2
          const shadowH = photoHeight + rectShadowPad * 2
          const rectShadow = Buffer.from(
            `<svg width="${shadowW}" height="${shadowH}">
              <defs>
                <filter id="rshadow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="rgba(0,0,0,0.35)"/>
                </filter>
              </defs>
              <rect x="${rectShadowPad}" y="${rectShadowPad}" width="${photoWidth}" height="${photoHeight}" rx="16" ry="16" fill="rgba(255,255,255,0.15)" filter="url(#rshadow)"/>
            </svg>`
          )

          const photoWithShadow = await sharp(rectShadow)
            .composite([{ input: maskedPhoto, left: rectShadowPad, top: rectShadowPad }])
            .png()
            .toBuffer()

          composites.push({
            input: photoWithShadow,
            left: width - shadowW - 50,
            top: height - shadowH - barHeight - 10,
          })
        }
      }
    } catch {
      // Skip photo if fetch fails
    }
  }

  if (composites.length > 0) {
    image = sharp(slideBuffer).composite(composites)
  }

  return image.png().toBuffer()
}
