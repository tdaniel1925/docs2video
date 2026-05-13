import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { GoogleGenAI } from '@google/genai'

export const runtime = 'nodejs'
export const maxDuration = 300

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const VARIATION_BATCHES = [
  // Batch 1: Corporate
  [
    { style: 'Corporate', description: 'Professional corporate headshot, navy blue studio background, soft lighting, wearing a dark suit' },
    { style: 'Corporate', description: 'Executive headshot, gray gradient background, confident pose, business attire' },
    { style: 'Corporate', description: 'LinkedIn-style headshot, clean white background, friendly smile, professional lighting' },
    { style: 'Corporate', description: 'Modern corporate, blurred office background, natural lighting, business casual' },
    { style: 'Corporate', description: 'Formal headshot, dark charcoal background, studio lighting, professional attire' },
  ],
  // Batch 2: Creative
  [
    { style: 'Creative', description: 'Creative professional headshot, colorful abstract background, artistic lighting' },
    { style: 'Creative', description: 'Startup founder headshot, modern minimalist background, relaxed confident pose' },
    { style: 'Creative', description: 'Tech professional headshot, subtle neon accent lighting, dark background' },
    { style: 'Creative', description: 'Editorial style headshot, dramatic side lighting, cinematic mood' },
    { style: 'Creative', description: 'Designer headshot, clean white with geometric accent shapes' },
  ],
  // Batch 3: Outdoor/Natural
  [
    { style: 'Outdoor', description: 'Professional outdoor headshot, blurred park background, golden hour lighting' },
    { style: 'Outdoor', description: 'Urban professional headshot, blurred city skyline background, natural light' },
    { style: 'Outdoor', description: 'Warm professional headshot, autumn foliage background, soft natural lighting' },
    { style: 'Outdoor', description: 'Modern headshot, architectural background, clean lines, natural light' },
    { style: 'Outdoor', description: 'Rooftop professional headshot, sky background, bright and airy' },
  ],
  // Batch 4: Premium
  [
    { style: 'Premium', description: 'Magazine cover style headshot, dramatic lighting, high contrast' },
    { style: 'Premium', description: 'Luxury portrait, rich dark background, Rembrandt lighting' },
    { style: 'Premium', description: 'High fashion professional headshot, clean editorial style' },
    { style: 'Premium', description: 'CEO portrait, power pose, prestigious office background' },
    { style: 'Premium', description: 'Author headshot, warm bookshelf background, approachable smile' },
  ],
]

async function generateVariation(
  mimeType: string,
  base64Data: string,
  variation: { style: string; description: string },
): Promise<{ imageData: string | null; style: string; description: string }> {
  const promptText = `Transform this casual photo into a professional headshot. Keep the person's face, features, and identity EXACTLY the same. Only change the background, lighting, angle, and attire. ${variation.description}. Output a high-quality portrait photograph, shoulders and head visible, looking at camera.`

  try {
    const response = await genai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: [{
        role: 'user',
        parts: [
          { text: promptText },
          { inlineData: { mimeType, data: base64Data } },
        ],
      }],
      config: {
        responseFormat: {
          image: {
            imageSize: '1024',
            aspectRatio: '1:1',
          },
        },
      } as any,
    })

    const responseParts = response.candidates?.[0]?.content?.parts ?? []
    let imageData: string | null = null
    for (const rp of responseParts) {
      if (rp.inlineData) {
        imageData = rp.inlineData.data ?? null
        break
      }
    }
    return { imageData, style: variation.style, description: variation.description }
  } catch (err) {
    console.error(`[generate-headshot] Variation failed (${variation.style}):`, err)
    return { imageData: null, style: variation.style, description: variation.description }
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { photo, name } = body as { photo: string; name?: string }

  if (!photo) {
    return NextResponse.json({ error: 'Photo is required' }, { status: 400 })
  }

  // Extract base64 data from data URL
  const base64Match = photo.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!base64Match) {
    return NextResponse.json({ error: 'Invalid image data URL' }, { status: 400 })
  }
  const mimeType = `image/${base64Match[1]}`
  const base64Data = base64Match[2]

  const admin = createAdminClient()
  const timestamp = Date.now()

  try {
    // Generate all 20 variations in 4 parallel batches of 5
    const batchResults = await Promise.all(
      VARIATION_BATCHES.map(batch =>
        Promise.all(batch.map(v => generateVariation(mimeType, base64Data, v)))
      )
    )

    const allResults = batchResults.flat()
    const images: { url: string; style: string; description: string }[] = []

    // Upload each successful result to Supabase storage
    for (let i = 0; i < allResults.length; i++) {
      const result = allResults[i]
      if (!result.imageData) continue

      const storagePath = `${user.id}/headshots/${timestamp}/variant_${i}.png`
      const buffer = Buffer.from(result.imageData, 'base64')

      const { error: uploadError } = await admin.storage
        .from('creations')
        .upload(storagePath, buffer, {
          contentType: 'image/png',
          upsert: false,
        })

      if (uploadError) {
        console.error(`[generate-headshot] Upload error for variant ${i}:`, uploadError)
        // Fall back to data URL
        images.push({
          url: `data:image/png;base64,${result.imageData}`,
          style: result.style,
          description: result.description,
        })
      } else {
        const { data: publicUrl } = admin.storage.from('creations').getPublicUrl(storagePath)
        images.push({
          url: publicUrl.publicUrl,
          style: result.style,
          description: result.description,
        })
      }
    }

    if (images.length === 0) {
      return NextResponse.json({ error: 'All headshot generations failed. Please try again.' }, { status: 500 })
    }

    // Log to creations table
    try {
      await admin.from('creations').insert({
        user_id: user.id,
        type: 'headshot',
        title: name ? `${name} — AI Headshots` : 'AI Headshots',
        thumbnail_url: images[0].url,
        file_url: images[0].url,
        credits_used: 1,
      })
    } catch { /* ignore logging errors */ }

    return NextResponse.json({ images })
  } catch (err) {
    console.error('[generate-headshot] Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Headshot generation failed' }, { status: 500 })
  }
}
