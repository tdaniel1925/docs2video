import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'
import { verifySelfFixFailedToken } from '../../../../_lib/support/self-fix'
import { emailOwner, reportByRef, updateReport } from '../../../../_lib/support/store'

export const runtime = 'nodejs'

/**
 * The self-fix agent couldn't produce a fix that passed (or produced none):
 * the workflow opened an issue instead. The person sees "A person is
 * looking"; the owner is emailed the issue.
 * Signed: HMAC over CRON_SECRET, purpose d2v-self-fix-failed:v1|<ref>.
 */
export async function POST(req: Request) {
  let b: { ref?: unknown; issue_url?: unknown; token?: unknown } | null = null
  try { b = await req.json() } catch { /* empty */ }
  const ref = String(b?.ref ?? '').trim().toUpperCase()
  if (!ref) return NextResponse.json({ error: 'ref is required' }, { status: 400 })
  if (!verifySelfFixFailedToken(ref, String(b?.token ?? ''))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const row = await reportByRef(db, ref)
  if (!row) return NextResponse.json({ error: 'no such report' }, { status: 404 })
  if (row.status === 'fixed') return NextResponse.json({ ok: true, already: 'fixed' })

  await updateReport(db, ref, { status: 'needs_human' })
  const issue = typeof b?.issue_url === 'string' && /^https:\/\/github\.com\/tdaniel1925\/docs2video\/issues\/\d+$/.test(b.issue_url) ? b.issue_url : null
  await emailOwner(`Self-fix couldn’t fix #${ref} — a person is needed`, [
    row.triage_summary || row.description,
    'The agent’s change did not pass the type check or the tests, or it made no change. Nothing was pushed.',
  ], issue ? { label: 'Open the issue', url: issue } : undefined)
  return NextResponse.json({ ok: true })
}
