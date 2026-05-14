import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { generateStylePreviews } from '../../_lib/gemini'
import { GoogleGenAI } from '@google/genai'
import type { ExtractedPolicyData } from '../../_lib/types'
import type { ExtractedData } from '../../_lib/extract-types'

export const runtime = 'nodejs'
export const maxDuration = 120

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()

  // Simple single-preview mode: just a prompt and name
  if (body.prompt && body.name && !body.policyData) {
    try {
      const response = await genai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: `Create a professional presentation slide preview. This is a SAMPLE slide to show the visual style.

DESIGN STYLE:
${body.prompt}

Show a sample slide with:
- Title: "Quarterly Business Review"
- 3 sample bullet points about business metrics
- Clean, professional layout
- 1920x1080, landscape, 16:9
- Make it look polished and ready for a real presentation`,
        config: {
          responseFormat: { image: { aspectRatio: '16:9', imageSize: '4K' } },
        } as any,
      })
      const parts = response.candidates?.[0]?.content?.parts ?? []
      for (const part of parts) {
        if (part.inlineData) {
          return NextResponse.json({ previewUrl: `data:image/png;base64,${part.inlineData.data}` })
        }
      }
      return NextResponse.json({ previewUrl: null })
    } catch (err) {
      console.error('[style-previews] Single preview failed:', err)
      return NextResponse.json({ previewUrl: null })
    }
  }

  // Full multi-style preview mode (legacy)
  const { policyData, brandId } = body as {
    policyData: ExtractedPolicyData | ExtractedData
    brandId: string | null
  }

  let brandName: string | null = null
  let logoUrl: string | null = null
  let colors = { primary: '#1B365D', secondary: '#4A90D9', accent: '#FFB347', background: '#0a1628', text: '#FFFFFF' }

  if (brandId) {
    const { data: brand } = await supabase.from('brands').select('*').eq('id', brandId).single()
    if (brand) {
      brandName = brand.name
      logoUrl = brand.logo_url
      colors = {
        primary: brand.primary_color,
        secondary: brand.secondary_color,
        accent: brand.accent_color,
        background: brand.background_color,
        text: brand.text_color,
      }
    }
  }

  try {
    const previews = await generateStylePreviews(policyData, brandName, logoUrl, colors)
    const encoded = previews.map(p => ({
      styleId: p.styleId,
      image: `data:image/png;base64,${p.image.toString('base64')}`,
    }))
    return NextResponse.json(encoded)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate previews'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
