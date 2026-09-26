import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { GoogleGenAI } from '@google/genai'
import { CREDIT_COSTS } from '../../_lib/credits'
import { runCharged } from '../../_lib/credit-charge'

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

  // Extract base64 data from data URL (before charging — a bad upload is free)
  const base64Match = referenceImage.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!base64Match) {
    return NextResponse.json({ error: 'Invalid image data URL' }, { status: 400 })
  }
  const admin = createAdminClient()
  const COST = CREDIT_COSTS['image-remix']
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

  // Charge the real price (this used to take 1 credit for a full image
  // generation) BEFORE the work, and refund if it fails (audit H5).
  return runCharged({ userId: user.id, amount: COST, action: 'image-remix' }, async () => {
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
        credits_used: COST,
      })
    } catch { /* ignore logging errors */ }

    return NextResponse.json({
      imageUrl,
      width: outputSize?.width ?? 1024,
      height: outputSize?.height ?? 1024,
    })
  } catch (err) {
    console.error('[image-remix] Generation failed:', err)
    return NextResponse.json({ error: 'Remix generation failed. Your credits were returned — please try again.' }, { status: 500 })
  }
  })
}
