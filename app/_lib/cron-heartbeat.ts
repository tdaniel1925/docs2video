import { createAdminClient } from './supabase/admin'
import { alertOps } from './ops-alert'

// =============================================================================
// "DID THE CRONS RUN?" (audit 2026-10-09).
//
// The scheduled jobs (stuck videos + refunds, credit-pack repair, emails…)
// can stop without anyone noticing — a bad deploy, a missing CRON_SECRET, a
// Vercel plan change. Each cron now stamps the time it last ran, and the
// 6-hourly health cron checks every stamp: a cron that hasn't run within its
// allowed gap emails Trent.
//
// Stamps live in the existing app_settings key/value table (key
// 'cron_heartbeat:<name>', value = ISO time) — no new table needed.
// =============================================================================

/** Every scheduled cron (vercel.json) and the longest gap that is still OK. */
export const CRON_MAX_GAP_HOURS: Record<string, number> = {
  'fix-stuck-videos': 1,          // every 2 min
  'reconcile-credit-packs': 3,    // hourly
  'system-health': 13,            // every 6 h
  'follow-ups': 26,               // daily
  'nurture': 26,
  'referral-prompt': 26,
  'cleanup-drafts': 26,
  'daily-digest': 26,
  'weekly-report': 24 * 7 + 2,    // weekly
}

const KEY_PREFIX = 'cron_heartbeat:'

/** Stamp "this cron ran now". Never throws. */
export async function recordCronRun(name: string, now: Date = new Date()): Promise<void> {
  try {
    const { error } = await createAdminClient()
      .from('app_settings')
      .upsert({ key: KEY_PREFIX + name, value: now.toISOString(), updated_at: now.toISOString() }, { onConflict: 'key' })
    if (error) console.error(`[cron-heartbeat] could not stamp ${name}:`, error.message)
  } catch (e) {
    console.error(`[cron-heartbeat] could not stamp ${name}:`, e instanceof Error ? e.message : e)
  }
}

export interface StaleCron { name: string; lastRun: string | null; maxGapHours: number }

/**
 * Which crons are overdue. Pure. `stamps` maps cron name → last ISO time.
 * A cron with no stamp at all is overdue only once `since` (when stamping
 * began) is longer ago than its allowed gap — so the first deploy doesn't
 * alert about crons that simply haven't had their first run yet.
 */
export function staleCrons(stamps: Record<string, string | null | undefined>, now: Date, since?: Date): StaleCron[] {
  const out: StaleCron[] = []
  for (const [name, maxGapHours] of Object.entries(CRON_MAX_GAP_HOURS)) {
    const last = stamps[name] ?? null
    const limitMs = maxGapHours * 60 * 60 * 1000
    if (!last) {
      if (since && now.getTime() - since.getTime() > limitMs) out.push({ name, lastRun: null, maxGapHours })
      continue
    }
    const t = Date.parse(last)
    if (!Number.isFinite(t) || now.getTime() - t > limitMs) out.push({ name, lastRun: last, maxGapHours })
  }
  return out
}

/**
 * Read all stamps and email Trent if any cron is overdue. Returns the overdue
 * list. The health cron's own first stamp marks when stamping began.
 */
export async function checkCronHeartbeats(now: Date = new Date()): Promise<StaleCron[]> {
  const { data, error } = await createAdminClient()
    .from('app_settings')
    .select('key, value')
    .like('key', `${KEY_PREFIX}%`)
  if (error) {
    await alertOps({ source: 'cron', stage: 'heartbeat', message: `Could not read the cron heartbeats: ${error.message}` })
    return []
  }
  const stamps: Record<string, string> = {}
  for (const r of (data || []) as { key: string; value: string | null }[]) {
    if (r.value) stamps[r.key.slice(KEY_PREFIX.length)] = r.value
  }
  // When did stamping start? The earliest stamp we have.
  const times = Object.values(stamps).map((v) => Date.parse(v)).filter(Number.isFinite)
  const since = times.length ? new Date(Math.min(...times)) : undefined
  const stale = staleCrons(stamps, now, since)
  if (stale.length) {
    await alertOps({
      source: 'cron', stage: 'heartbeat',
      message: `Scheduled jobs have stopped running: ${stale.map((s) => `${s.name} (last ran ${s.lastRun ?? 'never'}; should run at least every ${s.maxGapHours} h)`).join('; ')}. Check the Vercel cron settings and CRON_SECRET.`,
    })
  }
  return stale
}
