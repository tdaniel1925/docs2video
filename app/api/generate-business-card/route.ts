import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { checkCredits, deductCredits, CREDIT_COSTS } from '../../_lib/credits'
import { SLIDE_STYLES } from '../../_lib/types'
import type { Brand } from '../../_lib/types'

export const runtime = 'nodejs'
export const maxDuration = 300

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

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
    fullName,
    title,
    company,
    phone,
    email,
    website,
    address,
    tagline,
    withBleeds,
  } = body as {
    brandId?: string
    styleId: string
    fullName: string
    title?: string
    company?: string
    phone?: string
    email?: string
    website?: string
    address?: string
    tagline?: string
    withBleeds?: boolean
  }

  // Print-ready dimensions at 300 DPI
  // With bleeds: 3.625 x 2.125 inches = 1088 x 638 pixels
  // Without bleeds: 3.5 x 2.0 inches = 1050 x 600 pixels
  const cardWidth = withBleeds ? 1088 : 1050
  const cardHeight = withBleeds ? 638 : 600
  const cardInches = withBleeds ? '3.625 x 2.125' : '3.5 x 2.0'
  const bleedNote = withBleeds
    ? 'This card includes 0.0625 inch (1/16") bleeds on all sides. Keep important content 0.125 inches from the trim edge.'
    : ''

  if (!styleId || !fullName?.trim()) {
    return NextResponse.json({ error: 'Please provide a name and select a style' }, { status: 400 })
  }

  // Charge credits after validation, before any paid image generation
  // (admin/beta bypass handled inside deductCredits).
  const COST = CREDIT_COSTS['business-card']
  const credit = await checkCredits(user.id, COST)
  if (!credit.allowed) {
    return NextResponse.json({ error: `Not enough credits. Need ${COST}, have ${credit.remaining}.` }, { status: 402 })
  }
  if (!(await deductCredits(user.id, COST, 'business-card'))) {
    return NextResponse.json({ error: 'Credit deduction failed. Please try again.' }, { status: 402 })
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
      console.log('[generate-business-card] Could not download logo, proceeding without it')
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
- The card should feel colorful, vibrant, and professional.`
    : `BRAND COLORS (use these exact colors):
- Primary: ${colors.primary}, Secondary: ${colors.secondary}, Accent: ${colors.accent}
- Background: ${colors.background}, Text: ${colors.text}`

  // Build contact details block for back
  const contactLines: string[] = []
  if (phone) contactLines.push(`- PHONE: "${phone}"`)
  if (email) contactLines.push(`- EMAIL: "${email}"`)
  if (website) contactLines.push(`- WEBSITE: "${website}"`)
  if (address) contactLines.push(`- ADDRESS: "${address}"`)
  if (tagline) contactLines.push(`- TAGLINE: "${tagline}"`)

  // --- FRONT ---
  const frontPrompt = `Create a professional BUSINESS CARD FRONT for high-quality print at 300 DPI. The person's name should be the largest text. Job title below. Company name prominent. Clean, elegant, premium. NOT a flyer or poster — this is a small ${cardInches} inch card. Less is more. Generous white space.
${bleedNote}

DESIGN STYLE (follow the layout, typography, visual approach, and aesthetic ONLY — colors come from the brand/logo, not the style):
${style.prompt}

${colorInstruction}

Design for Business Card Front (${cardWidth}x${cardHeight} pixels, landscape ${cardInches} inches at 300 DPI).

CARD CONTENT:
- FULL NAME (display as the LARGEST, most prominent text element): "${fullName}"
${title ? `- JOB TITLE: "${title}"` : ''}
${company ? `- COMPANY: "${company}"` : ''}
${brand?.name && brand.name !== company ? `- BRAND: "${brand.name}"` : ''}
${hasLogo ? '- The brand logo is provided — integrate it prominently into the card design.' : ''}

STRICT RULES:
- NO human faces, NO photos of people, NO realistic human figures
- NO placeholder text — use ONLY the provided details
- The person's name MUST be the largest and most prominent text element
- All text must be crisp, legible, and correctly spelled at 300 DPI print resolution
- Clean, minimal, premium feel — this is a SMALL card, not a poster
- Professional, polished, ready to print
${hasLogo ? '- Integrate the provided logo naturally into the design' : ''}
- Design dimensions: ${cardWidth}x${cardHeight} pixels (Business Card Front at 300 DPI)`

  const frontParts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
    { text: frontPrompt },
  ]
  if (logoBuffer) {
    frontParts.push({
      inlineData: { mimeType: 'image/png', data: logoBuffer.toString('base64') },
    })
  }

  const frontResponse = await genai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: [{ role: 'user', parts: frontParts }],
    config: {
      responseFormat: {
        image: {
          aspectRatio: '16:9',
          imageSize: '4K',
        },
      },
    } as any,
  })

  const frontResponseParts = frontResponse.candidates?.[0]?.content?.parts ?? []
  let frontBuffer: Buffer | null = null
  for (const rp of frontResponseParts) {
    if (rp.inlineData) {
      frontBuffer = Buffer.from(rp.inlineData.data!, 'base64')
      break
    }
  }

  if (!frontBuffer) {
    return NextResponse.json({ error: 'Failed to generate business card front' }, { status: 500 })
  }

  // Resize to exact print dimensions at 300 DPI using Sharp
  const sharpMod = await import('sharp')
  const sharp = sharpMod.default ?? sharpMod
  frontBuffer = await sharp(frontBuffer)
    .resize(cardWidth, cardHeight, { fit: 'cover' })
    .withMetadata({ density: 300 })
    .png({ quality: 100 })
    .toBuffer()

  // Upload front
  const frontPath = `${user.id}/business-cards/${timestamp}/front.png`
  await admin.storage.from('videos').upload(frontPath, frontBuffer, { contentType: 'image/png', upsert: true })
  const { data: frontUrlData } = admin.storage.from('videos').getPublicUrl(frontPath)

  // --- BACK ---
  const backPrompt = `Create a professional BUSINESS CARD BACK for high-quality print at 300 DPI. This is the reverse side of a business card. Display all contact information in a clean, organized layout: phone, email, website, address. Company logo should be featured. Include tagline if provided. Clean, readable, organized. NOT a flyer — this is a small ${cardInches} inch card.
${bleedNote}

DESIGN STYLE (follow the layout, typography, visual approach, and aesthetic ONLY — colors come from the brand/logo, not the style):
${style.prompt}

${colorInstruction}

Design for Business Card Back (${cardWidth}x${cardHeight} pixels, landscape ${cardInches} inches at 300 DPI).

CARD CONTENT:
- NAME: "${fullName}"
${title ? `- JOB TITLE: "${title}"` : ''}
${company ? `- COMPANY: "${company}"` : ''}
${contactLines.join('\n')}
${brand?.name && brand.name !== company ? `- BRAND: "${brand.name}"` : ''}
${hasLogo ? '- The brand logo is provided — feature it prominently on the back.' : ''}

STRICT RULES:
- NO human faces, NO photos of people, NO realistic human figures
- NO placeholder text — use ONLY the provided details
- Contact information must be clearly readable and well-organized
- All text must be crisp, legible, and correctly spelled at 300 DPI print resolution
- Clean, minimal, premium feel — this is a SMALL card, not a poster
- Professional, polished, ready to print
${hasLogo ? '- Feature the provided logo prominently' : ''}
- Design dimensions: ${cardWidth}x${cardHeight} pixels (Business Card Back at 300 DPI)`

  const backParts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
    { text: backPrompt },
  ]
  if (logoBuffer) {
    backParts.push({
      inlineData: { mimeType: 'image/png', data: logoBuffer.toString('base64') },
    })
  }

  const backResponse = await genai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: [{ role: 'user', parts: backParts }],
    config: {
      responseFormat: {
        image: {
          aspectRatio: '16:9',
          imageSize: '4K',
        },
      },
    } as any,
  })

  const backResponseParts = backResponse.candidates?.[0]?.content?.parts ?? []
  let backBuffer: Buffer | null = null
  for (const rp of backResponseParts) {
    if (rp.inlineData) {
      backBuffer = Buffer.from(rp.inlineData.data!, 'base64')
      break
    }
  }

  if (!backBuffer) {
    return NextResponse.json({ error: 'Failed to generate business card back' }, { status: 500 })
  }

  // Resize to exact print dimensions at 300 DPI
  backBuffer = await sharp(backBuffer)
    .resize(cardWidth, cardHeight, { fit: 'cover' })
    .withMetadata({ density: 300 })
    .png({ quality: 100 })
    .toBuffer()

  // Upload back
  const backPath = `${user.id}/business-cards/${timestamp}/back.png`
  await admin.storage.from('videos').upload(backPath, backBuffer, { contentType: 'image/png', upsert: true })
  const { data: backUrlData } = admin.storage.from('videos').getPublicUrl(backPath)

  // Log to unified creations table (non-blocking)
  await admin.from('creations').insert({
    user_id: user.id,
    type: 'business-card',
    title: fullName + ' Business Card',
    thumbnail_url: frontUrlData.publicUrl,
    file_url: frontUrlData.publicUrl,
  })

  return NextResponse.json({
    front: { imageUrl: frontUrlData.publicUrl, width: cardWidth, height: cardHeight },
    back: { imageUrl: backUrlData.publicUrl, width: cardWidth, height: cardHeight },
    withBleeds: !!withBleeds,
    dpi: 300,
    dimensions: cardInches,
  })
}
