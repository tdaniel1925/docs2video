import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { GoogleGenAI } from '@google/genai'
import { deductCredits } from '../../_lib/credits'

export const runtime = 'nodejs'
export const maxDuration = 300

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { referenceImage, instructions, outputSize } = body as {
    referenceImage: string
    instructions: string
    outputSize?: { width: number; height: number }
  }

  if (!referenceImage || !instructions) {
    return NextResponse.json({ error: 'Reference image and instructions are required' }, { status: 400 })
  }

  // Credit pre-check
  const admin = createAdminClient()
  const ok = await deductCredits(admin, user.id, 1)
  if (!ok) return NextResponse.json({ error: 'Insufficient credits (need 1)' }, { status: 403 })

  // Extract base64 data from data URL
  const base64Match = referenceImage.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!base64Match) {
    return NextResponse.json({ error: 'Invalid image data URL' }, { status: 400 })
  }
  const mimeType = `image/${base64Match[1]}`
  const base64Data = base64Match[2]

  const promptText = `You are a professional graphic designer. The user has provided a reference image and wants you to create a NEW, ORIGINAL design inspired by it.

INSTRUCTIONS FROM USER: "${instructions}"

CRITICAL RULES:
- Create a COMPLETELY NEW design that is inspired by the reference but NOT a copy
- Change the layout, typography, colors, and graphical elements enough to be original
- Apply the user's requested changes (text, dates, names, colors, etc.)
- Maintain the same general CATEGORY and PURPOSE (if it's a flyer, make a flyer; if it's a menu, make a menu)
- The result should be professional, polished, and print-ready
- DO NOT copy any copyrighted text, logos, or specific design elements from the original
- All text must be crisp and correctly spelled
- Generate the design as a complete, finished image ready for use`

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
            imageSize: outputSize ? `${outputSize.width}x${outputSize.height}` : '1024',
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

    if (!imageData) {
      return NextResponse.json({ error: 'No image was generated. Please try again.' }, { status: 500 })
    }

    // Upload to Supabase storage
    const timestamp = Date.now()
    const storagePath = `${user.id}/remixes/${timestamp}.png`
    const buffer = Buffer.from(imageData, 'base64')

    const { error: uploadError } = await admin.storage
      .from('creations')
      .upload(storagePath, buffer, {
        contentType: 'image/png',
        upsert: false,
      })

    let imageUrl: string
    if (uploadError) {
      console.error('[image-remix] Upload error:', uploadError)
      // Fall back to data URL if upload fails
      imageUrl = `data:image/png;base64,${imageData}`
    } else {
      const { data: publicUrl } = admin.storage.from('creations').getPublicUrl(storagePath)
      imageUrl = publicUrl.publicUrl
    }

    // Log creation
    try {
      await admin.from('creations').insert({
        user_id: user.id,
        type: 'remix',
        title: `Remix: ${instructions.slice(0, 80)}`,
        credits_used: 1,
      })
    } catch { /* ignore logging errors */ }

    return NextResponse.json({
      imageUrl,
      width: outputSize?.width ?? 1024,
      height: outputSize?.height ?? 1024,
    })
  } catch (err) {
    console.error('[image-remix] Generation failed:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Remix generation failed' }, { status: 500 })
  }
}
