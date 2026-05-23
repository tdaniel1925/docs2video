import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { rateLimit, getRateLimitKey } from '../../_lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 300

const VIDEO_ASSEMBLY_URL = process.env.VIDEO_ASSEMBLY_URL
const VIDEO_ASSEMBLY_SECRET = (process.env.VIDEO_ASSEMBLY_SECRET || '').trim().replace(/[\r\n]/g, '')

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Rate limit: 3/day for free, unlimited for paid
  const { data: profile } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single()
  const isPaid = ['active', 'starter', 'pro', 'business', 'professional', 'enterprise', 'enterprise-plus', 'enterprise_plus'].includes(profile?.subscription_status ?? '')

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
    // Send to VPS — it handles all OpenAI calls (no Vercel timeout issues)
    const vpsRes = await fetch(`${VIDEO_ASSEMBLY_URL}/style-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-secret': VIDEO_ASSEMBLY_SECRET,
      },
      body: JSON.stringify({
        referenceImageBase64,
        userId: user.id,
      }),
      signal: AbortSignal.timeout(240000), // 4 min timeout for the VPS call
    })

    if (!vpsRes.ok) {
      const errText = await vpsRes.text().catch(() => 'Unknown error')
      console.error('[style-preview-from-ref] VPS error:', vpsRes.status, errText)
      return NextResponse.json({ error: `Style preview failed: ${errText}` }, { status: vpsRes.status })
    }

    const data = await vpsRes.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[style-preview-from-ref] Error:', err)
    const message = err instanceof Error ? err.message : 'Preview generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
