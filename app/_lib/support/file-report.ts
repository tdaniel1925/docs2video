import type { CleanReport, ReportStatus } from './report-rules'
import type { Triage } from './triage'
import type { ReportRow } from './store'

/*
 * FILING A REPORT, start to finish (owner, 2026-10-19), with every outside
 * call passed in so the tests drive it without Claude, GitHub or a database:
 *
 *   store it ("Got it") → Claude triages it →
 *     a bug           → the self-fix workflow is started ("Fixing it");
 *                       if it can't be started, a person looks
 *     a how-to        → the help assistant answers it ("Here's how")
 *     anything else   → a person looks, and the owner is emailed
 *
 * Nothing here merges, pushes or deploys anything. The workflow opens a pull
 * request; the owner's merge (or, only if the owner turns it on, low-impact
 * auto-ship) is what ships code.
 */

export type FileDeps = {
  store: (r: CleanReport) => Promise<ReportRow>
  update: (ref: string, patch: Record<string, unknown>) => Promise<ReportRow | null>
  triage: (r: CleanReport) => Promise<Triage>
  dispatch: (args: { ref: string; description: string; summary: string; pageUrl: string | null }) => Promise<boolean>
  notifyOwner: (subject: string, lines: string[]) => Promise<boolean>
  /** False when the person's AI allowance for reports is used up or can't be read: still stored, no AI. */
  mayTriage: boolean
}

export type Filed = { ref: string; status: ReportStatus; summary: string | null }

export async function fileReport(r: CleanReport, deps: FileDeps): Promise<Filed> {
  const row = await deps.store(r)
  const ref = row.ref

  if (!deps.mayTriage) {
    await deps.update(ref, { status: 'needs_human' })
    await deps.notifyOwner(`Report #${ref} needs a person`, [r.description, 'Not triaged: the report limit was reached or could not be checked.'])
    return { ref, status: 'needs_human', summary: null }
  }

  const t = await deps.triage(r)
  const summary = t.summary || null

  if (t.next === 'triaged') {
    // A bug: start the self-fix workflow. It opens a PR; it never merges on its own here.
    const started = await deps.dispatch({ ref, description: r.description, summary: t.summary, pageUrl: r.pageUrl })
    if (started) {
      await deps.update(ref, { status: 'fixing', kind: t.kind, triage_summary: summary, dispatched_at: new Date().toISOString() })
      return { ref, status: 'fixing', summary }
    }
    await deps.update(ref, { status: 'needs_human', kind: t.kind, triage_summary: summary })
    await deps.notifyOwner(`Bug report #${ref} needs a person`, [r.description, summary ? `Triage: ${summary}` : '', 'The self-fix workflow could not be started.'].filter(Boolean))
    return { ref, status: 'needs_human', summary }
  }

  if (t.next === 'answered') {
    await deps.update(ref, { status: 'answered', kind: t.kind, triage_summary: summary })
    return { ref, status: 'answered', summary }
  }

  await deps.update(ref, { status: 'needs_human', kind: t.kind, triage_summary: summary })
  await deps.notifyOwner(`Report #${ref} needs a person (${t.kind})`, [r.description, summary ? `Triage: ${summary}` : ''].filter(Boolean))
  return { ref, status: 'needs_human', summary }
}
