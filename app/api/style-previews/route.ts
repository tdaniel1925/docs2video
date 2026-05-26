import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { generateStylePreviews } from '../../_lib/gemini'
import OpenAI from 'openai'
import type { ExtractedPolicyData } from '../../_lib/types'
import type { ExtractedData } from '../../_lib/extract-types'

export const runtime = 'nodejs'
export const maxDuration = 300

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()

  // Simple preview mode: generate cover + content sample slides
  if (body.prompt && body.name && !body.policyData) {
    const coverPrompt = `Create a professional COVER/TITLE slide for a presentation, 1920x1088 pixels.

DESIGN STYLE:
${body.prompt}
Glossy, polished finish — subtle glass reflections, soft glows, depth with layered shadows.

Show a cover slide with:
- Large title: "Quarterly Business Review"
- Subtitle: "Q2 2025 Performance Summary"
- Do NOT include any logo, company name, or brand mark — leave the top-right corner empty
- Clean, bold layout with the style described above
- 80px padding on all edges`

    const contentPrompt = `Create a professional CONTENT slide for a presentation, 1920x1088 pixels.

DESIGN STYLE:
${body.prompt}
Glossy, polished finish — subtle glass reflections, soft glows, depth with layered shadows.

Show a content slide with:
- Title: "Revenue Growth"
- 3 key metrics: "$2.4M Revenue (+18%)", "1,240 New Clients", "94% Retention Rate"
- 2-3 bullet points explaining the data
- Do NOT include any logo, company name, or brand mark — leave the top-right corner empty
- Clean, professional data layout with the style described above
- 80px padding on all edges`

    try {
      // Generate 2 previews with OpenAI — same engine as actual slides
      const [coverRes, contentRes] = await Promise.all([
        openai.images.generate({
          model: 'gpt-image-2',
          prompt: coverPrompt,
          size: '1920x1088',
          quality: 'high',
          n: 1,
        }),
        openai.images.generate({
          model: 'gpt-image-2',
          prompt: contentPrompt,
          size: '1920x1088',
          quality: 'high',
          n: 1,
        }),
      ])

      const coverUrl = coverRes.data?.[0]?.b64_json ? `data:image/png;base64,${coverRes.data[0].b64_json}` : null
      const contentUrl = contentRes.data?.[0]?.b64_json ? `data:image/png;base64,${contentRes.data[0].b64_json}` : null

      return NextResponse.json({
        previewUrl: coverUrl,
        previewUrls: [coverUrl, contentUrl].filter(Boolean),
      })
    } catch (err) {
      console.error('[style-previews] Preview generation failed:', err)
      return NextResponse.json({ previewUrl: null, previewUrls: [] })
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
