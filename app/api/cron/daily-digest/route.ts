import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { verifyCronAuth } from '../../../_lib/cron-auth'
import { Resend } from 'resend'

export const runtime = 'nodejs'
export const maxDuration = 60

const ADMIN_RECIPIENTS = ['trenttdaniel@gmail.com']

/**
 * Cron: daily admin digest of video/deck failures — the alarm that would have
 * caught silent dead-ends (e.g. the agency-tier gate bug) in 1 day, not 9.
 * GET /api/cron/daily-digest — daily via Vercel Cron.
 */
export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const [{ data: failed }, { data: stuck }, { count: draftCount }, { count: completedCount }] = await Promise.all([
    admin.from('videos')
      .select('id, user_id, title, error_message, updated_at')
      .eq('status', 'failed')
      .gte('updated_at', dayAgo)
      .order('updated_at', { ascending: false })
      .limit(25),
    admin.from('videos')
      .select('id, user_id, title, status, progress_detail, updated_at')
      .in('status', ['scripting', 'generating_audio', 'generating_slides', 'assembling'])
      .lt('updated_at', hourAgo)
      .limit(25),
    admin.from('videos').select('*', { count: 'exact', head: true })
      .eq('status', 'draft').gte('updated_at', dayAgo),
    admin.from('videos').select('*', { count: 'exact', head: true })
      .eq('status', 'completed').gte('updated_at', dayAgo),
  ])

  const failedList = failed ?? []
  const stuckList = stuck ?? []

  // Nothing wrong and healthy completions — skip the email, stay quiet
  if (failedList.length === 0 && stuckList.length === 0) {
    console.log('[daily-digest] All clear — no email sent')
    return NextResponse.json({ sent: false, failed: 0, stuck: 0 })
  }

  const row = (cells: string[]) =>
    `<tr>${cells.map(c => `<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;">${c}</td>`).join('')}</tr>`

  const failedRows = failedList.map(v =>
    row([v.title?.slice(0, 40) || v.id.slice(0, 8), v.error_message?.slice(0, 120) || '—', `<code>${v.user_id.slice(0, 8)}</code>`])
  ).join('')
  const stuckRows = stuckList.map(v =>
    row([v.title?.slice(0, 40) || v.id.slice(0, 8), `${v.status} — ${v.progress_detail || ''}`.slice(0, 120), new Date(v.updated_at).toISOString().slice(0, 16)])
  ).join('')

  const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;">
  <h2 style="color:#1B3A5C;">Docs2Video — Daily Health Digest</h2>
  <p style="font-size:14px;color:#444;">Last 24h: <b>${completedCount ?? 0}</b> completed · <b>${failedList.length}</b> failed · <b>${stuckList.length}</b> stuck mid-pipeline · <b>${draftCount ?? 0}</b> drafts touched</p>
  ${failedList.length ? `<h3 style="color:#c03a1f;">Failed (${failedList.length})</h3><table cellpadding="0" cellspacing="0" width="100%">${failedRows}</table>` : ''}
  ${stuckList.length ? `<h3 style="color:#b8860b;">Stuck &gt;1h (${stuckList.length})</h3><table cellpadding="0" cellspacing="0" width="100%">${stuckRows}</table>` : ''}
  <p style="font-size:12px;color:#999;margin-top:24px;">Review in the <a href="https://docs2video.com/admin">admin panel</a>.</p>
</div>`

  const resend = new Resend(process.env.RESEND_API_KEY!)
  const recipients = [
    ...ADMIN_RECIPIENTS,
    ...(process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean),
  ]
  await resend.emails.send({
    from: 'Docs2Video <reports@docs2video.com>',
    to: recipients,
    subject: `[Docs2Video] ${failedList.length} failed, ${stuckList.length} stuck — daily digest`,
    html,
  })

  console.log(`[daily-digest] Sent: ${failedList.length} failed, ${stuckList.length} stuck`)
  return NextResponse.json({ sent: true, failed: failedList.length, stuck: stuckList.length })
}
