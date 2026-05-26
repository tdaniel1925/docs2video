import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 30

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

    // 8. Delete profile
    await admin.from('profiles').delete().eq('id', userId)

    // 9. Delete the auth user
    await admin.auth.admin.deleteUser(userId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[account/delete] Error:', err)
    const message = err instanceof Error ? err.message : 'Account deletion failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
