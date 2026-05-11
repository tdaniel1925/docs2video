import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { SLIDE_STYLES } from '../../_lib/types'
import { deductCredits } from '../../_lib/credits'
import type { Brand } from '../../_lib/types'

export const runtime = 'nodejs'
export const maxDuration = 300

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

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

  const body = await request.json()
  const {
    brandId,
    styleId,
    eventName,
    date,
    time,
    venue,
    address,
    details,
    contactInfo,
    sizes,
  } = body as {
    brandId?: string
    styleId: string
    eventName: string
    date?: string
    time?: string
    venue?: string
    address?: string
    details?: string
    contactInfo?: string
    sizes: FlyerSize[]
  }

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
  const admin = createAdminClient()
  const timestamp = Date.now()
  const results: { size: string; label: string; imageUrl: string; width: number; height: number }[] = []

  // Generate flyer for each selected size
  for (const size of sizes) {
    const config = SIZE_CONFIG[size]
    if (!config) continue

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

    const promptText = `Create a high-resolution PRINT FLYER / EVENT POSTER image. This is NOT a presentation slide — this is a print-ready marketing flyer.

This is a high-resolution print flyer. Bold headline, eye-catching design, all event details clearly readable. The event name should be the LARGEST text element. Date and venue should be prominently displayed. Include all details provided.

DESIGN STYLE (follow the layout, typography, visual approach, and aesthetic ONLY — colors come from the brand/logo, not the style):
${style.prompt}

${colorInstruction}

Design for ${config.label} (${config.width}x${config.height} pixels). This is a PRINT FLYER meant to be printed at high resolution. Bold headline, eye-catching design, all event details clearly readable.

FLYER CONTENT:
- EVENT NAME (display as the LARGEST, most prominent text element): "${eventName}"
${eventDetailsLines.join('\n')}
${brand?.name ? `- BRAND / ORGANIZER: "${brand.name}"` : ''}
${hasLogo ? '- The brand logo is provided — integrate it prominently into the flyer design.' : ''}

STRICT RULES:
- NO human faces, NO photos of people, NO realistic human figures
- NO placeholder text — use ONLY the provided event details
- The event name MUST be the largest and most prominent text element
- Date and venue must be prominently displayed and easy to read
- All text must be crisp, legible, and correctly spelled
- Make it visually striking, bold, and attention-grabbing
- Professional, polished, ready to print
${hasLogo ? '- Integrate the provided logo naturally into the design' : ''}
- Design dimensions: ${config.width}x${config.height} pixels (${config.label} format)`

    // Build content parts
    const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
      { text: promptText },
    ]

    if (logoBuffer) {
      parts.push({
        inlineData: { mimeType: 'image/png', data: logoBuffer.toString('base64') },
      })
    }

    const response = await genai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: [{ role: 'user', parts }],
      config: {
        responseFormat: {
          image: {
            aspectRatio: config.aspectRatio,
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

  // Deduct 1 credit per size generated
  if (results.length > 0) {
    const deducted = await deductCredits(admin, user.id, results.length)
    if (!deducted) {
      console.log(`[generate-flyer] Warning: insufficient credits for user ${user.id}`)
    }
    console.log(`[generate-flyer] Deducted ${results.length} credits for ${results.length} flyer(s)`)
  }

  // Log each flyer to unified creations table (non-blocking)
  for (const r of results) {
    await admin.from('creations').insert({
      user_id: user.id,
      type: 'flyer',
      title: eventName + ' - ' + r.label,
      thumbnail_url: r.imageUrl,
      file_url: r.imageUrl,
      credits_used: 1,
    })
  }

  return NextResponse.json({ flyers: results })
}
