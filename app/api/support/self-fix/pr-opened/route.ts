import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'
import { cleanTestLine, isOurPrUrl, verifySelfFixPrToken } from '../../../../_lib/support/self-fix'
import { emailOwner, reportByRef, updateReport } from '../../../../_lib/support/store'

export const runtime = 'nodejs'

/**
 * The self-fix workflow opened a pull request whose fix passed the type check
 * and the full test suite (verified by the workflow, not the agent). The
 * person sees "Checked"; the owner is emailed the PR to review and merge.
 * Signed: HMAC over CRON_SECRET, purpose d2v-self-fix-pr:v1|<ref>.
 */
export async function POST(req: Request) {
  let b: { ref?: unknown; pr_url?: unknown; test_line?: unknown; shipped?: unknown; token?: unknown } | null = null
  try { b = await req.json() } catch { /* empty */ }
  const ref = String(b?.ref ?? '').trim().toUpperCase()
  const prUrl = b?.pr_url
  if (!ref || !isOurPrUrl(prUrl)) return NextResponse.json({ error: 'ref and a docs2video pull request url are required' }, { status: 400 })
  if (!verifySelfFixPrToken(ref, String(b?.token ?? ''))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const row = await reportByRef(db, ref)
  if (!row) return NextResponse.json({ error: 'no such report' }, { status: 404 })
  if (row.status === 'fixed') return NextResponse.json({ ok: true, already: 'fixed' })

  await updateReport(db, ref, { status: 'checked', pr_url: prUrl })
  const tests = cleanTestLine(typeof b?.test_line === 'string' ? b.test_line : '')
  const shipped = b?.shipped === true
  await emailOwner(
    shipped ? `Self-fix shipped (low impact): #${ref}` : `A fix is waiting for your merge: #${ref}`,
    [
      row.triage_summary || row.description,
      tests ? `Verified by the workflow: ${tests}.` : 'The type check and the full test suite were verified by the workflow.',
      shipped ? 'It was small and touched nothing sensitive, so it merged on its own (auto-ship is on).' : 'Nothing ships until you merge it.',
    ],
    { label: shipped ? 'See the fix' : 'Review the fix', url: prUrl },
  )
  return NextResponse.json({ ok: true })
}
