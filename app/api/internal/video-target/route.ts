import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * TEMPORARY — is the video service address actually reaching production?
 *
 * `vercel env pull` reports VIDEO_ASSEMBLY_URL as empty after four different
 * ways of setting it, while the dashboard says it was written seconds ago. One
 * of those is lying and guessing which would be a bad way to migrate a service.
 *
 * This reports what the RUNNING app sees — the host only, never the full value,
 * and never any other variable. Delete once the answer is known.
 */
export async function GET() {
  const raw = (process.env.VIDEO_ASSEMBLY_URL || '').trim()
  let reachable: string | null = null
  if (raw) {
    try {
      const r = await fetch(`${raw.replace(/\/+$/, '')}/health`, { signal: AbortSignal.timeout(8000) })
      reachable = `${r.status}`
    } catch (e) {
      reachable = e instanceof Error ? e.message.slice(0, 80) : 'failed'
    }
  }
  return NextResponse.json({
    set: Boolean(raw),
    host: raw ? (() => { try { return new URL(raw).host } catch { return 'unparseable' } })() : null,
    health: reachable,
  })
}
