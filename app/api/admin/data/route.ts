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

    const [profilesRes, videosRes, brandsRes] = await Promise.all([
      admin.from('profiles').select('*').order('created_at', { ascending: false }),
      admin.from('videos').select('*').order('created_at', { ascending: false }),
      admin.from('brands').select('*').order('created_at', { ascending: false }),
    ])

    return NextResponse.json({
      profiles: profilesRes.data ?? [],
      videos: videosRes.data ?? [],
      brands: brandsRes.data ?? [],
    })
  } catch (err) {
    console.error('[admin/data] Error:', err)
    return NextResponse.json({ error: 'Internal error', detail: err instanceof Error ? err.message : 'Unknown' }, { status: 500 })
  }
}
