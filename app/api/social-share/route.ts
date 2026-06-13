import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { addTopupCredits } from '../../_lib/credits'

export const runtime = 'nodejs'
export const maxDuration = 60

const AYRSHARE_API_KEY = process.env.AYRSHARE_API_KEY
const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || 'docs2video.com'
const CREDITS_PER_SHARE = 2
const MAX_SHARE_CREDITS_PER_MONTH = 5

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  if (!AYRSHARE_API_KEY) {
    return NextResponse.json({ error: 'Social sharing not configured' }, { status: 500 })
  }

  const { platform, creationId, creationType, message, imageUrl } = await request.json() as {
    platform: string
    creationId: string
    creationType: string
    message?: string
    imageUrl?: string
  }

  if (!platform || !creationId) {
    return NextResponse.json({ error: 'Missing platform or creationId' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Check if user has their own Ayrshare profile key
  const { data: userProfile } = await admin
    .from('profiles')
    .select('ayrshare_profile_key')
    .eq('id', user.id)
    .single()

  const useProfileKey = userProfile?.ayrshare_profile_key

  // Check monthly share credit limit
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const { count: monthlyShares } = await admin
    .from('social_shares')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('credits_awarded', true)
    .gte('created_at', monthStart)

  const sharesThisMonth = monthlyShares ?? 0
  const creditsEarnedThisMonth = sharesThisMonth * CREDITS_PER_SHARE
  const canEarnMore = creditsEarnedThisMonth < MAX_SHARE_CREDITS_PER_MONTH

  // Default share message
  const shareText = message || `Check out what I created with Docs2Video! Professional videos, infographics, and business cards in minutes. #Docs2Video #AI`

  const shareUrl = `https://${APP_DOMAIN}`

  try {
    // Post via AyrShare
    const postBody: Record<string, unknown> = {
      post: shareText + `\n\n${shareUrl}`,
      platforms: [platform],
      mediaUrls: imageUrl ? [imageUrl] : undefined,
    }

    // Use user's own profile key if they have one connected
    if (useProfileKey) {
      postBody.profileKey = useProfileKey
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

    // Record the share
    const postId = ayrData.id || ayrData.postIds?.[0] || null
    const credited = canEarnMore

    await admin.from('social_shares').insert({
      user_id: user.id,
      platform,
      creation_id: creationId,
      creation_type: creationType,
      post_id: postId,
      credits_awarded: credited,
      credits_amount: credited ? CREDITS_PER_SHARE : 0,
    })

    // Award credits if eligible — into the REAL spendable wallet (audit #8),
    // not the dead profiles.credits_remaining column.
    if (credited) {
      await addTopupCredits(user.id, CREDITS_PER_SHARE, 'social_share_reward')
      console.log(`[social-share] Awarded ${CREDITS_PER_SHARE} credits to user ${user.id} for ${platform} share`)
    }

    return NextResponse.json({
      success: true,
      creditsAwarded: credited ? CREDITS_PER_SHARE : 0,
      message: credited
        ? `Posted! You earned ${CREDITS_PER_SHARE} free credits.`
        : `Posted! You've already earned the maximum ${MAX_SHARE_CREDITS_PER_MONTH} share credits this month.`,
      remainingShareCredits: Math.max(0, MAX_SHARE_CREDITS_PER_MONTH - creditsEarnedThisMonth - (credited ? CREDITS_PER_SHARE : 0)),
    })
  } catch (err) {
    console.error('[social-share] Error:', err)
    return NextResponse.json({ error: 'Failed to post' }, { status: 500 })
  }
}

// GET: check share status for current user
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { count } = await admin
    .from('social_shares')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('credits_awarded', true)
    .gte('created_at', monthStart)

  const earned = (count ?? 0) * CREDITS_PER_SHARE

  return NextResponse.json({
    creditsEarnedThisMonth: earned,
    maxCreditsPerMonth: MAX_SHARE_CREDITS_PER_MONTH,
    creditsPerShare: CREDITS_PER_SHARE,
    canEarnMore: earned < MAX_SHARE_CREDITS_PER_MONTH,
    sharesRemaining: Math.max(0, Math.floor((MAX_SHARE_CREDITS_PER_MONTH - earned) / CREDITS_PER_SHARE)),
  })
}
