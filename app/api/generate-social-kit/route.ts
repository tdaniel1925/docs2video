import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { checkCredits, deductCredits, CREDIT_COSTS } from '../../_lib/credits'
import { GoogleGenAI } from '@google/genai'

export const runtime = 'nodejs'
export const maxDuration = 300

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

interface SizeSpec {
  label: string
  width: number
  height: number
  aspect: string
}

interface PlatformSpec {
  name: string
  sizes: SizeSpec[]
}

const PLATFORMS: PlatformSpec[] = [
  { name: 'Facebook', sizes: [
    { label: 'Profile Picture', width: 176, height: 176, aspect: '1:1' },
    { label: 'Cover Photo', width: 820, height: 312, aspect: '16:9' },
    { label: 'Post', width: 1200, height: 630, aspect: '16:9' },
  ]},
  { name: 'Instagram', sizes: [
    { label: 'Profile Picture', width: 320, height: 320, aspect: '1:1' },
    { label: 'Post', width: 1080, height: 1080, aspect: '1:1' },
    { label: 'Story', width: 1080, height: 1920, aspect: '9:16' },
  ]},
  { name: 'Twitter / X', sizes: [
    { label: 'Profile Picture', width: 400, height: 400, aspect: '1:1' },
    { label: 'Header Banner', width: 1500, height: 500, aspect: '3:1' },
    { label: 'Post', width: 1600, height: 900, aspect: '16:9' },
  ]},
  { name: 'LinkedIn', sizes: [
    { label: 'Profile Picture', width: 400, height: 400, aspect: '1:1' },
    { label: 'Personal Banner', width: 1584, height: 396, aspect: '4:1' },
    { label: 'Company Banner', width: 1128, height: 191, aspect: '4:1' },
    { label: 'Post', width: 1200, height: 627, aspect: '16:9' },
  ]},
  { name: 'YouTube', sizes: [
    { label: 'Profile Picture', width: 800, height: 800, aspect: '1:1' },
    { label: 'Channel Banner', width: 2560, height: 1440, aspect: '16:9' },
    { label: 'Thumbnail', width: 1280, height: 720, aspect: '16:9' },
  ]},
  { name: 'TikTok', sizes: [
    { label: 'Profile Picture', width: 200, height: 200, aspect: '1:1' },
    { label: 'Video Cover', width: 1080, height: 1920, aspect: '9:16' },
  ]},
  { name: 'Pinterest', sizes: [
    { label: 'Profile Picture', width: 165, height: 165, aspect: '1:1' },
    { label: 'Board Cover', width: 800, height: 450, aspect: '16:9' },
    { label: 'Pin', width: 1000, height: 1500, aspect: '2:3' },
  ]},
]

type MasterType = 'landscape' | 'square' | 'vertical'

function getMasterType(size: SizeSpec): MasterType {
  const ratio = size.width / size.height
  if (ratio > 1.1) return 'landscape'
  if (ratio < 0.9) return 'vertical'
  return 'square'
}

const MASTER_CONFIG: Record<MasterType, { aspectRatio: string; description: string }> = {
  landscape: { aspectRatio: '16:9', description: 'wide landscape banner' },
  square:    { aspectRatio: '1:1',  description: 'square profile/post' },
  vertical:  { aspectRatio: '9:16', description: 'vertical story/cover' },
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const { companyName, tagline, description, primaryColor, referenceImage, styleId } = body as {
    companyName: string
    tagline?: string
    description?: string
    primaryColor?: string
    referenceImage?: string // base64 data URL or raw base64
    styleId?: string
  }

  if (!companyName?.trim()) {
    return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
  }

  const COST = CREDIT_COSTS['social-kit']
  const credit = await checkCredits(user.id, COST)
  if (!credit.allowed) {
    return NextResponse.json({ error: `Not enough credits. Need ${COST}, have ${credit.remaining}.` }, { status: 402 })
  }
  if (!(await deductCredits(user.id, COST, 'social-kit'))) {
    return NextResponse.json({ error: 'Credit deduction failed. Please try again.' }, { status: 402 })
  }

  const admin = createAdminClient()

  // Parse reference image if provided
  let refImageBuffer: Buffer | null = null
  let refImageMime = 'image/png'
  if (referenceImage) {
    try {
      if (referenceImage.startsWith('data:')) {
        const match = referenceImage.match(/^data:(image\/\w+);base64,(.+)$/)
        if (match) {
          refImageMime = match[1]
          refImageBuffer = Buffer.from(match[2], 'base64')
        }
      } else {
        refImageBuffer = Buffer.from(referenceImage, 'base64')
      }
    } catch {
      console.log('[generate-social-kit] Could not parse reference image, proceeding without it')
    }
  }

  // Generate 3 master images (landscape, square, vertical)
  const masterBuffers: Record<MasterType, Buffer | null> = {
    landscape: null,
    square: null,
    vertical: null,
  }

  const masterTypes: MasterType[] = ['landscape', 'square', 'vertical']

  for (const masterType of masterTypes) {
    const config = MASTER_CONFIG[masterType]

    const colorInstruction = primaryColor
      ? `Use ${primaryColor} as the primary brand color. Build a rich, trendy color palette around it — gradients, tints, complementary accents.`
      : 'Use a modern, trendy color palette. Think 2025 design trends — rich gradients, bold accents, layered depth.'

    // Style-specific instructions
    const STYLE_PROMPTS: Record<string, string> = {
      executive: 'Clean corporate with data visualization elements, structured grids, and metric callouts.',
      luxury: 'Premium dark theme with gold/metallic accents, elegant typography, sophisticated layering.',
      modern: 'Bold geometric shapes, vibrant gradients, dynamic asymmetric layouts.',
      editorial: 'Magazine-style with editorial typography, layered photos/textures, creative compositions.',
      minimal: 'Ultra-clean whitespace, single accent color, precise typography, breathing room.',
      creative: 'Playful, colorful, unexpected layouts with overlapping elements and creative type.',
    }
    const stylePrompt = STYLE_PROMPTS[styleId ?? ''] ?? STYLE_PROMPTS.modern

    // Safe area instructions per master type
    const SAFE_AREA_RULES: Record<MasterType, string> = {
      landscape: `SAFE AREA (CRITICAL for banners/covers):
- YouTube banners: only the center 1546x423px is visible on ALL devices. Keep ALL important text and logos in the center 60% of the image.
- Facebook covers: profile picture overlaps the bottom-left on desktop. Keep text away from bottom-left quarter.
- LinkedIn banners: very thin — keep text large (min 48pt equivalent) and vertically centered with generous padding.
- Twitter headers: profile pic overlaps bottom-left. Center all key content.
- GENERAL: Keep all text and logos at least 10% inset from ALL edges. Nothing important in the outer 10% margin.`,
      square: `SAFE AREA:
- Profile pictures get cropped to circles on most platforms. Keep the logo/icon in the center 70% of the canvas.
- Square posts: keep text away from edges — at least 8% margin on all sides.
- Instagram may crop to 4:5 in feed — keep critical elements in the center.`,
      vertical: `SAFE AREA:
- Stories: top 14% is covered by username/camera UI, bottom 20% covered by reply bar. Keep all text in the middle 66% vertically.
- TikTok: username and buttons overlay the right side and bottom. Keep text left-aligned and in the upper 60%.
- Pinterest pins: keep critical text in the top 60% since feed previews crop the bottom.`,
    }

    const promptText = `Create a TRENDY, INFOGRAPHIC-STYLE ${config.description} social media graphic.

BRAND:
- Company: "${companyName}"
${tagline ? `- Tagline: "${tagline}"` : ''}
${description ? `- About: ${description}` : ''}

${colorInstruction}

DESIGN STYLE: ${stylePrompt}

INFOGRAPHIC APPROACH:
- Design this like a professional infographic — NOT a plain banner or generic graphic
- Include visual data elements: stat callouts, icon grids, metric badges, comparison layouts, timeline elements
- Use the company info to create compelling visual content (e.g., "Est. 2020", key services as icon badges, value props as callout cards)
- Layer elements with depth: overlapping cards, subtle shadows, glassmorphism, gradient overlays
- Typography should be BOLD and trendy — mix large display text with clean body text
- Include decorative elements: abstract blobs, geometric patterns, subtle grain textures, mesh gradients
- This should look like something a top creative agency would post — not a template from Canva

${SAFE_AREA_RULES[masterType]}

STRICT RULES:
- NO human faces, NO photos of people
- NO placeholder text — use ONLY the provided company name and info
- All text must be crisp, legible, and correctly spelled
- The company name MUST be prominently featured
${tagline ? '- Include the tagline in a complementary style' : ''}
${refImageBuffer ? '- Use the provided reference image as STYLE and AESTHETIC inspiration — match its color feel, typography approach, and visual energy' : ''}
- Make it TRENDY: think 2025 design trends, not 2018 corporate clip art`

    const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
      { text: promptText },
    ]

    if (refImageBuffer) {
      parts.push({
        inlineData: { mimeType: refImageMime, data: refImageBuffer.toString('base64') },
      })
    }

    try {
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
      for (const rp of responseParts) {
        if (rp.inlineData) {
          masterBuffers[masterType] = Buffer.from(rp.inlineData.data!, 'base64')
          break
        }
      }

      if (!masterBuffers[masterType]) {
        console.log(`[generate-social-kit] Gemini did not return image for ${masterType} master`)
      }
    } catch (err) {
      console.error(`[generate-social-kit] Gemini error for ${masterType}:`, err)
    }
  }

  // Check we got at least one master
  const hasMaster = Object.values(masterBuffers).some(b => b !== null)
  if (!hasMaster) {
    return NextResponse.json(
      { error: 'Failed to generate master images. Please try again.' },
      { status: 500 }
    )
  }

  // Use Sharp to resize masters into all platform sizes
  const sharpMod = await import('sharp')
  const sharp = sharpMod.default

  const timestamp = Date.now()
  const basePath = `${user.id}/social-kit/${timestamp}`

  interface GeneratedImage {
    platform: string
    label: string
    width: number
    height: number
    imageUrl: string
  }

  const results: { platform: string; images: GeneratedImage[] }[] = []

  for (const platform of PLATFORMS) {
    const platformImages: GeneratedImage[] = []

    for (const size of platform.sizes) {
      const masterType = getMasterType(size)
      // Fall back to any available master if the preferred one failed
      const sourceBuffer = masterBuffers[masterType]
        ?? masterBuffers.landscape
        ?? masterBuffers.square
        ?? masterBuffers.vertical

      if (!sourceBuffer) continue

      try {
        const resizedBuffer = await sharp(sourceBuffer)
          .resize(size.width, size.height, { fit: 'cover', position: 'centre' })
          .png()
          .toBuffer()

        const fileName = `${platform.name.toLowerCase().replace(/[\s\/]+/g, '-')}-${size.label.toLowerCase().replace(/\s+/g, '-')}.png`
        const storagePath = `${basePath}/${fileName}`

        await admin.storage.from('videos').upload(storagePath, resizedBuffer, {
          contentType: 'image/png',
          upsert: true,
        })

        const { data: urlData } = admin.storage.from('videos').getPublicUrl(storagePath)

        platformImages.push({
          platform: platform.name,
          label: size.label,
          width: size.width,
          height: size.height,
          imageUrl: urlData.publicUrl,
        })
      } catch (err) {
        console.error(`[generate-social-kit] Sharp resize error for ${platform.name} ${size.label}:`, err)
      }
    }

    if (platformImages.length > 0) {
      results.push({ platform: platform.name, images: platformImages })
    }
  }

  // Log to creations table
  const allImages = results.flatMap(r => r.images)
  const firstImage = allImages[0]
  if (firstImage) {
    await admin.from('creations').insert({
      user_id: user.id,
      type: 'social-kit',
      title: `${companyName} - Social Media Kit`,
      thumbnail_url: firstImage.imageUrl,
      file_url: firstImage.imageUrl,
    })
  }

  return NextResponse.json({
    platforms: results,
    totalImages: allImages.length,
  })
}
