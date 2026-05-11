import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'

const ADMIN_EMAILS = ['trenttdaniel@gmail.com']

export async function GET() {
  // Verify the current user is an admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Fetch counts
  const [profilesRes, infographicsRes, videosRes] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('infographics').select('*', { count: 'exact', head: true }),
    admin.from('videos').select('*', { count: 'exact', head: true }),
  ])

  // Fetch recent signups
  const { data: recentUsers } = await admin
    .from('profiles')
    .select('email, created_at, subscription_status')
    .order('created_at', { ascending: false })
    .limit(10)

  // Fetch recent infographics
  const { data: recentInfographics } = await admin
    .from('infographics')
    .select('title, created_at, status')
    .order('created_at', { ascending: false })
    .limit(10)

  // Fetch recent videos
  const { data: recentVideos } = await admin
    .from('videos')
    .select('title, created_at, status')
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({
    totalUsers: profilesRes.count ?? 0,
    totalInfographics: infographicsRes.count ?? 0,
    totalVideos: videosRes.count ?? 0,
    revenue: '$0.00',
    recentUsers: recentUsers ?? [],
    recentInfographics: recentInfographics ?? [],
    recentVideos: recentVideos ?? [],
  })
}
