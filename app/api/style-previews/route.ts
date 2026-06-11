import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { generateStylePreviews, generateSlideFromPrompt } from '../../_lib/gemini'
import { rateLimit, getRateLimitKey } from '../../_lib/rate-limit'
import { isPaidTier } from '../../_lib/subscription'
import type { ExtractedPolicyData } from '../../_lib/types'
import type { ExtractedData } from '../../_lib/extract-types'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('subscription_status, is_admin, is_beta').eq('id', user.id).single()
  const isPaid = isPaidTier(profile?.subscription_status) || profile?.is_admin === true || profile?.is_beta === true
  if (!isPaid) {
    const rl = rateLimit(getRateLimitKey(user.id, 'style_previews'), 3, 86400000)
    if (!rl.allowed) return NextResponse.json({ error: 'Free accounts can preview 3 styles per day. Upgrade for unlimited.' }, { status: 429 })
  }

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
      // Generate 2 previews with Gemini — same engine as actual slides
      const [coverBuf, contentBuf] = await Promise.all([
        generateSlideFromPrompt(coverPrompt),
        generateSlideFromPrompt(contentPrompt),
      ])

      const coverUrl = coverBuf ? `data:image/png;base64,${coverBuf.toString('base64')}` : null
      const contentUrl = contentBuf ? `data:image/png;base64,${contentBuf.toString('base64')}` : null

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
