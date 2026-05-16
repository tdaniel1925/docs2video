import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { isAdmin } from '../../../_lib/admin'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    const [profileRes, videosRes, quotesRes, emailsRes, referralsRes] = await Promise.all([
      admin.from('profiles').select('*').eq('id', id).single(),
      admin.from('videos').select('*').eq('user_id', id).order('created_at', { ascending: false }),
      admin.from('quotes').select('*').eq('user_id', id).order('created_at', { ascending: false }),
      admin.from('email_connections').select('*').eq('user_id', id).order('created_at', { ascending: false }),
      admin.from('profiles').select('id, email, full_name').eq('referred_by', id),
    ])

    if (!profileRes.data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      profile: profileRes.data,
      videos: videosRes.data ?? [],
      quotes: quotesRes.data ?? [],
      emailConnections: emailsRes.data ?? [],
      referrals: referralsRes.data ?? [],
    })
  } catch (err) {
    console.error('[admin/user-detail] Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
