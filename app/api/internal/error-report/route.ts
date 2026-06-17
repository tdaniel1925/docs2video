import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { upsertErrorLog, type ErrorSource } from '../../../_lib/error-logger'

export const runtime = 'nodejs'
export const maxDuration = 30

const ALERT_TO = 'tdaniel@botmakers.ai'

/**
 * POST /api/internal/error-report
 * Internal-only error alerting. The VPS render server (and app code) POST here
 * when something fails; we email an alert to the ops address via Resend.
 *
 * Auth: the shared x-api-secret (same secret the VPS already uses for
 * /generate). Fails closed if VIDEO_ASSEMBLY_SECRET is unset.
 *
 * Body: { source, videoId?, userId?, stage?, message, detail? }
 */
export async function POST(request: Request) {
  const secret = process.env.VIDEO_ASSEMBLY_SECRET
  if (!secret) return NextResponse.json({ error: 'Alerting not configured' }, { status: 503 })
  if (request.headers.get('x-api-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    source?: string
    videoId?: string
    userId?: string
    stage?: string
    message?: string
    detail?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { source = 'unknown', videoId, userId, stage, message = '(no message)', detail } = body

  // Record into the central error_logs table (deduped) so it shows in admin Logs.
  // Map the free-form source to our enum: anything starting 'vps' → 'vps'.
  const logSource: ErrorSource = source.startsWith('vps') ? 'vps' : source === 'vercel' ? 'vercel' : 'app'
  await upsertErrorLog({
    source: logSource,
    severity: 'error',
    message,
    detail,
    endpoint: source + (stage ? `:${stage}` : ''),
    videoId,
    userId,
  })

  if (!process.env.RESEND_API_KEY) {
    console.error('[error-report] RESEND_API_KEY unset — cannot send alert:', message)
    return NextResponse.json({ error: 'Email not configured' }, { status: 503 })
  }

  const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const rows: [string, string | undefined][] = [
    ['Source', source],
    ['Stage', stage],
    ['Video ID', videoId],
    ['User ID', userId],
  ]
  const rowsHtml = rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666;font-weight:600;">${k}</td><td style="padding:4px 0;"><code>${esc(v!)}</code></td></tr>`)
    .join('')

  const html = `
    <div style="font-family:sans-serif;max-width:640px;">
      <h2 style="color:#b91c1c;margin:0 0 12px;">⚠️ Docs2Video error</h2>
      <table style="font-size:14px;border-collapse:collapse;margin-bottom:16px;">${rowsHtml}</table>
      <div style="font-size:14px;font-weight:600;margin-bottom:4px;">Message</div>
      <pre style="background:#f6f6f6;border:1px solid #e5e5e5;border-radius:8px;padding:12px;white-space:pre-wrap;word-break:break-word;font-size:13px;">${esc(message)}</pre>
      ${detail ? `<div style="font-size:14px;font-weight:600;margin:12px 0 4px;">Detail</div><pre style="background:#f6f6f6;border:1px solid #e5e5e5;border-radius:8px;padding:12px;white-space:pre-wrap;word-break:break-word;font-size:12px;color:#444;">${esc(detail)}</pre>` : ''}
    </div>`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'Docs2Video Alerts <support@docs2video.com>',
      to: ALERT_TO,
      subject: `⚠️ Docs2Video error: ${source}${videoId ? ` (${videoId.slice(0, 8)})` : ''}`,
      html,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[error-report] Failed to send alert email:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Send failed' }, { status: 500 })
  }
}
