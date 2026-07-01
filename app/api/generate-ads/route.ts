import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { SLIDE_STYLES } from '../../_lib/types'
import { deductCredits } from '../../_lib/credits'
import type { Brand } from '../../_lib/types'
import type { SlideStyleId } from '../../_lib/types'

export const runtime = 'nodejs'
export const maxDuration = 300

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

type Platform = 'instagram-post' | 'instagram-story' | 'facebook-post' | 'linkedin-post' | 'youtube-thumbnail' | 'google-display'

const PLATFORM_CONFIG: Record<Platform, { label: string; width: number; height: number; aspectRatio: string }> = {
  'instagram-post':    { label: 'Instagram Post',    width: 1080, height: 1080, aspectRatio: '1:1' },
  'instagram-story':   { label: 'Instagram Story',   width: 1080, height: 1920, aspectRatio: '9:16' },
  'facebook-post':     { label: 'Facebook Post',     width: 1200, height: 1500, aspectRatio: '4:5' },
  'linkedin-post':     { label: 'LinkedIn Post',     width: 1200, height: 627,  aspectRatio: '16:9' },
  'youtube-thumbnail': { label: 'YouTube Thumbnail', width: 1280, height: 720,  aspectRatio: '16:9' },
  'google-display':    { label: 'Google Display Ad', width: 1200, height: 628,  aspectRatio: '16:9' },
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const { brandId, styleId, headline, description, ctaText, platforms, imageUrl } = body as {
    brandId: string
    styleId: string
    headline: string
    description: string
    ctaText: string
    platforms: Platform[]
    imageUrl?: string
  }

  if (!styleId || !headline || !platforms?.length) {
    return NextResponse.json({ error: 'Please fill in the headline, select a style, and at least one platform' }, { status: 400 })
  }

  // Load brand (optional)
  let brand: Brand | null = null
  if (brandId) {
    // Scope to owner (review S3): brands RLS may be off in prod — never fetch by bare id.
    const { data: brandData } = await supabase.from('brands').select('*').eq('id', brandId).eq('user_id', user.id).single()
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
      console.log('[generate-ads] Could not download logo, proceeding without it')
    }
  }

  const style = SLIDE_STYLES.find(s => s.id === styleId) ?? SLIDE_STYLES[0]
  const admin = createAdminClient()
  const timestamp = Date.now()
  const results: { platform: string; imageUrl: string; width: number; height: number }[] = []

  // Generate ad for each platform
  for (const platform of platforms) {
    const config = PLATFORM_CONFIG[platform]
    if (!config) continue

    const hasLogo = !!(logoBuffer || logoUrl)

    const colorInstruction = logoBuffer
      ? `COLOR PALETTE:
- Extract the dominant colors from the provided logo image and use them as the PRIMARY brand colors.
- Build a FULL, RICH color palette around the logo colors.
- Derive complementary, analogous, and accent colors that harmonize with the logo.
- Use the logo's main color for headings and key elements, complementary colors for backgrounds, and accent colors for highlights.
- The slide should feel colorful, vibrant, and professional.`
      : `BRAND COLORS (use these exact colors):
- Primary: ${colors.primary}, Secondary: ${colors.secondary}, Accent: ${colors.accent}
- Background: ${colors.background}, Text: ${colors.text}`

    const promptText = `Create a SOCIAL MEDIA AD image. This is NOT a presentation slide — this is a marketing advertisement.

DESIGN STYLE (follow the layout, typography, visual approach, and aesthetic ONLY — colors come from the brand/logo, not the style):
${style.prompt}

${colorInstruction}

Design for ${config.label}. This is an advertisement. Bold headline, clear call-to-action, eye-catching layout. NOT a data slide — this is marketing material.

AD CONTENT:
- HEADLINE (display large and bold): "${headline}"
- SUPPORTING TEXT: "${description}"
- CALL TO ACTION (make it stand out as a button or badge): "${ctaText}"
${brand?.name ? `- BRAND NAME: "${brand.name}"` : ''}
${hasLogo ? '- The brand logo is provided — integrate it prominently into the ad design.' : ''}
${imageUrl ? '- Include a product image area in the layout for a product/feature visual.' : ''}

STRICT RULES:
- NO human faces, NO photos of people, NO realistic human figures
- NO placeholder text — use ONLY the provided headline, description, and CTA
- The headline must be the most prominent text element
- The CTA should look like a clickable button or clear action element
- Make it visually striking and scroll-stopping
- Professional, polished, ready to publish
- All text must be crisp, legible, and correctly spelled
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
          },
        },
      } as any,
    })

    const responseParts = response.candidates?.[0]?.content?.parts ?? []
    let adBuffer: Buffer | null = null
    for (const rp of responseParts) {
      if (rp.inlineData) {
        adBuffer = Buffer.from(rp.inlineData.data!, 'base64')
        break
      }
    }

    if (!adBuffer) {
      console.log(`[generate-ads] Gemini did not return an image for ${platform}, skipping`)
      continue
    }

    // Upload to Supabase storage
    const storagePath = `${user.id}/ads/${timestamp}/${platform}.png`
    await admin.storage.from('videos').upload(storagePath, adBuffer, { contentType: 'image/png', upsert: true })
    const { data: urlData } = admin.storage.from('videos').getPublicUrl(storagePath)

    results.push({
      platform,
      imageUrl: urlData.publicUrl,
      width: config.width,
      height: config.height,
    })
  }

  // Deduct 1 credit per platform generated
  if (results.length > 0) {
    const deducted = await deductCredits(admin, user.id, results.length)
    if (!deducted) {
      console.log(`[generate-ads] Warning: insufficient credits for user ${user.id}`)
    }
    console.log(`[generate-ads] Deducted ${results.length} credits for ${results.length} ad(s)`)
  }

  return NextResponse.json({ ads: results })
}
