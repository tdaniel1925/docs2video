import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { verifyCronAuth } from '../../../_lib/cron-auth'
import { recordCronRun } from '../../../_lib/cron-heartbeat'
import { Resend } from 'resend'
import { loadNeedsYou } from '../../../_lib/admin/needs-you'
import { needsYouEmailHtml, needsYouSubject } from '../../../_lib/admin/needs-you-email'
import { ownerAlertEmail } from '../../../_lib/owner-inbox'
import { siteUrl } from '../../../_lib/site-url'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Cron: the daily "What needs you" email — the same list as the admin home
 * card (videos that didn't finish, videos waiting for your OK, payment
 * problems, late payers, paying customers slipping, affiliate payouts, AI
 * service balances) plus videos stuck mid-way. Every line links to the right
 * admin page. Sent to ONE inbox — the same one the 6-hourly health check uses
 * (owner-inbox.ts: OWNER_ALERT_EMAIL, else tdaniel@botmakers.ai).
 * Quiet when nothing needs the owner.
 * GET /api/cron/daily-digest — daily via Vercel Cron.
 */
export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Heartbeat: the health cron emails Trent if this stops running (audit 2026-10-09).
  await recordCronRun('daily-digest')

  const admin = createAdminClient()
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const [needs, { data: stuck }, { count: completedCount }] = await Promise.all([
    loadNeedsYou(),
    admin.from('videos')
      .select('id, user_id, title, status, updated_at')
      .in('status', ['scripting', 'generating_audio', 'generating_slides', 'assembling'])
      .lt('updated_at', hourAgo)
      .limit(25),
    admin.from('videos').select('*', { count: 'exact', head: true })
      .eq('status', 'completed').gte('updated_at', dayAgo),
  ])

  const stuckList = (stuck ?? []).map((v) => ({ title: v.title || 'Untitled', status: v.status, href: `/admin/users/${v.user_id}` }))

  if (needs.total === 0 && stuckList.length === 0) {
    console.log('[daily-digest] Nothing needs the owner — no email sent')
    return NextResponse.json({ sent: false, total: 0 })
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('[daily-digest] RESEND_API_KEY unset — cannot send')
    return NextResponse.json({ sent: false, error: 'Email not configured' }, { status: 503 })
  }
  const resend = new Resend(process.env.RESEND_API_KEY)
  const to = ownerAlertEmail()
  // Resend returns failures instead of throwing. Report them as a failed run
  // so the cron log shows the digest never went out.
  const { error: sendError } = await resend.emails.send({
    from: 'Docs2Video <reports@docs2video.com>',
    to,
    subject: needsYouSubject(needs, stuckList.length),
    html: needsYouEmailHtml(needs, siteUrl(), { completed24h: completedCount ?? 0, stuck: stuckList }),
  })
  if (sendError) {
    console.error('[daily-digest] send failed:', sendError.message)
    return NextResponse.json({ sent: false, error: sendError.message }, { status: 500 })
  }

  console.log(`[daily-digest] Sent "What needs you" (${needs.total} items, ${stuckList.length} stuck)`)
  return NextResponse.json({ sent: true, total: needs.total, stuck: stuckList.length })
}
