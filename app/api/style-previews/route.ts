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
    const coverPrompt = `Create an illustrated scene for a video explainer, 1920x1088 pixels.

ILLUSTRATION STYLE:
${body.prompt}

Scene: A welcoming, establishing shot that introduces the topic. Show a warm, inviting visual metaphor — like opening a door to reveal something wonderful, a sunrise over a hopeful landscape, or a friendly guide welcoming the viewer into a story. Rich illustrated artwork filling the entire canvas. No text, no UI elements, no slide layouts, no logos — pure illustrated scene. Leave bottom 100px as a clean solid bar area for branding overlay.`

    const contentPrompt = `Create an illustrated scene for a video explainer, 1920x1088 pixels.

ILLUSTRATION STYLE:
${body.prompt}

Scene: A visual metaphor showing growth, progress, or achievement — like a tree growing strong with deep roots, a shield protecting what matters most, or a path leading toward a bright future. Rich illustrated artwork filling the entire canvas. No text, no UI elements, no slide layouts, no logos — pure illustrated scene. Leave bottom 100px as a clean solid bar area for branding overlay.`

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
