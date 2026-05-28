import OpenAI from 'openai'
import sharp from 'sharp'

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  return _openai
}

interface CoverOptions {
  title: string
  companyName?: string | null
  logoUrl?: string | null
  brandColors: { primary: string; secondary: string }
  stylePrompt: string
  type: 'cover' | 'closing'
  contactInfo?: { phone?: string; email?: string; website?: string }
}

/**
 * Generate a stunning cover or closing slide:
 * 1. AI generates illustrated background using brand colors
 * 2. Sharp composites the real logo (large, centered, contrast-checked)
 * 3. Sharp adds title text and subtitle via SVG overlay
 *
 * Returns a PNG buffer ready to send to VPS as a pre-rendered slide.
 */
export async function generateCoverSlide(options: CoverOptions): Promise<Buffer> {
  const { title, companyName, logoUrl, brandColors, stylePrompt, type, contactInfo } = options

  // Step 1: Generate illustrated background
  const bgPrompt = type === 'cover'
    ? `Create a stunning, vibrant illustrated background for a premium video title card. 1920x1080 landscape.

${stylePrompt}

Scene: A beautiful, atmospheric panoramic illustration. Use these brand colors prominently — primary: ${brandColors.primary}, secondary: ${brandColors.secondary}. Rich depth, layered composition, golden light or dramatic lighting. Abstract shapes and visual metaphors (paths, horizons, architectural elements) that feel hopeful and professional.

The CENTER of the image (roughly 700x400px area) should be slightly lighter or have natural negative space — a clearing in the sky, an open area, or a natural focal point — where a logo and title text will be placed on top.

This is the OPENING FRAME of a premium corporate video. It must feel cinematic, inspiring, and premium. Rich textures, painterly quality, layered depth.

NO TEXT. NO LOGOS. NO WORDS of any kind. Pure illustrated artwork.`
    : `Create a stunning illustrated background for a video closing card. 1920x1080 landscape.

${stylePrompt}

Scene: A warm, hopeful conclusion illustration. Use brand colors — primary: ${brandColors.primary}, secondary: ${brandColors.secondary}. Show a sense of completion and invitation — an open door with warm light, a path leading to a bright horizon, or a welcoming destination. Warm golden tones, soft atmospheric depth.

The CENTER should have clear space for logo and contact information overlay.

This is the CLOSING FRAME. It should feel warm, inviting, and actionable — the viewer should feel motivated to take the next step.

NO TEXT. NO LOGOS. NO WORDS of any kind. Pure illustrated artwork.`

  const bgRes = await getOpenAI().images.generate({
    model: 'gpt-image-2',
    prompt: bgPrompt,
    size: '1536x1024',
    quality: 'high',
    n: 1,
  })

  let bgBuffer: Buffer = Buffer.from(bgRes.data![0].b64_json!, 'base64')
  bgBuffer = Buffer.from(await sharp(bgBuffer).resize(1920, 1080, { fit: 'cover' }).png().toBuffer())

  // Step 2: Load and prepare logo (if available)
  let logoBuffer: Buffer | null = null
  if (logoUrl) {
    try {
      if (logoUrl.startsWith('data:')) {
        logoBuffer = Buffer.from(logoUrl.split(',')[1], 'base64')
      } else {
        const logoRes = await fetch(logoUrl, { signal: AbortSignal.timeout(10000) })
        if (logoRes.ok) logoBuffer = Buffer.from(await logoRes.arrayBuffer())
      }
    } catch (err) {
      console.error('[cover-gen] Failed to load logo:', err instanceof Error ? err.message : 'unknown')
    }
  }

  // Step 3: Analyze background brightness at center to determine logo contrast
  let centerIsDark = true
  try {
    const centerCrop = await sharp(bgBuffer)
      .extract({ left: 660, top: 340, width: 600, height: 400 })
      .stats()
    const avgBrightness = centerCrop.channels.reduce((sum, ch) => sum + ch.mean, 0) / centerCrop.channels.length
    centerIsDark = avgBrightness < 140
  } catch { /* default to dark */ }

  // Step 4: Composite everything via Sharp
  const composites: sharp.OverlayOptions[] = []

  // Add a subtle dark/light overlay at center for contrast
  const overlayOpacity = centerIsDark ? 0.3 : 0.4
  const overlayColor = centerIsDark ? '0,0,0' : '0,0,0'
  const gradientSvg = Buffer.from(`
    <svg width="1920" height="1080">
      <defs>
        <radialGradient id="g" cx="50%" cy="45%" r="50%">
          <stop offset="0%" stop-color="rgba(${overlayColor},${overlayOpacity})"/>
          <stop offset="100%" stop-color="rgba(${overlayColor},0)"/>
        </radialGradient>
      </defs>
      <rect width="1920" height="1080" fill="url(#g)"/>
    </svg>
  `)
  composites.push({ input: gradientSvg, top: 0, left: 0 })

  // Logo — large and centered
  let logoTop = 300
  let logoHeight = 0
  if (logoBuffer) {
    try {
      const logoResized = await sharp(logoBuffer)
        .resize(550, null, { fit: 'inside', withoutEnlargement: false })
        .png()
        .toBuffer()
      const logoMeta = await sharp(logoResized).metadata()
      const lw = logoMeta.width || 550
      const lh = logoMeta.height || 220
      logoHeight = lh
      logoTop = type === 'cover'
        ? Math.round((1080 - lh) / 2) - 80
        : Math.round((1080 - lh) / 2) - 100

      // Add white glow/shadow behind logo for contrast if background is busy
      const glowSvg = Buffer.from(`
        <svg width="${lw + 80}" height="${lh + 60}">
          <defs>
            <filter id="blur"><feGaussianBlur stdDeviation="20"/></filter>
          </defs>
          <rect x="10" y="10" width="${lw + 60}" height="${lh + 40}" rx="20"
            fill="${centerIsDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)'}" filter="url(#blur)"/>
        </svg>
      `)
      composites.push({
        input: glowSvg,
        top: logoTop - 20,
        left: Math.round((1920 - lw) / 2) - 40,
      })

      composites.push({
        input: logoResized,
        top: logoTop,
        left: Math.round((1920 - lw) / 2),
      })
    } catch (err) {
      console.error('[cover-gen] Logo composite failed:', err instanceof Error ? err.message : 'unknown')
    }
  }

  // Title and subtitle text
  const textColor = centerIsDark ? 'white' : '#1B365D'
  const textShadow = centerIsDark ? '2px 2px 8px rgba(0,0,0,0.8)' : '1px 1px 4px rgba(255,255,255,0.8)'
  const titleY = logoBuffer
    ? logoTop + logoHeight + 50
    : 420

  const escapedTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const escapedCompany = (companyName || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  if (type === 'cover') {
    // Cover: title + company subtitle
    const titleSvg = Buffer.from(`
      <svg width="1920" height="1080">
        <style>
          .title { font-family: Arial, Helvetica, sans-serif; font-weight: 800; fill: ${textColor}; }
          .subtitle { font-family: Arial, Helvetica, sans-serif; font-weight: 600; fill: ${textColor}; opacity: 0.85; }
        </style>
        <text x="960" y="${titleY}" class="title" font-size="38" text-anchor="middle" letter-spacing="1">${escapedTitle}</text>
        ${companyName && !logoBuffer ? `<text x="960" y="${titleY + 50}" class="subtitle" font-size="26" text-anchor="middle">${escapedCompany}</text>` : ''}
      </svg>
    `)
    composites.push({ input: titleSvg, top: 0, left: 0 })
  } else {
    // Closing: "Thank You" + contact info
    const contactLines: string[] = []
    if (companyName) contactLines.push(companyName)
    if (contactInfo?.website) contactLines.push(contactInfo.website)
    if (contactInfo?.phone) contactLines.push(contactInfo.phone)
    if (contactInfo?.email) contactLines.push(contactInfo.email)
    const contactText = contactLines.join('  ·  ')

    const closingSvg = Buffer.from(`
      <svg width="1920" height="1080">
        <style>
          .thanks { font-family: Arial, Helvetica, sans-serif; font-weight: 800; fill: ${textColor}; }
          .contact { font-family: Arial, Helvetica, sans-serif; font-weight: 600; fill: ${textColor}; opacity: 0.8; }
          .cta { font-family: Arial, Helvetica, sans-serif; font-weight: 700; fill: ${textColor}; opacity: 0.9; }
        </style>
        <text x="960" y="${titleY}" class="thanks" font-size="44" text-anchor="middle">Thank You</text>
        <text x="960" y="${titleY + 55}" class="cta" font-size="24" text-anchor="middle">Ready to take the next step?</text>
        ${contactText ? `
          <rect x="360" y="${titleY + 80}" width="1200" height="50" rx="8" fill="rgba(0,0,0,0.3)"/>
          <text x="960" y="${titleY + 112}" class="contact" font-size="20" text-anchor="middle">${contactText.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>
        ` : ''}
      </svg>
    `)
    composites.push({ input: closingSvg, top: 0, left: 0 })
  }

  // Final composite
  const result = await sharp(bgBuffer)
    .composite(composites)
    .png()
    .toBuffer()

  return result
}
