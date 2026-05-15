import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { createClient } from '../../_lib/supabase/server'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gemini-3-pro-image-preview'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const rl = rateLimit(getRateLimitKey(user.id, 'generation'), LIMITS.generation.limit, LIMITS.generation.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
  }

  const body = await request.json()
  const { currentSlideBase64, editInstruction } = body as {
    currentSlideBase64: string
    editInstruction: string
  }

  if (!currentSlideBase64 || !editInstruction) {
    return NextResponse.json({ error: 'Missing slide image or edit instruction' }, { status: 400 })
  }

  try {
    // Strip data URI prefix if present
    const base64Data = currentSlideBase64.replace(/^data:image\/\w+;base64,/, '')

    const response = await genai.models.generateContent({
      model: IMAGE_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Here is an existing presentation slide. Make the following change and return the modified slide:

EDIT INSTRUCTION: ${editInstruction}

RULES:
- Keep everything else EXACTLY the same — same layout, same data, same colors, same style
- Only modify what was specifically requested
- Output must be EXACTLY 1920x1080 pixels, 16:9 landscape
- DO NOT add any logos, brand marks, or human faces
- Maintain all text content that wasn't asked to change`,
            },
            {
              inlineData: {
                mimeType: 'image/png',
                data: base64Data,
              },
            },
          ],
        },
      ],
      config: {
        responseFormat: {
          image: {
            aspectRatio: '16:9',
            imageSize: '4K',
          },
        },
      } as any,
    })

    const parts = response.candidates?.[0]?.content?.parts ?? []
    for (const part of parts) {
      if (part.inlineData) {
        const image = `data:image/png;base64,${part.inlineData.data}`
        return NextResponse.json({ image })
      }
    }

    return NextResponse.json({ error: 'No image returned from edit' }, { status: 500 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Edit failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
