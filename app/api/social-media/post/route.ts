import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { deductCredits } from '../../../_lib/credits'

export const runtime = 'nodejs'

const AYRSHARE_API_KEY = process.env.AYRSHARE_API_KEY
const CREDITS_PER_PLATFORM = 25

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { caption, platforms, mediaUrl, scheduledAt } = await request.json() as {
    caption: string
    platforms: string[]
    mediaUrl?: string
    scheduledAt?: string
  }

  if (!caption?.trim()) {
    return NextResponse.json({ error: 'Caption is required' }, { status: 400 })
  }
  if (!platforms?.length) {
    return NextResponse.json({ error: 'Select at least one platform' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Get user's Ayrshare profile key
  const { data: profile } = await admin
    .from('profiles')
    .select('ayrshare_profile_key')
    .eq('id', user.id)
    .single()

  const profileKey = profile?.ayrshare_profile_key
  if (!profileKey) {
    return NextResponse.json({ error: 'Connect your social accounts first in Settings' }, { status: 400 })
  }

  // Deduct credits
  const totalCost = platforms.length * CREDITS_PER_PLATFORM
  const deducted = await deductCredits(user.id, totalCost, 'social_post', undefined, `Social post to ${platforms.join(', ')}`)
  if (!deducted) {
    return NextResponse.json({ error: `Insufficient credits. Need ${totalCost} credits (${CREDITS_PER_PLATFORM} per platform).` }, { status: 402 })
  }

  try {
    const postBody: Record<string, unknown> = {
      post: caption,
      platforms,
      profileKey,
    }

    if (mediaUrl) {
      postBody.mediaUrls = [mediaUrl]
    }

    if (scheduledAt) {
      postBody.scheduleDate = scheduledAt
    }

    const ayrRes = await fetch('https://app.ayrshare.com/api/post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AYRSHARE_API_KEY}`,
      },
      body: JSON.stringify(postBody),
    })

    const ayrData = await ayrRes.json()

    if (ayrData.status === 'error') {
      return NextResponse.json({ error: ayrData.message || 'Posting failed' }, { status: 500 })
    }

    // Record in social_campaign_posts
    const postId = ayrData.id || ayrData.postIds?.[0] || null
    for (const platform of platforms) {
      await admin.from('social_campaign_posts').insert({
        user_id: user.id,
        platform,
        caption,
        status: scheduledAt ? 'scheduled' : 'published',
        scheduled_at: scheduledAt || new Date().toISOString(),
        ayrshare_post_id: postId,
        image_url: mediaUrl || null,
      })
    }

    return NextResponse.json({
      success: true,
      scheduled: !!scheduledAt,
      creditsUsed: totalCost,
      postId,
    })
  } catch (err) {
    console.error('[social-media/post] Error:', err)
    return NextResponse.json({ error: 'Failed to post' }, { status: 500 })
  }
}
