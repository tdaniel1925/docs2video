import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { requireAdmin } from '../../../_lib/admin'
import { getStripe, listAllStripe } from '../../../_lib/stripe'
import { videoServiceUrl } from '../../../_lib/video-service'

export const maxDuration = 30

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const admin = createAdminClient()

    // Fetch counts + subscription breakdown
    const [profilesRes, infographicsRes, videosRes, subscribersRes] = await Promise.all([
      admin.from('profiles').select('*', { count: 'exact', head: true }),
      admin.from('infographics').select('*', { count: 'exact', head: true }),
      admin.from('videos').select('*', { count: 'exact', head: true }),
      admin.from('profiles').select('subscription_status').not('subscription_status', 'is', null),
    ])

    // Count active subscribers by tier
    const subs = (subscribersRes.data ?? []).reduce((acc: Record<string, number>, p: any) => {
      const status = (p.subscription_status || '').toLowerCase()
      if (status && status !== 'free' && status !== 'canceled' && status !== 'cancelled') {
        acc[status] = (acc[status] || 0) + 1
      }
      return acc
    }, {})

    // Fetch real revenue from Stripe
    let mrr = 0
    let totalRevenue = 0
    let activeSubscriptions = 0
    try {
      const stripe = getStripe()
      // Paginated (review P3): one limit:100 page silently under-reported past
      // 100 subs/charges.
      const activeSubs = await listAllStripe((p) => stripe.subscriptions.list({ status: 'active', ...p } as any))
      activeSubscriptions = activeSubs.length
      for (const sub of activeSubs as any[]) {
        for (const item of sub.items.data) {
          mrr += (item.price?.unit_amount ?? 0) * (item.quantity ?? 1)
        }
      }
      // Get total revenue (last 90 days of successful charges)
      const charges = await listAllStripe((p) => stripe.charges.list({ created: { gte: Math.floor(Date.now() / 1000) - 90 * 86400 }, ...p } as any))
      for (const charge of charges as any[]) {
        if (charge.paid && !charge.refunded) totalRevenue += charge.amount
      }
    } catch (stripeErr) {
      console.error('[admin/stats] Stripe error:', stripeErr)
    }

    // Fetch recent signups
    const { data: recentUsers } = await admin
      .from('profiles')
      .select('email, created_at, subscription_status')
      .order('created_at', { ascending: false })
      .limit(10)

    // Fetch recent videos
    const { data: recentVideos } = await admin
      .from('videos')
      .select('title, created_at, status')
      .order('created_at', { ascending: false })
      .limit(10)

    // Videos created in last 7 days and 30 days
    const now = new Date()
    const d7 = new Date(now.getTime() - 7 * 86400000).toISOString()
    const d30 = new Date(now.getTime() - 30 * 86400000).toISOString()
    const [videos7Res, videos30Res, users30Res] = await Promise.all([
      admin.from('videos').select('*', { count: 'exact', head: true }).gte('created_at', d7),
      admin.from('videos').select('*', { count: 'exact', head: true }).gte('created_at', d30),
      admin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', d30),
    ])

    // Daily activity for last 30 days
    const [dailyUsersRes, dailyVideosRes] = await Promise.all([
      admin.from('profiles').select('created_at').gte('created_at', d30),
      admin.from('videos').select('created_at').gte('created_at', d30),
    ])
    const dailyMap: Record<string, { users: number; videos: number }> = {}
    for (let i = 29; i >= 0; i--) {
      const day = new Date(now.getTime() - i * 86400000)
      const key = day.toISOString().slice(0, 10)
      dailyMap[key] = { users: 0, videos: 0 }
    }
    for (const u of (dailyUsersRes.data ?? [])) {
      const key = u.created_at.slice(0, 10)
      if (dailyMap[key]) dailyMap[key].users++
    }
    for (const v of (dailyVideosRes.data ?? [])) {
      const key = v.created_at.slice(0, 10)
      if (dailyMap[key]) dailyMap[key].videos++
    }
    const dailyActivity = Object.entries(dailyMap).map(([date, counts]) => ({ date, ...counts }))

    // VPS health check
    let vpsStatus = 'unknown'
    try {
      const vpsUrl = videoServiceUrl()
      const vpsRes = await fetch(`${vpsUrl}/health`, { signal: AbortSignal.timeout(5000) })
      vpsStatus = vpsRes.ok ? 'healthy' : 'degraded'
    } catch { vpsStatus = 'offline' }

    return NextResponse.json({
      totalUsers: profilesRes.count ?? 0,
      totalInfographics: infographicsRes.count ?? 0,
      totalVideos: videosRes.count ?? 0,
      mrr: `$${(mrr / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      mrrCents: mrr,
      totalRevenue: `$${(totalRevenue / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      totalRevenueCents: totalRevenue,
      activeSubscriptions,
      subscriberBreakdown: subs,
      videosLast7Days: videos7Res.count ?? 0,
      videosLast30Days: videos30Res.count ?? 0,
      signupsLast30Days: users30Res.count ?? 0,
      vpsStatus,
      recentUsers: recentUsers ?? [],
      recentVideos: recentVideos ?? [],
      dailyActivity,
    })
  } catch (err) {
    console.error('[admin/stats] Error:', err)
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
