import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { requireAdmin } from '../../../_lib/admin'
export const maxDuration = 30

export async function GET() {
  try {
    const user = await requireAdmin()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const admin = createAdminClient()

    const [profilesRes, videosRes, brandsRes, auditRes, analyticsRes, balancesRes] = await Promise.all([
      admin.from('profiles').select('*').order('created_at', { ascending: false }).limit(1000),
      admin.from('videos').select('*').order('created_at', { ascending: false }).limit(2000),
      admin.from('brands').select('*').order('created_at', { ascending: false }).limit(2000),
      admin.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(200),
      admin.from('video_analytics').select('video_id, event_type').limit(20000),
      admin.from('credit_balances').select('user_id, balance, topup_balance').limit(2000),
    ])

    // Real spendable balance per user (credit_balances), NOT the dead legacy
    // profiles.credits_remaining column. Overlay it so the admin table shows the
    // correct number.
    const balanceByUser: Record<string, number> = {}
    for (const b of (balancesRes.data ?? [])) {
      balanceByUser[b.user_id] = (b.balance ?? 0) + (b.topup_balance ?? 0)
    }
    const profilesWithBalance = (profilesRes.data ?? []).map((p: any) => ({
      ...p,
      credits_remaining: balanceByUser[p.id] ?? 0,
    }))

    // Build per-video analytics counts
    const analyticsMap: Record<string, { views: number; plays: number }> = {}
    for (const row of (analyticsRes.data ?? [])) {
      if (!analyticsMap[row.video_id]) analyticsMap[row.video_id] = { views: 0, plays: 0 }
      if (row.event_type === 'view') analyticsMap[row.video_id].views++
      if (row.event_type === 'play') analyticsMap[row.video_id].plays++
    }

    return NextResponse.json({
      profiles: profilesWithBalance,
      videos: videosRes.data ?? [],
      brands: brandsRes.data ?? [],
      auditLog: auditRes.data ?? [],
      videoAnalytics: analyticsMap,
    })
  } catch (err) {
    console.error('[admin/data] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
