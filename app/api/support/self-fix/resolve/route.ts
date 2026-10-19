import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'
import { verifySelfFixResolveToken } from '../../../../_lib/support/self-fix'
import { emailReporter, reportByRef, updateReport } from '../../../../_lib/support/store'

export const runtime = 'nodejs'

/**
 * A self-fix PR was merged and the deploy has had time to land: the person
 * sees "Fixed and live" and gets an email. Called by self-fix-merged.yml.
 * Signed: HMAC over CRON_SECRET, purpose d2v-self-fix-resolve:v1|<ref>.
 * Never tells anyone twice.
 */
export async function POST(req: Request) {
  let b: { ref?: unknown; note?: unknown; token?: unknown } | null = null
  try { b = await req.json() } catch { /* empty */ }
  const ref = String(b?.ref ?? '').trim().toUpperCase()
  const note = String(b?.note ?? '').trim().slice(0, 300)
  if (!ref || !note) return NextResponse.json({ error: 'ref and note are required' }, { status: 400 })
  if (!verifySelfFixResolveToken(ref, String(b?.token ?? ''))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const row = await reportByRef(db, ref)
  if (!row) return NextResponse.json({ error: 'no such report' }, { status: 404 })
  if (row.status === 'fixed') return NextResponse.json({ error: 'already resolved' }, { status: 409 })

  const updated = await updateReport(db, ref, { status: 'fixed', resolution_note: note, resolved_at: new Date().toISOString() })
  if (updated) await emailReporter(db, updated, note)
  return NextResponse.json({ ok: true })
}
