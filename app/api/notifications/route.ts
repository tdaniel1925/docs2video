import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'

export const runtime = 'nodejs'

// GET: fetch notifications + active jobs for current user
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()

  const [{ data: notifications }, { data: jobs }, { count: unreadCount }] = await Promise.all([
    admin.from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    admin.from('jobs')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['queued', 'running'])
      .order('created_at', { ascending: false }),
    admin.from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false),
  ])

  return NextResponse.json({
    notifications: notifications ?? [],
    activeJobs: jobs ?? [],
    unreadCount: unreadCount ?? 0,
  })
}

// POST: mark notifications as read
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { action, notificationId } = await request.json() as {
    action: 'mark-read' | 'mark-all-read'
    notificationId?: string
  }

  const admin = createAdminClient()

  if (action === 'mark-all-read') {
    await admin.from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)
    return NextResponse.json({ success: true })
  }

  if (action === 'mark-read' && notificationId) {
    await admin.from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_id', user.id)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
