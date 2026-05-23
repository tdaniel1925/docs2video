import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import OpenAI from 'openai'
import { rateLimit, getRateLimitKey } from '../../_lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Rate limit: 3/day for free, unlimited for paid
  const { data: profile } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single()
  const isPaid = ['active', 'starter', 'pro', 'business', 'professional', 'enterprise', 'enterprise-plus', 'enterprise_plus'].includes(profile?.subscription_status ?? '')

  if (!isPaid) {
    const rl = rateLimit(getRateLimitKey(user.id, 'style_preview'), 3, 86400000) // 3 per day
    if (!rl.allowed) return NextResponse.json({ error: 'Free accounts can preview 3 styles per day. Upgrade for unlimited.' }, { status: 429 })
  }

  const body = await request.json()
  const { referenceImageBase64 } = body as { referenceImageBase64: string }

  if (!referenceImageBase64) return NextResponse.json({ error: 'No reference image provided' }, { status: 400 })

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

    // First, analyze the reference image to extract a style description
    const analysisRes = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/png;base64,${referenceImageBase64}` } },
          { type: 'text', text: 'Describe this image\'s visual style in detail for recreating it: colors (specific hex codes), typography style, layout approach, textures, decorative elements, mood, spacing. Be very specific. 2-4 sentences.' },
        ],
      }],
      max_tokens: 300,
    })
    const styleDescription = analysisRes.choices[0]?.message?.content ?? 'Professional modern design'

    // Generate both slides in parallel for speed
    const [coverRes, contentRes] = await Promise.all([
      openai.images.generate({
        model: 'gpt-image-2',
        prompt: `Create a presentation COVER slide in this EXACT visual style: ${styleDescription}

Content: Title "Quarterly Business Review", subtitle "Q2 2025 Performance Summary", small text "Prepared by Anderson Financial Group".

1920x1080 landscape. Fill entire canvas edge to edge. No logos.`,
        size: '1536x1024',
        quality: 'high',
        n: 1,
      }),
      openai.images.generate({
        model: 'gpt-image-2',
        prompt: `Create a presentation CONTENT slide in this EXACT visual style: ${styleDescription}

Content: Title "KEY METRICS". Three data card sections: Revenue $2.4M (+18%), New Clients 1,240, Retention Rate 94%. Below: Growth Drivers heading with 3 bullet points.

1920x1080 landscape. Fill entire canvas edge to edge. No logos.`,
        size: '1536x1024',
        quality: 'high',
        n: 1,
      }),
    ])

    const coverImage = coverRes.data?.[0]?.b64_json ? `data:image/png;base64,${coverRes.data[0].b64_json}` : null
    const contentImage = contentRes.data?.[0]?.b64_json ? `data:image/png;base64,${contentRes.data[0].b64_json}` : null

    // Save the reference image to Supabase Storage for reuse
    const admin = createAdminClient()
    const refId = crypto.randomUUID()
    const storagePath = `${user.id}/style-refs/${refId}.png`
    await admin.storage.from('logos').upload(storagePath, Buffer.from(referenceImageBase64, 'base64'), { contentType: 'image/png', upsert: true })
    const { data: refUrl } = admin.storage.from('logos').getPublicUrl(storagePath)

    return NextResponse.json({
      previews: [coverImage, contentImage].filter(Boolean),
      referenceUrl: refUrl.publicUrl,
    })
  } catch (err) {
    console.error('[style-preview-from-ref] Error:', err)
    const message = err instanceof Error ? err.message : 'Preview generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
