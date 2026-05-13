import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import OpenAI from 'openai'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { logoImage, prompt, companyName } = await request.json() as {
    logoImage?: string // base64 data URL
    prompt: string
    companyName?: string
  }

  if (!prompt) return NextResponse.json({ error: 'Prompt required' }, { status: 400 })

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

  try {
    // Build the messages array
    const messages: any[] = []

    // If logo provided, include it as an image
    if (logoImage) {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: logoImage },
          },
          {
            type: 'text',
            text: `This is the company logo${companyName ? ` for "${companyName}"` : ''}. Use this logo in the image you create.\n\n${prompt}`,
          },
        ],
      })
    } else {
      messages.push({
        role: 'user',
        content: prompt,
      })
    }

    console.log('[demo-slide-gpt] Generating with GPT-4o...')

    const response = await openai.responses.create({
      model: 'gpt-4o',
      input: messages,
      tools: [{ type: 'image_generation', size: '1536x1024', quality: 'high' }],
    })

    // Extract the generated image
    let imageBase64: string | null = null
    for (const output of response.output) {
      if (output.type === 'image_generation_call') {
        imageBase64 = output.result
        break
      }
    }

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image generated' }, { status: 500 })
    }

    return NextResponse.json({
      image: `data:image/png;base64,${imageBase64}`,
    })
  } catch (err) {
    console.error('[demo-slide-gpt] Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Generation failed' }, { status: 500 })
  }
}
