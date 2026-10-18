import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../_lib/admin'
import { logAdminAction } from '../../../_lib/audit'
import { retryQuote, rerunVideo } from '../../../_lib/admin/retry'
export const maxDuration = 30

/**
 * GET /api/admin/retry-video?videoId=… — READ ONLY. What a retry would charge,
 * in plain words, so the confirm box can say it BEFORE anything runs.
 */
export async function GET(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  const videoId = new URL(request.url).searchParams.get('videoId')
  if (!videoId) return NextResponse.json({ error: 'videoId is required' }, { status: 400 })
  const q = await retryQuote(videoId)
  if (!q) return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  return NextResponse.json(q)
}

/** POST { videoId } — re-run a failed (or review-held) video as its owner. */
export async function POST(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { videoId } = await request.json() as { videoId: string }
  if (!videoId) return NextResponse.json({ error: 'videoId is required' }, { status: 400 })

  try {
    const quote = await retryQuote(videoId)
    const r = await rerunVideo(videoId)
    if (r.error) return NextResponse.json({ error: r.error }, { status: r.error === 'Video not found' ? 404 : 500 })
    await logAdminAction(user.id, 'retry_video', r.ownerId ?? undefined, { videoId, chargeOwner: r.chargeOwner, credits: quote?.credits ?? null })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/retry-video] Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
