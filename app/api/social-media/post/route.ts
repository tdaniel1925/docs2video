import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { deductCredits } from '../../../_lib/credits'
import { createPost, listAccounts, isZernioConfigured, type ZernioPlatform } from '../../../_lib/zernio'

export const runtime = 'nodejs'
export const maxDuration = 60

const CREDITS_PER_PLATFORM = 25

/**
 * Publish/schedule a social post via Zernio (replaces AyrShare).
 * The user's Zernio profile holds their connected accounts; we resolve the
 * accountId per requested platform, then POST one Zernio post targeting them.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { caption, platforms, mediaUrl, videoUrl, scheduledAt } = await request.json() as {
    caption: string
    platforms: string[]
    mediaUrl?: string
    videoUrl?: string
    scheduledAt?: string
  }

  if (!caption?.trim()) return NextResponse.json({ error: 'Caption is required' }, { status: 400 })
  if (!platforms?.length) return NextResponse.json({ error: 'Select at least one platform' }, { status: 400 })
  if (!isZernioConfigured()) return NextResponse.json({ error: 'Social posting is not configured.' }, { status: 500 })

  const admin = createAdminClient()

  // Add-on gate + the client's Zernio profile.
  const { data: profile } = await admin
    .from('profiles')
    .select('zernio_profile_id, social_addon_active')
    .eq('id', user.id)
    .single()
  if (!profile?.social_addon_active) {
    return NextResponse.json({ error: 'The Social add-on is not active on your account.', code: 'addon_required' }, { status: 402 })
  }
  if (!profile?.zernio_profile_id) {
    return NextResponse.json({ error: 'Connect your social accounts first in Settings.', code: 'no_accounts' }, { status: 400 })
  }
  const profileId = profile.zernio_profile_id

  // Resolve each requested platform to a connected accountId on this profile.
  let accounts
  try {
    accounts = await listAccounts(profileId)
  } catch (err) {
    console.error('[social-media/post] listAccounts failed:', err)
    return NextResponse.json({ error: 'Could not load your connected accounts.' }, { status: 502 })
  }
  const targets = platforms
    .map((p) => accounts.find((a) => a.platform === p))
    .filter(Boolean)
    .map((a) => ({ platform: a!.platform as ZernioPlatform, accountId: a!.accountId }))
  if (!targets.length) {
    return NextResponse.json({ error: 'None of the selected platforms are connected. Connect them in Settings.' }, { status: 400 })
  }

  // Deduct credits for the platforms we can actually post to.
  const totalCost = targets.length * CREDITS_PER_PLATFORM
  const deducted = await deductCredits(user.id, totalCost, 'social_post', undefined, `Social post to ${targets.map((t) => t.platform).join(', ')}`)
  if (!deducted) {
    return NextResponse.json({ error: `Insufficient credits. Need ${totalCost} (${CREDITS_PER_PLATFORM} per platform).` }, { status: 402 })
  }

  try {
    const result = await createPost({
      profileId,
      content: caption,
      platforms: targets,
      ...(mediaUrl ? { mediaUrls: [mediaUrl] } : {}),
      ...(videoUrl ? { videoUrl } : {}),
      ...(scheduledAt ? { scheduledFor: scheduledAt, timezone: 'UTC' } : { publishNow: true }),
    })

    const postId = result.id || null
    for (const t of targets) {
      await admin.from('social_campaign_posts').insert({
        user_id: user.id,
        platform: t.platform,
        caption,
        status: scheduledAt ? 'scheduled' : 'published',
        scheduled_at: scheduledAt || new Date().toISOString(),
        ayrshare_post_id: postId, // legacy column name; stores the Zernio post id
        image_url: mediaUrl || null,
      })
    }

    return NextResponse.json({ success: true, scheduled: !!scheduledAt, creditsUsed: totalCost, postId })
  } catch (err) {
    console.error('[social-media/post] Zernio post failed:', err)
    // Refund on hard failure so a failed post doesn't burn credits.
    await deductCredits(user.id, -totalCost, 'social_post_refund', undefined, 'Refund: social post failed').catch(() => {})
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to post' }, { status: 500 })
  }
}
