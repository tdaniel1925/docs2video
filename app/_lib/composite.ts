/**
 * Composites overlays onto Gemini-generated slides:
 * - Cover/closing: Sharp-rendered logo+text overlay (transparent PNG)
 * - Cover: circular headshot photo (bottom-right)
 * - Closing: standing photo (bottom-right)
 * - Middle slides: Sharp-rendered logo watermark (top-left corner)
 * All logo rendering is done by Sharp — Gemini never touches the logo.
 */
export async function compositeSlide(
  slideBuffer: Buffer,
  photoUrl: string | null,
  logoUrl: string | null,
  isFirstSlide: boolean,
  isLastSlide: boolean = false,
  standingPhotoUrl: string | null = null,
  _brandName: string | null = null,
  _primaryColor: string | null = null,
  _contactInfo?: { phone?: string; website?: string },
  coverOverlayBuffer?: Buffer | null,
): Promise<Buffer> {
  const sharpMod = await import('sharp')
  const sharp = sharpMod.default ?? sharpMod

  let image = sharp(slideBuffer)
  const metadata = await image.metadata()
  const width = metadata.width ?? 1920
  const height = metadata.height ?? 1080

  const composites: any[] = []

  // GPT overlay (logo + title text) for cover/closing slides
  if (coverOverlayBuffer && (isFirstSlide || isLastSlide)) {
    // Resize overlay to match slide dimensions
    const resizedOverlay = await sharp(coverOverlayBuffer)
      .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()

    composites.push({
      input: resizedOverlay,
      left: 0,
      top: 0,
    })
  }

  // Agent photo — cover slide (circle headshot) or closing slide (standing)
  const shouldShowPhoto = isFirstSlide || isLastSlide
  const photoToUse = isLastSlide ? (standingPhotoUrl ?? photoUrl) : photoUrl
  const useCircularCrop = isFirstSlide

  if (shouldShowPhoto && photoToUse) {
    try {
      const photoRes = await fetch(photoToUse)
      if (photoRes.ok) {
        const photoBuffer = Buffer.from(await photoRes.arrayBuffer())

        if (useCircularCrop) {
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
            top: height - shadowTotal - 100,
          })
        } else {
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
            top: height - shadowH - 100,
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
