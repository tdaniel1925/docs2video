import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { generateStylePreviews } from '../../_lib/gemini'
import OpenAI from 'openai'
import type { ExtractedPolicyData } from '../../_lib/types'
import type { ExtractedData } from '../../_lib/extract-types'

export const runtime = 'nodejs'
export const maxDuration = 120

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()

  // Simple preview mode: generate cover + content sample slides
  if (body.prompt && body.name && !body.policyData) {
    const coverPrompt = `Create a professional COVER/TITLE slide for a presentation. This is a SAMPLE slide to show the visual style.

DESIGN STYLE:
${body.prompt}

Show a cover slide with:
- Large title: "Quarterly Business Review"
- Subtitle: "Q2 2025 Performance Summary"
- Company branding area
- Clean, bold, professional title layout
- 1920x1080, landscape, 16:9
- Make it look polished — this is the first slide the audience sees`

    const contentPrompt = `Create a professional CONTENT slide for a presentation. This is a SAMPLE slide to show the visual style.

DESIGN STYLE:
${body.prompt}

Show a content slide with:
- Title: "Revenue Growth"
- 3 key metrics: "$2.4M Revenue (+18%)", "1,240 New Clients", "94% Retention Rate"
- 2-3 bullet points explaining the data
- Clean, professional data layout
- 1920x1080, landscape, 16:9
- Make it look polished and ready for a real presentation`

    try {
      const [coverRes, contentRes] = await Promise.all([
        openai.images.generate({
          model: 'gpt-image-2',
          prompt: coverPrompt + '\nGlossy, polished finish — subtle glass reflections, soft glows, depth with layered shadows.',
          size: '1920x1088',
          quality: 'high',
          n: 1,
        }),
        openai.images.generate({
          model: 'gpt-image-2',
          prompt: contentPrompt + '\nGlossy, polished finish — subtle glass reflections, soft glows, depth with layered shadows.',
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
