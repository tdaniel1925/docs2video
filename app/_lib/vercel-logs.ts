/**
 * Optional live Vercel runtime-log fetch for the admin Logs view.
 *
 * Only active when VERCEL_API_TOKEN + VERCEL_PROJECT_ID are set. The central
 * error_logs table is the source of truth; this just augments it with raw
 * platform logs when a token is available. Returns [] (never throws) otherwise.
 *
 * Note: Vercel's log retention is short on lower plans (~1h of runtime logs),
 * so treat this as a "what's happening right now" view, not history.
 */

export interface VercelLogEntry {
  id: string
  level: string
  message: string
  source: string
  timestampMs: number
}

export function vercelLogsConfigured(): boolean {
  return !!(process.env.VERCEL_API_TOKEN && process.env.VERCEL_PROJECT_ID)
}

export async function fetchRecentVercelErrors(limit = 100): Promise<VercelLogEntry[]> {
  if (!vercelLogsConfigured()) return []
  const token = process.env.VERCEL_API_TOKEN!
  const projectId = process.env.VERCEL_PROJECT_ID!
  const teamPart = process.env.VERCEL_TEAM_ID ? `&teamId=${process.env.VERCEL_TEAM_ID}` : ''

  try {
    // Runtime logs for the project's latest production deployment.
    const depRes = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=1&target=production${teamPart}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) }
    )
    if (!depRes.ok) return []
    const depData = await depRes.json()
    const deploymentId = depData?.deployments?.[0]?.uid
    if (!deploymentId) return []

    const logRes = await fetch(
      `https://api.vercel.com/v3/deployments/${deploymentId}/events?builds=0&limit=${limit}${teamPart}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) }
    )
    if (!logRes.ok) return []
    const events = await logRes.json()
    const arr: any[] = Array.isArray(events) ? events : events?.events ?? []

    return arr
      .filter((e) => {
        const lvl = (e.level || e.type || '').toLowerCase()
        return lvl.includes('error') || lvl.includes('warn')
      })
      .slice(0, limit)
      .map((e) => ({
        id: String(e.id ?? e.requestId ?? Math.random()),
        level: e.level || e.type || 'error',
        message: typeof e.text === 'string' ? e.text : typeof e.message === 'string' ? e.message : JSON.stringify(e.payload ?? e),
        source: e.source || 'vercel',
        timestampMs: e.created ?? e.timestamp ?? 0,
      }))
  } catch {
    return []
  }
}
