import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import OpenAI from 'openai'
import { rateLimit, getRateLimitKey } from '../../_lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 120

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

    // Generate cover slide
    const coverRes = await openai.images.generate({
      model: 'gpt-image-2',
      prompt: `Create a presentation COVER slide matching the reference style EXACTLY. Same colors, textures, typography treatment, layout approach, decorative elements.

Content: Title "Quarterly Business Review", subtitle "Q2 2025 Performance Summary", small text "Prepared by Anderson Financial Group".

Match the visual style of the reference image precisely — same mood, same aesthetic, same level of polish. 1920x1080 landscape. Fill entire canvas.`,
      size: '1536x1024',
      quality: 'high',
      n: 1,
    })

    // Generate content slide
    const contentRes = await openai.images.generate({
      model: 'gpt-image-2',
      prompt: `Create a presentation CONTENT slide matching the reference style EXACTLY. Same colors, textures, typography treatment, layout approach, decorative elements.

Content: Title "KEY METRICS". Three data sections: Revenue $2.4M (+18%), New Clients 1,240, Retention Rate 94%. Growth drivers: 3 bullet points.

Match the visual style of the reference image precisely — same mood, same aesthetic, same level of polish. 1920x1080 landscape. Fill entire canvas.`,
      size: '1536x1024',
      quality: 'high',
      n: 1,
    })

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
    const message = err instanceof Error ? err.message : 'Preview generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
