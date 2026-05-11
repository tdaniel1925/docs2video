import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { createClient } from '../../../_lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { currentPrompt, feedback } = body as { currentPrompt: string; feedback: string }

  try {
    // Refine the prompt based on feedback
    const refineResponse = await genai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: `You are a presentation designer. Here is the current style prompt for a slide template:

"${currentPrompt}"

The user wants this change: "${feedback}"

Return ONLY the updated style prompt incorporating their feedback. Keep it in the same detailed format with specific hex colors, typography, layout details. Don't explain — just return the new prompt.`,
    })

    const updatedPrompt = refineResponse.text?.trim() ?? currentPrompt

    // Generate a new preview
    const response = await genai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: `Create a professional presentation slide showing "Policy Overview" with sample data: Death Benefit $500,000, Annual Premium $5,000, Cash Value Growth chart. Style: ${updatedPrompt}. MUST be exactly 1920x1080 16:9 landscape. Fill entire canvas. DO NOT create any logos or human faces.`,
      config: {
        responseFormat: { image: { aspectRatio: '16:9', imageSize: '4K' } },
      } as any,
    })

    let preview = ''
    const parts = response.candidates?.[0]?.content?.parts ?? []
    for (const part of parts) {
      if (part.inlineData) {
        preview = `data:image/png;base64,${part.inlineData.data}`
        break
      }
    }

    return NextResponse.json({ prompt: updatedPrompt, preview })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to refine'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
