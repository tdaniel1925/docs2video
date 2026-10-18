import { Resend } from 'resend'
import { upsertErrorLog } from './error-logger'
import { ownerAlertEmail } from './owner-inbox'

// =============================================================================
// TELL TRENT, FROM INSIDE THE APP — ONE INBOX.
//
// The render service already reaches the owner through
// /api/internal/error-report. Code running inside the app (a refund that
// failed, a payment the Stripe webhook could not apply, a cron that stopped
// running) used to only console.error — nobody saw it. This sends the same
// kind of email straight from here (no HTTP hop to ourselves), to the same
// inbox (owner-inbox.ts), and records it in the admin Logs view.
//
// Never throws: alerting must never break the thing it reports on.
// =============================================================================

export interface OpsAlert {
  /** Short area name, e.g. 'generate-video', 'stripe-webhook', 'cron'. */
  source: string
  stage?: string
  /** One plain sentence: what broke. Named customer if there is one. */
  message: string
  detail?: string
  videoId?: string | null
  userId?: string | null
}

// The same alert at most once per window per server instance, so a database
// outage that fails every request doesn't send hundreds of emails.
const THROTTLE_MS = 10 * 60 * 1000
const lastSent = new Map<string, number>()

/** The subject line (exported for tests). */
export function opsAlertSubject(a: OpsAlert): string {
  return `⚠️ Docs2Video: ${a.source}${a.stage ? ` / ${a.stage}` : ''}${a.videoId ? ` (${a.videoId.slice(0, 8)})` : ''}`
}

const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** The email body (exported for tests). */
export function opsAlertHtml(a: OpsAlert): string {
  const rows: [string, string | null | undefined][] = [
    ['Source', a.source], ['Stage', a.stage], ['Video ID', a.videoId], ['User ID', a.userId],
  ]
  const rowsHtml = rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666;font-weight:600;">${k}</td><td style="padding:4px 0;"><code>${esc(String(v))}</code></td></tr>`)
    .join('')
  return `
    <div style="font-family:sans-serif;max-width:640px;">
      <h2 style="color:#b91c1c;margin:0 0 12px;">Docs2Video needs a look</h2>
      <table style="font-size:14px;border-collapse:collapse;margin-bottom:16px;">${rowsHtml}</table>
      <pre style="background:#f6f6f6;border:1px solid #e5e5e5;border-radius:8px;padding:12px;white-space:pre-wrap;word-break:break-word;font-size:13px;">${esc(a.message)}</pre>
      ${a.detail ? `<pre style="background:#f6f6f6;border:1px solid #e5e5e5;border-radius:8px;padding:12px;white-space:pre-wrap;word-break:break-word;font-size:12px;color:#444;">${esc(a.detail)}</pre>` : ''}
    </div>`
}

/**
 * Record + email one alert. Returns true when the email was handed to Resend.
 * Awaitable (so serverless work isn't cut off), but never throws.
 */
export async function alertOps(a: OpsAlert): Promise<boolean> {
  try {
    console.error(`[ops-alert] ${a.source}${a.stage ? `/${a.stage}` : ''}: ${a.message}`)
    await upsertErrorLog({
      source: 'app', severity: 'critical', message: a.message, detail: a.detail ?? null,
      endpoint: a.source + (a.stage ? `:${a.stage}` : ''), videoId: a.videoId ?? null, userId: a.userId ?? null,
    })

    const key = `${a.source}|${a.stage ?? ''}|${a.message}`
    const now = Date.now()
    const prev = lastSent.get(key)
    if (prev && now - prev < THROTTLE_MS) return false
    lastSent.set(key, now)

    if (!process.env.RESEND_API_KEY) {
      console.error('[ops-alert] RESEND_API_KEY unset — alert not emailed')
      return false
    }
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'Docs2Video Alerts <support@docs2video.com>',
      to: ownerAlertEmail(),
      subject: opsAlertSubject(a),
      html: opsAlertHtml(a),
    })
    if (error) {
      console.error('[ops-alert] email failed:', error.message)
      return false
    }
    return true
  } catch (e) {
    console.error('[ops-alert] could not send alert:', e instanceof Error ? e.message : e)
    return false
  }
}

/** Test hook: forget the throttle. */
export function resetOpsAlertThrottle(): void {
  lastSent.clear()
}

/**
 * Who a Stripe event is about, in words an alert can show: the email and the
 * Stripe customer id (and our user id when the metadata carries it). Reads
 * only fields that sit on the event itself — no extra Stripe call.
 */
export function stripeEventCustomer(event: { data?: { object?: unknown } } | null | undefined): string {
  const o = (event?.data?.object ?? {}) as Record<string, any>
  const customer = typeof o.customer === 'string' ? o.customer : o.customer?.id ?? (typeof o.object === 'string' && o.object === 'customer' ? o.id : null)
  const email = o.customer_email ?? o.customer_details?.email ?? o.receipt_email ?? o.billing_details?.email ?? o.email ?? null
  const userId = o.metadata?.supabase_user_id ?? o.metadata?.user_id ?? o.client_reference_id ?? null
  const parts = [email ? `email ${email}` : null, customer ? `customer ${customer}` : null, userId ? `user ${userId}` : null].filter(Boolean)
  return parts.length ? parts.join(', ') : 'unknown customer'
}
