import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { createClient } from '../../../_lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 120

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { description, referenceImageBase64 } = body as {
    description: string
    referenceImageBase64?: string
  }

  try {
    // Step 1: Generate a detailed style prompt from the description
    const promptParts: any[] = [
      { text: `You are an expert presentation designer. A user wants a custom slide template style. Based on their description, create a detailed visual style prompt that can be used to generate consistent presentation slides.

User's description: "${description}"

${referenceImageBase64 ? 'They also provided a reference image — analyze its visual style (colors, typography, layout, spacing, mood) and incorporate those elements.' : ''}

Return ONLY a detailed style prompt (no JSON, no markdown). The prompt should describe:
- Background color/gradient (use specific hex codes)
- Text color and typography style
- Accent colors (specific hex codes)
- Layout style (grid, centered, asymmetric)
- Card/container styles
- Overall mood and feel
- Border styles
- Spacing philosophy

Example output format:
"Sleek midnight design with deep navy background (#0A1628), clean white text, electric blue (#2563EB) accent lines, glass-morphism cards with frosted white borders, modern sans-serif typography, generous spacing, subtle gradient overlays. Feels premium, tech-forward, and authoritative."` },
    ]

    if (referenceImageBase64) {
      promptParts.push({
        inlineData: { mimeType: 'image/png', data: referenceImageBase64 },
      })
    }

    const promptResponse = await genai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [{ role: 'user', parts: promptParts }],
    })

    const stylePrompt = promptResponse.text?.trim() ?? description

    // Step 2: Generate 4 preview slides with this style
    const previews: string[] = []
    const variations = [
      'a title slide showing "Policy Overview" with key summary data',
      'a data slide showing "Death Benefit: $500,000" and "Annual Premium: $5,000" prominently',
      'a chart slide showing cash value growth over years 5, 10, 15, 20, 25, 30',
      'a summary slide with key takeaways and a call-to-action section',
    ]

    for (const variation of variations) {
      try {
        const response = await genai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: `Create a professional presentation slide: ${variation}. Style: ${stylePrompt}. MUST be exactly 1920x1080 16:9 landscape. Fill entire canvas. DO NOT create any logos. DO NOT draw any human faces.`,
          config: {
            responseFormat: { image: { aspectRatio: '16:9', imageSize: '4K' } },
          } as any,
        })

        const parts = response.candidates?.[0]?.content?.parts ?? []
        for (const part of parts) {
          if (part.inlineData) {
            previews.push(`data:image/png;base64,${part.inlineData.data}`)
            break
          }
        }
      } catch (err) {
        console.error('Preview generation failed:', err)
      }
    }

    return NextResponse.json({ prompt: stylePrompt, previews })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate previews'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
