import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { isAdmin } from '../../../_lib/admin'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const admin = createAdminClient()

    const [profilesRes, videosRes, brandsRes, auditRes, analyticsRes] = await Promise.all([
      admin.from('profiles').select('*').order('created_at', { ascending: false }),
      admin.from('videos').select('*').order('created_at', { ascending: false }),
      admin.from('brands').select('*').order('created_at', { ascending: false }),
      admin.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(200),
      admin.from('video_analytics').select('video_id, event_type'),
    ])

    // Build per-video analytics counts
    const analyticsMap: Record<string, { views: number; plays: number }> = {}
    for (const row of (analyticsRes.data ?? [])) {
      if (!analyticsMap[row.video_id]) analyticsMap[row.video_id] = { views: 0, plays: 0 }
      if (row.event_type === 'view') analyticsMap[row.video_id].views++
      if (row.event_type === 'play') analyticsMap[row.video_id].plays++
    }

    return NextResponse.json({
      profiles: profilesRes.data ?? [],
      videos: videosRes.data ?? [],
      brands: brandsRes.data ?? [],
      auditLog: auditRes.data ?? [],
      videoAnalytics: analyticsMap,
    })
  } catch (err) {
    console.error('[admin/data] Error:', err)
    return NextResponse.json({ error: 'Internal error', detail: err instanceof Error ? err.message : 'Unknown' }, { status: 500 })
  }
}
