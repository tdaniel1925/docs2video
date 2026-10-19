import { Resend } from 'resend'
import { createAdminClient } from '../supabase/admin'
import { ownerAlertEmail } from '../owner-inbox'
import { makeRef, type CleanReport, type ReportKind, type ReportStatus } from './report-rules'

/*
 * Where reports live: public.support_reports (supabase/migrations/
 * 20261019_support_reports.sql) and the private "support" storage bucket for
 * screenshots. Server only (service role). Every email here is best-effort:
 * a mail that fails never fails the report.
 */

export type ReportRow = {
  ref: string
  user_id: string
  status: ReportStatus
  kind: ReportKind | null
  description: string
  triage_summary: string | null
  pr_url: string | null
  resolution_note: string | null
  created_at: string
  updated_at: string
}

type Db = ReturnType<typeof createAdminClient>

export async function createReport(db: Db, userId: string, r: CleanReport): Promise<ReportRow> {
  // A ref clash is one in ~28 million; try a few before giving up.
  for (let i = 0; i < 4; i++) {
    const ref = makeRef()
    let screenshotPath: string | null = null
    if (r.screenshot) {
      const bytes = Buffer.from(r.screenshot.split(',')[1] ?? '', 'base64')
      const type = r.screenshot.startsWith('data:image/png') ? 'image/png' : 'image/jpeg'
      const path = `${userId}/${ref}.${type === 'image/png' ? 'png' : 'jpg'}`
      const { error } = await db.storage.from('support').upload(path, bytes, { contentType: type, upsert: true })
      if (!error) screenshotPath = path
      else console.warn('[support] screenshot not stored:', error.message)
    }
    const { data, error } = await db.from('support_reports').insert({
      ref,
      user_id: userId,
      status: 'received',
      description: r.description,
      steps: r.steps,
      page_url: r.pageUrl,
      browser: r.browser,
      diagnostics: { consoleErrors: r.consoleErrors, failedCalls: r.failedCalls },
      screenshot_path: screenshotPath,
      video_id: r.videoId,
    }).select('ref, user_id, status, kind, description, triage_summary, pr_url, resolution_note, created_at, updated_at').single()
    if (!error && data) return data as ReportRow
    if (error && !/duplicate|unique/i.test(error.message)) throw new Error(`support report not stored: ${error.message}`)
  }
  throw new Error('support report not stored: no free reference')
}

export async function updateReport(db: Db, ref: string, patch: Record<string, unknown>): Promise<ReportRow | null> {
  const { data, error } = await db.from('support_reports')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('ref', ref.trim().toUpperCase())
    .select('ref, user_id, status, kind, description, triage_summary, pr_url, resolution_note, created_at, updated_at')
    .maybeSingle()
  if (error) throw new Error(`support report not updated: ${error.message}`)
  return (data as ReportRow | null) ?? null
}

export async function reportByRef(db: Db, ref: string): Promise<ReportRow | null> {
  const { data } = await db.from('support_reports')
    .select('ref, user_id, status, kind, description, triage_summary, pr_url, resolution_note, created_at, updated_at')
    .eq('ref', ref.trim().toUpperCase()).maybeSingle()
  return (data as ReportRow | null) ?? null
}

/** The person's newest report from the last week, so the panel can pick up where it left off. */
export async function latestReportFor(db: Db, userId: string): Promise<ReportRow | null> {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString()
  const { data } = await db.from('support_reports')
    .select('ref, user_id, status, kind, description, triage_summary, pr_url, resolution_note, created_at, updated_at')
    .eq('user_id', userId).gte('created_at', since)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  return (data as ReportRow | null) ?? null
}

const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

async function send(to: string, subject: string, html: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) { console.warn('[support] RESEND_API_KEY unset — email not sent:', subject); return false }
  try {
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: 'Docs2Video <support@docs2video.com>', to, subject, html })
    if (error) throw new Error(error.message)
    return true
  } catch (err) {
    console.warn('[support] email failed:', err instanceof Error ? err.message : err)
    return false
  }
}

const card = (heading: string, body: string, cta?: { label: string; url: string }) => `
  <div style="font-family:sans-serif;max-width:600px;color:#111">
    <h2 style="margin:0 0 12px">${esc(heading)}</h2>
    ${body}
    ${cta ? `<p style="margin-top:20px"><a href="${esc(cta.url)}" style="background:#0A55A0;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">${esc(cta.label)}</a></p>` : ''}
  </div>`

/** Tell the owner. kind: a report a person must look at, or a fix PR ready. */
export async function emailOwner(subject: string, lines: string[], cta?: { label: string; url: string }): Promise<boolean> {
  return send(ownerAlertEmail(), subject, card(subject, lines.map((l) => `<p style="margin:0 0 8px">${esc(l)}</p>`).join(''), cta))
}

/** Tell the person their report is fixed. */
export async function emailReporter(db: Db, row: ReportRow, note: string): Promise<boolean> {
  const { data } = await db.from('profiles').select('email').eq('id', row.user_id).maybeSingle()
  const to = (data as { email?: string | null } | null)?.email
  if (!to) return false
  return send(to, `Fixed: your report #${row.ref}`, card(
    'It’s fixed.',
    `<p>Thanks for telling us. Report #${esc(row.ref)} is fixed and live now.</p><p style="color:#555">${esc(note)}</p>`,
    { label: 'Open Docs2Video', url: 'https://docs2video.com/dashboard' },
  ))
}
