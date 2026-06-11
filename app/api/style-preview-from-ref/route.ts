import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { rateLimit, getRateLimitKey } from '../../_lib/rate-limit'
import { isPaidTier } from '../../_lib/subscription'
import { generateSlideFromPrompt } from '../../_lib/gemini'

export const runtime = 'nodejs'
export const maxDuration = 300

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

  try {
    // Gemini takes the reference image directly — no style-analysis step needed
    const refBuffer = Buffer.from(referenceImageBase64, 'base64')
    const styleInstruction = 'Match the visual style of the attached reference image exactly: same color palette, mood, artistic technique, and overall feeling.'

    const [coverBuf, contentBuf] = await Promise.all([
      generateSlideFromPrompt(
        `Create an illustrated scene for a video explainer. ${styleInstruction} Scene: A welcoming, establishing shot — a warm visual metaphor like opening a door, a sunrise, or a friendly guide. Rich illustrated artwork filling the entire 1920x1080 canvas. No text, no UI elements, no slide layouts — pure illustrated scene. Leave bottom 100px as a clean solid bar area for branding overlay.`,
        refBuffer
      ),
      generateSlideFromPrompt(
        `Create an illustrated scene for a video explainer. ${styleInstruction} Scene: A visual metaphor showing growth or protection — like a shield guarding a family, a tree growing strong, or a path leading to a bright future. Rich illustrated artwork filling the entire 1920x1080 canvas. No text, no UI elements, no slide layouts — pure illustrated scene. Leave bottom 100px as a clean solid bar area for branding overlay.`,
        refBuffer
      ),
    ])

    const cover = coverBuf ? `data:image/png;base64,${coverBuf.toString('base64')}` : null
    const content = contentBuf ? `data:image/png;base64,${contentBuf.toString('base64')}` : null

    return NextResponse.json({
      previews: [cover, content].filter(Boolean),
      styleDescription: 'Matched from your reference image',
    })
  } catch (err) {
    console.error('[style-preview-from-ref] Error:', err)
    const message = err instanceof Error ? err.message : 'Preview generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
