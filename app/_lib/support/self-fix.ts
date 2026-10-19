import { createHmac, timingSafeEqual } from 'crypto'
import { hasSubstance } from './report-rules'

/*
 * THE SELF-FIX PIPELINE, app side — ported from Jordyn (lib/self-fix.ts,
 * .github/workflows/self-fix.yml), owner 2026-10-19.
 *
 *   1. A bug report is stored and triaged (a bug, by Claude).
 *   2. dispatchSelfFix fires a GitHub repository_dispatch ("support-report")
 *      on tdaniel1925/docs2video. The self-fix workflow runs Claude Code
 *      (Opus 5.5), which investigates and changes code but never commits.
 *   3. The WORKFLOW — not the agent — runs the type check and the full test
 *      suite. If either fails, an issue is opened and nothing is pushed.
 *   4. If they pass, it opens a pull request (branch self-fix/<ref>).
 *      Nothing reaches main without the owner's merge, unless the owner has
 *      turned on auto-ship (repo variable SELF_FIX_AUTO_SHIP=on), and even
 *      then only for low-impact fixes (scripts/self-fix-risk.mjs). Auto-ship
 *      is OFF by default here. In Jordyn it is on unless switched off.
 *   5. The workflow calls back: /api/support/self-fix/pr-opened (the person
 *      sees "Checked", the owner gets an email), and after a merge,
 *      /api/support/self-fix/resolve (the person sees "Fixed and live").
 *      Callbacks are signed with an HMAC over CRON_SECRET, one purpose each.
 *
 * Filing a report must never break because CI wiring is absent: with no
 * GITHUB_DISPATCH_TOKEN the dispatch quietly skips and a person looks.
 */

export const SELF_FIX_REPO = 'tdaniel1925/docs2video'
const DISPATCH_URL = `https://api.github.com/repos/${SELF_FIX_REPO}/dispatches`

export type SelfFixReport = { ref: string; description: string; summary?: string | null; pageUrl?: string | null }
export type Fetch = typeof fetch

let warnedNoToken = false
export function __resetSelfFixWarnLatch() { warnedNoToken = false }

/** Start a self-fix run. The payload is the ref and the (already redacted)
 *  report — never an email, a user id or a screenshot. Never throws. */
export async function dispatchSelfFix(report: SelfFixReport, doFetch: Fetch = fetch): Promise<boolean> {
  const token = process.env.GITHUB_DISPATCH_TOKEN
  if (!token) {
    if (!warnedNoToken) { warnedNoToken = true; console.warn('[self-fix] GITHUB_DISPATCH_TOKEN not set — reports are stored, no agent is started.') }
    return false
  }
  if (!hasSubstance(report.description)) return false
  const body = [
    report.description,
    report.summary ? `\nTriage: ${report.summary}` : '',
    report.pageUrl ? `\nPage: ${report.pageUrl}` : '',
  ].join('')
  try {
    const res = await doFetch(DISPATCH_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'support-report',
        client_payload: { ref: report.ref, title: (report.summary || report.description).slice(0, 90), body, filed_at: new Date().toISOString() },
      }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) { console.warn(`[self-fix] dispatch for ${report.ref} answered ${res.status}`); return false }
    return true
  } catch (err) {
    console.warn(`[self-fix] dispatch for ${report.ref} failed:`, err instanceof Error ? err.message : err)
    return false
  }
}

/* ── Signed callbacks from the workflow ──────────────────────────────────
 * The workflow computes the same digest in bash:
 *   printf '%s' "d2v-self-fix-pr:v1|$REF" | openssl dgst -sha256 -hmac "$CRON_SECRET" -r
 * A token for one purpose never opens the other door. */
const PR_PURPOSE = 'd2v-self-fix-pr:v1'
const RESOLVE_PURPOSE = 'd2v-self-fix-resolve:v1'
const FAILED_PURPOSE = 'd2v-self-fix-failed:v1'

function derive(purpose: string, ref: string): string {
  const s = process.env.CRON_SECRET
  if (!s) throw new Error('CRON_SECRET is not set')
  return createHmac('sha256', s).update(`${purpose}|${ref.trim().toUpperCase()}`).digest('hex')
}
function verify(purpose: string, ref: string, presented: string): boolean {
  if (!ref || !presented) return false
  try {
    const want = Buffer.from(derive(purpose, ref))
    const got = Buffer.from(String(presented).toLowerCase())
    return want.length === got.length && timingSafeEqual(want, got)
  } catch { return false }
}
export const selfFixPrToken = (ref: string) => derive(PR_PURPOSE, ref)
export const verifySelfFixPrToken = (ref: string, t: string) => verify(PR_PURPOSE, ref, t)
export const selfFixResolveToken = (ref: string) => derive(RESOLVE_PURPOSE, ref)
export const verifySelfFixResolveToken = (ref: string, t: string) => verify(RESOLVE_PURPOSE, ref, t)
export const selfFixFailedToken = (ref: string) => derive(FAILED_PURPOSE, ref)
export const verifySelfFixFailedToken = (ref: string, t: string) => verify(FAILED_PURPOSE, ref, t)

/** A PR link is only ever one of ours. */
export function isOurPrUrl(url: unknown): url is string {
  return typeof url === 'string' && new RegExp(`^https://github\\.com/${SELF_FIX_REPO.replace('/', '\\/')}/pull/\\d+$`).test(url)
}

/** Strip vitest's colours and control bytes from the summary line the workflow sends. */
export function cleanTestLine(raw: string | null | undefined): string {
  const ESC = String.fromCharCode(27)
  return String(raw ?? '')
    .replace(new RegExp(ESC + '\\[[0-9;:?]*[ -/]*[@-~]', 'g'), '')
    .replace(new RegExp('[\\x00-\\x1F\\x7F]', 'g'), ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
}
