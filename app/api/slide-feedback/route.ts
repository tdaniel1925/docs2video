import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { videoId, slideIndex, styleId, slidePrompt, rating, feedbackText } = body as {
    videoId?: string
    slideIndex: number
    styleId?: string
    slidePrompt?: string
    rating: 'approve' | 'redo' | 'thumbs_up' | 'thumbs_down'
    feedbackText?: string
  }

  if (slideIndex == null || !rating) {
    return NextResponse.json({ error: 'slideIndex and rating are required' }, { status: 400 })
  }

  const { error } = await supabase.from('slide_feedback').insert({
    user_id: user.id,
    video_id: videoId ?? null,
    slide_index: slideIndex,
    style_id: styleId ?? null,
    slide_prompt: slidePrompt ?? null,
    rating,
    feedback_text: feedbackText ?? null,
  })

  if (error) {
    console.error('[slide-feedback] Insert error:', error)
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
