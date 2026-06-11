import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { rateLimit, getRateLimitKey } from '../../_lib/rate-limit'
import { isPaidTier } from '../../_lib/subscription'

export const runtime = 'nodejs'
export const maxDuration = 300

const VIDEO_ASSEMBLY_URL = process.env.VIDEO_ASSEMBLY_URL
const VIDEO_ASSEMBLY_SECRET = (process.env.VIDEO_ASSEMBLY_SECRET || '').trim().replace(/[\r\n]/g, '')

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Rate limit: 3/day for free, unlimited for paid
  const { data: profile } = await supabase.from('profiles').select('subscription_status, is_admin, is_beta').eq('id', user.id).single()
  const isPaid = isPaidTier(profile?.subscription_status) || profile?.is_admin === true || profile?.is_beta === true

  if (!isPaid) {
    const rl = rateLimit(getRateLimitKey(user.id, 'style_preview'), 3, 86400000)
    if (!rl.allowed) return NextResponse.json({ error: 'Free accounts can preview 3 styles per day. Upgrade for unlimited.' }, { status: 429 })
  }

  const body = await request.json()
  const { referenceImageBase64 } = body as { referenceImageBase64: string }

  if (!referenceImageBase64) return NextResponse.json({ error: 'No reference image provided' }, { status: 400 })

  if (!VIDEO_ASSEMBLY_URL) {
    return NextResponse.json({ error: 'Video server not configured' }, { status: 500 })
  }

  try {
    // Generate illustrated previews directly via OpenAI
    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    // First, analyze the reference image style
    const analysisRes = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Describe the visual style of this image in 2-3 sentences. Focus on: color palette, mood, artistic technique (watercolor, flat vector, cinematic, etc.), and overall feeling. Be specific about colors.' },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${referenceImageBase64}` } },
        ],
      }],
      max_tokens: 200,
    })
    const styleDesc = analysisRes.choices[0]?.message?.content || 'Professional, modern illustration style'

    const [coverRes, contentRes] = await Promise.all([
      openai.images.generate({
        model: 'gpt-image-2',
        prompt: `Create an illustrated scene for a video explainer in this exact style: ${styleDesc}. Scene: A welcoming, establishing shot — a warm visual metaphor like opening a door, a sunrise, or a friendly guide. Rich illustrated artwork filling the entire 1920x1080 canvas. No text, no UI elements, no slide layouts — pure illustrated scene. Leave bottom 100px as a clean solid bar area for branding overlay.`,
        size: '1536x1024',
        quality: 'high',
        n: 1,
      }),
      openai.images.generate({
        model: 'gpt-image-2',
        prompt: `Create an illustrated scene for a video explainer in this exact style: ${styleDesc}. Scene: A visual metaphor showing growth or protection — like a shield guarding a family, a tree growing strong, or a path leading to a bright future. Rich illustrated artwork filling the entire 1920x1080 canvas. No text, no UI elements, no slide layouts — pure illustrated scene. Leave bottom 100px as a clean solid bar area for branding overlay.`,
        size: '1536x1024',
        quality: 'high',
        n: 1,
      }),
    ])

    const cover = coverRes.data?.[0]?.b64_json ? `data:image/png;base64,${coverRes.data[0].b64_json}` : null
    const content = contentRes.data?.[0]?.b64_json ? `data:image/png;base64,${contentRes.data[0].b64_json}` : null

    return NextResponse.json({
      previews: [cover, content].filter(Boolean),
      styleDescription: styleDesc,
    })
  } catch (err) {
    console.error('[style-preview-from-ref] Error:', err)
    const message = err instanceof Error ? err.message : 'Preview generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
