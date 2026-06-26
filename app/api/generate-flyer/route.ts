import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { checkCredits, deductCredits, CREDIT_COSTS } from '../../_lib/credits'
import { SLIDE_STYLES } from '../../_lib/types'
import type { Brand } from '../../_lib/types'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 300

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

/**
 * Hard rules that turn Gemini's default "photo of a flyer on a desk" into a
 * FLAT, full-bleed, print-ready artwork. Without these it renders a mockup
 * (paper + shadow + table), which is useless for printing.
 */
const FLAT_PRINT_RULES = `CRITICAL OUTPUT FORMAT — this is the FLAT PRINTED ARTWORK ITSELF, not a photo of it:
- Full-bleed: the design fills the ENTIRE canvas, edge to edge, all four corners. No borders, margins, or empty frame around it.
- Absolutely NO mockup: no desk, table, hand, wall, easel, paper sheet, drop shadow, page curl, 3D perspective, or photographed scene. Straight-on, flat, 2D graphic design only.
- It must look like a file opened in a design app, ready to send to a printer.`

/**
 * AI art-direction pass — invents a BESPOKE visual concept for this specific
 * flyer (like the cinematographer step for video scenes), so flyers are
 * genuinely creative instead of a safe template. Returns a short directive
 * the image model follows. Best-effort: falls back to a strong generic brief.
 */
async function artDirectFlyer(input: {
  eventName: string; details: string; styleName: string; brandName?: string
}): Promise<string> {
  const fallback = `A bold, award-winning editorial poster concept for "${input.eventName}": one striking central visual metaphor, dramatic oversized typography, confident asymmetric layout, rich layered color, strong negative space. Magazine-quality, not a clip-art template.`
  try {
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) return fallback
    const anthropic = new Anthropic({ apiKey: key })
    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 400,
      system: `You are an award-winning print art director. Given a flyer's purpose, invent ONE bold, specific visual CONCEPT for it: a central metaphor/imagery idea, a composition approach, a mood, and a palette direction. Be concrete and creative — avoid generic "clean and modern". 3-4 sentences, written as a directive to an image generator. No preamble.`,
      messages: [{ role: 'user', content: `Flyer for: "${input.eventName}". Details: ${input.details || '(none)'}. Style family: ${input.styleName}.${input.brandName ? ` Brand: ${input.brandName}.` : ''}` }],
    })
    const text = resp.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('').trim()
    return text || fallback
  } catch {
    return fallback
  }
}

type FlyerSize = 'flyer-full' | 'flyer-half' | 'postcard' | 'poster' | 'social-square' | 'social-story' | 'biz-card-front' | 'biz-card-back'

const SIZE_CONFIG: Record<FlyerSize, { label: string; width: number; height: number; aspectRatio: string }> = {
  'flyer-full':     { label: 'Full Page Flyer (8.5x11")', width: 2550, height: 3300, aspectRatio: '3:4' },
  'flyer-half':     { label: 'Half Page Flyer (5.5x8.5")', width: 1650, height: 2550, aspectRatio: '3:4' },
  'postcard':       { label: 'Postcard (4x6")',            width: 1200, height: 1800, aspectRatio: '2:3' },
  'poster':         { label: 'Poster (11x17")',            width: 3300, height: 5100, aspectRatio: '2:3' },
  'social-square':  { label: 'Social Media Square',        width: 1080, height: 1080, aspectRatio: '1:1' },
  'social-story':   { label: 'Social Media Story',         width: 1080, height: 1920, aspectRatio: '9:16' },
  'biz-card-front': { label: 'Business Card Front',        width: 1050, height: 600,  aspectRatio: '16:9' },
  'biz-card-back':  { label: 'Business Card Back',         width: 1050, height: 600,  aspectRatio: '16:9' },
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const COST = CREDIT_COSTS.flyer
  const credit = await checkCredits(user.id, COST)
  if (!credit.allowed) {
    return NextResponse.json({ error: `Not enough credits. Need ${COST}, have ${credit.remaining}.` }, { status: 402 })
  }
  if (!(await deductCredits(user.id, COST, 'flyer'))) {
    return NextResponse.json({ error: 'Credit deduction failed. Please try again.' }, { status: 402 })
  }

  const body = await request.json()
  const {
    brandId,
    styleId,
    eventName,
    eventDate: date,
    eventTime: time,
    venue,
    address,
    details,
    contactInfo,
    sizes,
    overrideWidth,
    overrideHeight,
  } = body as {
    brandId?: string
    styleId: string
    eventName: string
    eventDate?: string
    eventTime?: string
    venue?: string
    address?: string
    details?: string
    contactInfo?: string
    sizes: FlyerSize[]
    overrideWidth?: number
    overrideHeight?: number
  }

  // Clamp custom dimensions if provided
  const clampDim = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
  const hasOverride = typeof overrideWidth === 'number' && typeof overrideHeight === 'number'
  const oWidth = hasOverride ? clampDim(overrideWidth, 200, 5000) : null
  const oHeight = hasOverride ? clampDim(overrideHeight, 200, 5000) : null

  if (!styleId || !eventName || !sizes?.length) {
    return NextResponse.json({ error: 'Please provide an event name, select a style, and at least one size' }, { status: 400 })
  }

  // Load brand (optional)
  let brand: Brand | null = null
  if (brandId) {
    const { data: brandData } = await supabase.from('brands').select('*').eq('id', brandId).single()
    brand = brandData as Brand | null
  }

  const colors = {
    primary: brand?.primary_color ?? '#1B3A5C',
    secondary: brand?.secondary_color ?? '#3BB5C8',
    accent: brand?.accent_color ?? '#F5A623',
    background: brand?.background_color ?? '#0a1628',
    text: brand?.text_color ?? '#FFFFFF',
  }

  const logoUrl = brand?.logo_file_url ?? brand?.logo_url ?? null

  // Download logo if available
  let logoBuffer: Buffer | null = null
  if (logoUrl) {
    try {
      const logoRes = await fetch(logoUrl, { signal: AbortSignal.timeout(8000) })
      if (logoRes.ok) logoBuffer = Buffer.from(await logoRes.arrayBuffer())
    } catch {
      console.log('[generate-flyer] Could not download logo, proceeding without it')
    }
  }

  const style = SLIDE_STYLES.find(s => s.id === styleId) ?? SLIDE_STYLES[0]

  // Art-direct ONCE for the whole flyer (same concept across all sizes). This is
  // what makes the result genuinely creative rather than a safe template.
  const concept = await artDirectFlyer({
    eventName,
    details: [date, time, venue, address, details, contactInfo].filter(Boolean).join(' · '),
    styleName: style.name,
    brandName: brand?.name,
  })

  const admin = createAdminClient()
  const timestamp = Date.now()
  const results: { size: string; label: string; imageUrl: string; width: number; height: number }[] = []

  // Generate flyer for each selected size
  for (const size of sizes) {
    const baseConfig = SIZE_CONFIG[size]
    if (!baseConfig) continue

    // Apply dimension overrides if provided
    const config = hasOverride
      ? { ...baseConfig, width: oWidth!, height: oHeight! }
      : baseConfig

    const hasLogo = !!(logoBuffer || logoUrl)

    const colorInstruction = logoBuffer
      ? `COLOR PALETTE:
- Extract the dominant colors from the provided logo image and use them as the PRIMARY brand colors.
- Build a FULL, RICH color palette around the logo colors.
- Derive complementary, analogous, and accent colors that harmonize with the logo.
- Use the logo's main color for headings and key elements, complementary colors for backgrounds, and accent colors for highlights.
- The flyer should feel colorful, vibrant, and professional.`
      : `BRAND COLORS (use these exact colors):
- Primary: ${colors.primary}, Secondary: ${colors.secondary}, Accent: ${colors.accent}
- Background: ${colors.background}, Text: ${colors.text}`

    // Build event details block
    const eventDetailsLines: string[] = []
    if (date) eventDetailsLines.push(`- DATE: "${date}"`)
    if (time) eventDetailsLines.push(`- TIME: "${time}"`)
    if (venue) eventDetailsLines.push(`- VENUE: "${venue}"`)
    if (address) eventDetailsLines.push(`- ADDRESS: "${address}"`)
    if (details) eventDetailsLines.push(`- ADDITIONAL DETAILS: "${details}"`)
    if (contactInfo) eventDetailsLines.push(`- CONTACT / BOOKING INFO: "${contactInfo}"`)

    const promptText = `Design a bold, award-winning PRINT FLYER as FLAT graphic artwork.

${FLAT_PRINT_RULES}

CREATIVE CONCEPT (this is the art direction — execute it boldly):
${concept}

DESIGN STYLE (typography, layout sensibility, aesthetic — colors come from the brand/logo, not the style):
${style.prompt}

${colorInstruction}

FLYER CONTENT (use EXACTLY this text, correctly spelled, nothing else):
- HEADLINE (the LARGEST, most dominant element): "${eventName}"
${eventDetailsLines.join('\n')}
${brand?.name ? `- BRAND / ORGANIZER: "${brand.name}"` : ''}
${hasLogo ? '- The brand logo is provided — integrate it cleanly (corner or header), do not distort it.' : ''}

RULES:
- The headline must dominate; date, venue, and contact must be clearly legible with strong hierarchy.
- Real, correctly-spelled text only — NO lorem ipsum, NO placeholder text, NO invented details.
- NO photorealistic human faces; stylized/illustrated figures or iconography are fine if the concept calls for it.
- Striking, magazine-quality composition with intentional negative space — not a generic centered template.
- Vertical ${config.label} proportions, high-resolution, print-ready, full-bleed to all four edges.`

    // Build content parts
    const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
      { text: promptText },
    ]

    if (logoBuffer) {
      parts.push({
        inlineData: { mimeType: 'image/png', data: logoBuffer.toString('base64') },
      })
    }

    // Compute aspect ratio — use base config's preset ratio, or approximate for overrides
    let aspectRatio = baseConfig.aspectRatio
    if (hasOverride) {
      const w = oWidth!
      const h = oHeight!
      const ratio = w / h
      // Map to nearest supported Gemini aspect ratio
      if (ratio > 1.6) aspectRatio = '16:9'
      else if (ratio > 1.3) aspectRatio = '3:2'
      else if (ratio > 1.1) aspectRatio = '4:3'
      else if (ratio > 0.9) aspectRatio = '1:1'
      else if (ratio > 0.7) aspectRatio = '3:4'
      else if (ratio > 0.55) aspectRatio = '2:3'
      else aspectRatio = '9:16'
    }

    const response = await genai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: [{ role: 'user', parts }],
      config: {
        responseFormat: {
          image: {
            aspectRatio,
            imageSize: '4K',
          },
        },
      } as any,
    })

    const responseParts = response.candidates?.[0]?.content?.parts ?? []
    let flyerBuffer: Buffer | null = null
    for (const rp of responseParts) {
      if (rp.inlineData) {
        flyerBuffer = Buffer.from(rp.inlineData.data!, 'base64')
        break
      }
    }

    if (!flyerBuffer) {
      console.log(`[generate-flyer] Gemini did not return an image for ${size}, skipping`)
      continue
    }

    // Upload to Supabase storage
    const storagePath = `${user.id}/flyers/${timestamp}/${size}.png`
    await admin.storage.from('videos').upload(storagePath, flyerBuffer, { contentType: 'image/png', upsert: true })
    const { data: urlData } = admin.storage.from('videos').getPublicUrl(storagePath)

    results.push({
      size,
      label: config.label,
      imageUrl: urlData.publicUrl,
      width: config.width,
      height: config.height,
    })
  }

  // Log each flyer to unified creations table (non-blocking)
  for (const r of results) {
    await admin.from('creations').insert({
      user_id: user.id,
      type: 'flyer',
      title: eventName + ' - ' + r.label,
      thumbnail_url: r.imageUrl,
      file_url: r.imageUrl,
    })
  }

  return NextResponse.json({ flyers: results })
}
