import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 30

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
    // Only show GENUINELY active jobs — exclude stale ones (>30 min) so dead
    // stuck jobs don't pile up in the bell forever (the cron fails them, but
    // hide them here regardless).
    admin.from('jobs')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['queued', 'running'])
      .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
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

  const { action, notificationId, jobId } = await request.json() as {
    action: 'mark-read' | 'mark-all-read' | 'dismiss-job'
    notificationId?: string
    jobId?: string
  }

  const admin = createAdminClient()

  // Let a user clear a stuck in-progress job from their notification bell.
  if (action === 'dismiss-job' && jobId) {
    await admin.from('jobs')
      .update({ status: 'failed', error_message: 'Dismissed by user' })
      .eq('id', jobId)
      .eq('user_id', user.id)
    return NextResponse.json({ success: true })
  }

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
