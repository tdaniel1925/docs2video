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

type InfographicSize = 'landscape' | 'portrait' | 'square' | 'poster' | 'wide'

const SIZE_CONFIG: Record<InfographicSize, { label: string; width: number; height: number; aspectRatio: string }> = {
  'landscape': { label: 'Landscape (16:9)',    width: 1920, height: 1080, aspectRatio: '16:9' },
  'portrait':  { label: 'Portrait (9:16)',     width: 1080, height: 1920, aspectRatio: '9:16' },
  'square':    { label: 'Square (1:1)',        width: 1080, height: 1080, aspectRatio: '1:1' },
  'poster':    { label: 'Poster (8.5x11")',    width: 2550, height: 3300, aspectRatio: '3:4' },
  'wide':      { label: 'Wide Banner (2:1)',   width: 2400, height: 1200, aspectRatio: '2:1' },
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
    title,
    subtitle,
    content,
    size,
  } = body as {
    brandId?: string
    styleId: string
    title: string
    subtitle?: string
    content: string
    size: InfographicSize
  }

  if (!styleId || !title || !content || !size) {
    return NextResponse.json({ error: 'Please provide a title, content, style, and size' }, { status: 400 })
  }

  const config = SIZE_CONFIG[size]
  if (!config) {
    return NextResponse.json({ error: 'Invalid size selected' }, { status: 400 })
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
      console.log('[generate-infographic] Could not download logo, proceeding without it')
    }
  }

  const style = SLIDE_STYLES.find(s => s.id === styleId) ?? SLIDE_STYLES[0]
  const admin = createAdminClient()
  const timestamp = Date.now()

  const hasLogo = !!(logoBuffer || logoUrl)

  const colorInstruction = logoBuffer
    ? `COLOR PALETTE:
- Extract the dominant colors from the provided logo image and use them as the PRIMARY brand colors.
- Build a FULL, RICH color palette around the logo colors.
- Derive complementary, analogous, and accent colors that harmonize with the logo.
- Use the logo's main color for headings and key elements, complementary colors for backgrounds, and accent colors for highlights.
- The infographic should feel colorful, vibrant, and professional.`
    : `BRAND COLORS (use these exact colors):
- Primary: ${colors.primary}, Secondary: ${colors.secondary}, Accent: ${colors.accent}
- Background: ${colors.background}, Text: ${colors.text}`

  const promptText = `Create a professional single-page INFOGRAPHIC. This is a data visualization — organize the content into clear sections with visual hierarchy, icons, charts, and callout numbers. Make the title the most prominent element. Organize the content into logical sections with visual separators. Use icons and simple data visualizations where appropriate. This should look like a professionally designed infographic poster — NOT a presentation slide.

DESIGN STYLE (follow the layout, typography, visual approach, and aesthetic ONLY — colors come from the brand/logo, not the style):
${style.prompt}

${colorInstruction}

Design for ${config.label} (${config.width}x${config.height} pixels).

INFOGRAPHIC CONTENT:
- TITLE (display as the LARGEST, most prominent text element): "${title}"
${subtitle ? `- SUBTITLE: "${subtitle}"` : ''}
- DATA / CONTENT TO VISUALIZE:
${content}
${brand?.name ? `- BRAND: "${brand.name}"` : ''}
${hasLogo ? '- The brand logo is provided — integrate it prominently into the infographic design.' : ''}

STRICT RULES:
- NO human faces, NO photos of people, NO realistic human figures
- NO placeholder text — use ONLY the provided content
- The title MUST be the largest and most prominent text element
- Organize data into clear, scannable sections with visual hierarchy
- Use icons, simple charts, numbered callouts, and visual separators
- All text must be crisp, legible, and correctly spelled
- Make it visually striking, professional, and informative
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
  let imageBuffer: Buffer | null = null
  for (const rp of responseParts) {
    if (rp.inlineData) {
      imageBuffer = Buffer.from(rp.inlineData.data!, 'base64')
      break
    }
  }

  if (!imageBuffer) {
    return NextResponse.json({ error: 'Failed to generate infographic image' }, { status: 500 })
  }

  // Upload to Supabase storage
  const storagePath = `${user.id}/infographics/${timestamp}/${size}.png`
  await admin.storage.from('videos').upload(storagePath, imageBuffer, { contentType: 'image/png', upsert: true })
  const { data: urlData } = admin.storage.from('videos').getPublicUrl(storagePath)

  // Deduct 1 credit
  const deducted = await deductCredits(admin, user.id, 1)
  if (!deducted) {
    console.log(`[generate-infographic] Warning: insufficient credits for user ${user.id}`)
  }
  console.log(`[generate-infographic] Deducted 1 credit for infographic`)

  // Log to unified creations table (non-blocking)
  await admin.from('creations').insert({
    user_id: user.id,
    type: 'infographic',
    title: title,
    thumbnail_url: urlData.publicUrl,
    file_url: urlData.publicUrl,
    credits_used: 1,
  })

  return NextResponse.json({
    imageUrl: urlData.publicUrl,
    width: config.width,
    height: config.height,
  })
}
