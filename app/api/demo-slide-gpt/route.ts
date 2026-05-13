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
    logoImage?: string
    prompt: string
    companyName?: string
  }

  if (!prompt) return NextResponse.json({ error: 'Prompt required' }, { status: 400 })

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

  try {
    const input: any[] = []

    if (logoImage) {
      // Simple prompt — just like talking to ChatGPT
      const fullPrompt = companyName
        ? `Take this logo for "${companyName}" and ${prompt}`
        : `Take this logo and ${prompt}`

      input.push({
        role: 'user',
        content: [
          { type: 'input_text', text: fullPrompt },
          { type: 'input_image', image_url: logoImage },
        ],
      })
    } else {
      input.push({
        role: 'user',
        content: [
          { type: 'input_text', text: prompt },
        ],
      })
    }

    console.log('[demo-slide-gpt] Generating with GPT-4o...')

    const response = await openai.responses.create({
      model: 'gpt-4.1',
      input,
      tools: [{ type: 'image_generation', model: 'gpt-image-2', size: '2048x1536', quality: 'high' } as any],
    })

    // Extract the generated image
    let imageBase64: string | null = null
    for (const output of response.output) {
      if (output.type === 'image_generation_call') {
        imageBase64 = (output as any).result
        break
      }
    }

    if (!imageBase64) {
      // Check if there's text output explaining why
      let textOutput = ''
      for (const output of response.output) {
        if (output.type === 'message') {
          for (const c of (output as any).content ?? []) {
            if (c.type === 'output_text') textOutput += c.text
          }
        }
      }
      return NextResponse.json({ error: textOutput || 'No image generated. Try a different prompt.' }, { status: 500 })
    }

    return NextResponse.json({
      image: `data:image/png;base64,${imageBase64}`,
    })
  } catch (err) {
    console.error('[demo-slide-gpt] Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Generation failed' }, { status: 500 })
  }
}
