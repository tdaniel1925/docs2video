import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { buildEditorialPayload } from '../../_lib/editorial-render'
import type { Brand } from '../../_lib/types'

export const runtime = 'nodejs'
export const maxDuration = 120

const VIDEO_ASSEMBLY_URL = process.env.VIDEO_ASSEMBLY_URL
const VIDEO_ASSEMBLY_SECRET = (process.env.VIDEO_ASSEMBLY_SECRET || '').trim().replace(/[\r\n]/g, '')

/**
 * Theme PREVIEW — render a few page stills for the chosen style from the user's
 * REAL script, with no Gemini images and no audio (so it's free + fast). Used by
 * the wizard's theme picker. Cinematic isn't previewed live (it needs Gemini
 * images) — the picker shows a static sample for that one.
 *
 * POST /api/preview-theme  { videoId, scenes, variant: 'editorial'|'time', brandId? }
 * → { stills: string[] }
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!VIDEO_ASSEMBLY_URL) return NextResponse.json({ error: 'Preview service not configured' }, { status: 500 })

  const body = await request.json().catch(() => null)
  const videoId: string | undefined = body?.videoId
  const variant: 'editorial' | 'time' = body?.variant === 'editorial' ? 'editorial' : 'time'
  const scenes: any[] = Array.isArray(body?.scenes) ? body.scenes : []
  if (!videoId || scenes.length === 0) {
    return NextResponse.json({ error: 'videoId and scenes are required' }, { status: 400 })
  }

  // Load the brand for colors/masthead (optional).
  let brand: Brand | null = null
  if (body?.brandId) {
    const { data } = await supabase.from('brands').select('*').eq('id', body.brandId).eq('user_id', user.id).single()
    brand = (data as Brand) || null
  }

  try {
    // Reuse the editorial structurer to turn the script into archetype scenes.
    const payload = await buildEditorialPayload({
      videoId, userId: user.id, voiceId: 'nova',
      scenes, brand, brandName: brand?.name ?? null,
      extracted: body?.extracted || {},
      variant,
    })

    const res = await fetch(`${VIDEO_ASSEMBLY_URL}/preview-editorial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-secret': VIDEO_ASSEMBLY_SECRET },
      body: JSON.stringify({
        videoId, userId: user.id,
        masthead: payload.masthead, runningTitle: payload.runningTitle,
        brandColor: payload.brandColor, variant, contactLine: payload.contactLine,
        scenes: payload.scenes,
      }),
      signal: AbortSignal.timeout(110000),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.success) {
      return NextResponse.json({ error: data?.error || `Preview failed (HTTP ${res.status})` }, { status: 502 })
    }
    return NextResponse.json({ stills: data.stills || [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Preview failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
