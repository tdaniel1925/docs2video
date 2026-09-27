import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { getStripe } from '../../../_lib/stripe'
import { isLiveSubscription } from '../../../_lib/billing'

export const runtime = 'nodejs'
export const maxDuration = 60

// Buckets that hold per-user uploads/outputs under a `{userId}/` folder.
const USER_BUCKETS = ['videos', 'creation-assets', 'creations', 'infographics', 'brand-assets', 'logos', 'agent-photos', 'slides']

/** Delete every file under `prefix` in `bucket` (walks sub-folders). Returns the count. */
async function removeFolder(admin: ReturnType<typeof createAdminClient>, bucket: string, prefix: string, depth = 0): Promise<number> {
  if (depth > 6) return 0
  let removed = 0
  try {
    const files: string[] = []
    for (let offset = 0; offset < 10000; offset += 1000) {
      const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset })
      if (error || !data || data.length === 0) break
      for (const item of data) {
        const full = `${prefix}/${item.name}`
        // Folders come back without an id.
        if (item.id) files.push(full)
        else removed += await removeFolder(admin, bucket, full, depth + 1)
      }
      if (data.length < 1000) break
    }
    for (let i = 0; i < files.length; i += 100) {
      const { error } = await admin.storage.from(bucket).remove(files.slice(i, i + 100))
      if (error) console.error(`[account/delete] storage remove failed in ${bucket}/${prefix}:`, error.message)
      else removed += Math.min(100, files.length - i)
    }
  } catch (e) {
    console.error(`[account/delete] storage cleanup error in ${bucket}/${prefix}:`, e instanceof Error ? e.message : e)
  }
  return removed
}

async function removeUserFiles(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<number> {
  let n = 0
  for (const bucket of USER_BUCKETS) n += await removeFolder(admin, bucket, userId)
  n += await removeFolder(admin, 'creations', `logos/${userId}`)
  return n
}

/**
 * POST /api/account/delete
 * GDPR account deletion — removes all user data and the auth account.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = createAdminClient()
  const userId = user.id

  // 0. STOP BILLING FIRST (audit H12). Deleting the account used to leave the
  //    Stripe subscription running — the person kept being charged for an
  //    account that no longer existed. If any live subscription can't be
  //    cancelled we stop here, so the account is never deleted while it can
  //    still bill.
  const { data: billingProfile } = await admin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()
  if (billingProfile?.stripe_customer_id) {
    try {
      const stripe = getStripe()
      const subs = await stripe.subscriptions.list({ customer: billingProfile.stripe_customer_id, status: 'all', limit: 100 })
      for (const sub of subs.data) {
        // Main plan AND the AI Social add-on — anything that can still bill.
        if (isLiveSubscription(sub)) {
          await stripe.subscriptions.cancel(sub.id)
          console.log(`[account/delete] cancelled subscription ${sub.id} (${sub.status}) for user ${userId}`)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!msg.includes('No such customer')) { // a dead test-mode customer can't bill anyone
        console.error(`[account/delete] could not cancel subscriptions for user ${userId} — NOT deleting:`, msg)
        return NextResponse.json({
          error: 'We could not cancel your subscription, so your account was not deleted. Please try again, or cancel from Manage billing first.',
        }, { status: 502 })
      }
    }
  }

  try {
    // 1. Get all user videos to delete storage files
    const { data: videos } = await admin
      .from('videos')
      .select('id, video_url, thumbnail_url')
      .eq('user_id', userId)

    // 2. Delete storage files for each video
    if (videos && videos.length > 0) {
      const videoIds = videos.map((v) => v.id)

      // Delete video_analytics entries
      await admin.from('video_analytics').delete().in('video_id', videoIds)

      // Delete storage objects in the videos bucket
      const storagePaths: string[] = []
      for (const v of videos) {
        // Extract storage path from URL if present
        if (v.video_url) {
          const match = v.video_url.match(/\/storage\/v1\/object\/public\/videos\/(.+)/)
          if (match) storagePaths.push(match[1])
        }
        if (v.thumbnail_url) {
          const match = v.thumbnail_url.match(/\/storage\/v1\/object\/public\/videos\/(.+)/)
          if (match) storagePaths.push(match[1])
        }
        // Also try common path pattern: userId/videoId/*
        storagePaths.push(`${userId}/${v.id}`)
      }

      // Attempt to remove storage files (best-effort)
      if (storagePaths.length > 0) {
        await admin.storage.from('videos').remove(storagePaths).catch(() => {})
      }

      // Delete all video records
      await admin.from('videos').delete().eq('user_id', userId)
    }

    // 2b. Every other file the user owns. Uploads are stored under a folder
    //     named after the user id in each bucket (logo-chat uses logos/{id}
    //     in 'creations'). Best-effort: a storage hiccup must not leave a
    //     half-deleted account, it is logged for manual cleanup instead.
    const removed = await removeUserFiles(admin, userId)
    console.log(`[account/delete] removed ${removed} stored file(s) for user ${userId}`)

    // 3. Delete brands
    await admin.from('brands').delete().eq('user_id', userId)

    // 4. Delete quotes
    await admin.from('quotes').delete().eq('user_id', userId)

    // 5. Delete email connections
    await admin.from('email_connections').delete().eq('user_id', userId)

    // 6. Delete notifications
    await admin.from('notifications').delete().eq('user_id', userId)

    // 7. Delete jobs
    await admin.from('jobs').delete().eq('user_id', userId)

    // Audit the deletion BEFORE removing the profile. admin_id stays NULL (the
    // profile is about to vanish and admin_id FKs to it); the who/what lives in
    // target_user_id + details, which have no FK. This is the SOC 2 trail for a
    // data-destruction event.
    try {
      await admin.from('admin_audit_log').insert({
        admin_id: null,
        action: 'account.self_delete',
        target_user_id: userId,
        details: { email: user.email ?? null, at: new Date().toISOString() },
      })
    } catch (e) {
      console.error('[account/delete] audit log failed (continuing):', e instanceof Error ? e.message : e)
    }

    // 8. Delete profile
    await admin.from('profiles').delete().eq('id', userId)

    // 9. Delete the auth user
    await admin.auth.admin.deleteUser(userId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[account/delete] Error:', err)
    // Generic to the client; detail stays in the server log.
    return NextResponse.json({ error: 'Account deletion failed. Please contact support.' }, { status: 500 })
  }
}
