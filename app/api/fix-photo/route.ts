import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import sharp from 'sharp'
import { createClient } from '../../_lib/supabase/server'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gemini-3-pro-image-preview'

const FIX_PROMPTS: Record<string, string> = {
  'remove-background': 'Remove the background from this image completely. Make the background transparent or pure white. Keep the subject perfectly intact with clean edges.',
  'swap-background-office': 'Replace the background with a modern, clean professional office setting. Keep the person/subject exactly the same. Make the lighting match naturally.',
  'swap-background-studio': 'Replace the background with a clean studio backdrop (soft gradient, neutral gray/white). Keep the subject exactly the same. Professional headshot look.',
  'enhance': 'Enhance this photo: improve sharpness, fix color balance, improve lighting, increase clarity. Make it look professional. Do not change the subject or composition.',
  'headshot-pro': 'Transform this casual photo into a professional business headshot. Improve lighting to studio quality, smooth skin subtly, enhance sharpness, improve color grading. Keep the person looking natural — not over-processed.',
  'remove-objects': 'Clean up this image by removing any clutter, distracting objects, signs, or people in the background. Keep the main subject perfectly intact.',
  'brand-filter': 'Apply a subtle color grade/filter to this photo using these brand colors as the dominant tones: primary {primary}, secondary {secondary}. Keep it subtle and professional — like an Instagram filter but branded.',
  'logo-cleanup': 'Clean up this logo image. Make the lines crisp and sharp, remove any artifacts or noise, improve contrast. Output on a transparent/white background.',
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const rl = rateLimit(getRateLimitKey(user.id, 'generation'), LIMITS.generation.limit, LIMITS.generation.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
  }

  const body = await request.json()
  const { imageBase64, fixType, options } = body as {
    imageBase64: string
    fixType: string
    options?: { backgroundColor?: string; brandColors?: { primary: string; secondary: string } }
  }

  if (!imageBase64 || !fixType) {
    return NextResponse.json({ error: 'Missing image or fix type' }, { status: 400 })
  }

  if (!FIX_PROMPTS[fixType] && fixType !== 'upscale') {
    return NextResponse.json({ error: 'Invalid fix type' }, { status: 400 })
  }

  try {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')

    // Upscale uses Sharp directly — no Gemini call
    if (fixType === 'upscale') {
      const inputBuffer = Buffer.from(base64Data, 'base64')
      const metadata = await sharp(inputBuffer).metadata()
      const w = (metadata.width ?? 512) * 2
      const h = (metadata.height ?? 512) * 2
      const outputBuffer = await sharp(inputBuffer)
        .resize(w, h, { kernel: sharp.kernel.lanczos3 })
        .png()
        .toBuffer()
      const image = `data:image/png;base64,${outputBuffer.toString('base64')}`
      return NextResponse.json({ image })
    }

    // Build prompt
    let prompt = FIX_PROMPTS[fixType]
    if (fixType === 'brand-filter' && options?.brandColors) {
      prompt = prompt.replace('{primary}', options.brandColors.primary).replace('{secondary}', options.brandColors.secondary)
    }

    const response = await genai.models.generateContent({
      model: IMAGE_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'image/png', data: base64Data } },
          ],
        },
      ],
      config: { responseFormat: { image: {} } } as any,
    })

    const parts = response.candidates?.[0]?.content?.parts ?? []
    for (const part of parts) {
      if (part.inlineData) {
        const image = `data:image/png;base64,${part.inlineData.data}`
        return NextResponse.json({ image })
      }
    }

    return NextResponse.json({ error: 'No image returned from AI' }, { status: 500 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Photo fix failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
