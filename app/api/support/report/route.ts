import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { hitRateLimitStrict } from '../../../_lib/rate-limit'
import { LIMITS, isRef, statusHeadline, statusSteps, validateReport, type ReportStatus } from '../../../_lib/support/report-rules'
import { triageReport } from '../../../_lib/support/triage'
import { dispatchSelfFix } from '../../../_lib/support/self-fix'
import { createReport, emailOwner, latestReportFor, reportByRef, updateReport, type ReportRow } from '../../../_lib/support/store'
import { fileReport } from '../../../_lib/support/file-report'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * "SOMETHING NOT WORKING?" — POST files a report (signed in only); GET reads
 * one back for the panel (only the person's own). See _lib/support/.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }
  const v = validateReport(body)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  // A burst and a day per person. A broken counter still files the report,
  // but with no AI and no agent run: a person looks.
  const hour = await hitRateLimitStrict(`support:${user.id}:h`, LIMITS.perHour, 3600)
  const day = hour === 'over' ? 'over' : await hitRateLimitStrict(`support:${user.id}:d`, LIMITS.perDay, 86400)
  if (hour === 'over' || day === 'over') {
    return NextResponse.json({ error: 'You’ve sent several reports in a short time. We’re working on them — please wait a little before sending another.' }, { status: 429 })
  }

  const db = createAdminClient()
  try {
    const filed = await fileReport(v.value, {
      store: (r) => createReport(db, user.id, r),
      update: (ref, patch) => updateReport(db, ref, patch),
      triage: (r) => triageReport(r),
      dispatch: (a) => dispatchSelfFix(a),
      notifyOwner: (subject, lines) => emailOwner(subject, lines, { label: 'Open the report', url: 'https://docs2video.com/admin' }),
      mayTriage: hour === 'allowed' && day === 'allowed',
    })
    return NextResponse.json(view({ ref: filed.ref, status: filed.status, triage_summary: filed.summary, resolution_note: null }))
  } catch (err) {
    console.error('[support] report failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'We couldn’t send that. Please try again in a minute.' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  const ref = new URL(request.url).searchParams.get('ref')
  const db = createAdminClient()
  const row = ref ? (isRef(ref) ? await reportByRef(db, ref) : null) : await latestReportFor(db, user.id)
  if (!row || row.user_id !== user.id) return NextResponse.json({ report: null })
  return NextResponse.json(view(row))
}

function view(row: Pick<ReportRow, 'ref' | 'status' | 'triage_summary' | 'resolution_note'>) {
  const status = row.status as ReportStatus
  const note = status === 'fixed' ? row.resolution_note : row.triage_summary
  return { report: { ref: row.ref, status, headline: statusHeadline(status), steps: statusSteps(status, note) } }
}
