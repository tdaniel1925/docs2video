/**
 * DB-backed app settings / feature flags. Read at request time so an admin
 * toggle takes effect immediately (no redeploy), with a short in-process cache
 * to avoid a DB round-trip on every request. The admin writer invalidates it.
 *
 * Service-role only (createAdminClient) — app_settings has RLS on and no public
 * policies, so it's never client-readable.
 */
import { createAdminClient } from './supabase/admin'

// ('video_render_target' removed 2026-07-01 — Lambda path deleted, VPS only.)
export type AppSettingKey = 'video_engine_v3' | 'video_style'

const TTL_MS = 30_000
type CacheEntry = { value: string | null; at: number }
const cache = new Map<string, CacheEntry>()

/** Raw string value of a setting, or null if unset. Cached for TTL_MS. */
export async function getSetting(key: AppSettingKey): Promise<string | null> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value
  try {
    const admin = createAdminClient()
    const { data } = await admin.from('app_settings').select('value').eq('key', key).single()
    const value = data?.value ?? null
    cache.set(key, { value, at: Date.now() })
    return value
  } catch {
    // On any DB error, fall back to the cached value if we have one, else null.
    return hit?.value ?? null
  }
}

/** Boolean flag read. Treats 'true' (case-insensitive) as true; everything else false. */
export async function getFlag(key: AppSettingKey): Promise<boolean> {
  const v = await getSetting(key)
  return (v ?? '').toLowerCase() === 'true'
}

/** Write a setting (admin only — caller must already have authorized). */
export async function setSetting(key: AppSettingKey, value: string, updatedBy?: string): Promise<void> {
  const admin = createAdminClient()
  await admin.from('app_settings').upsert(
    { key, value, updated_at: new Date().toISOString(), ...(updatedBy ? { updated_by: updatedBy } : {}) },
    { onConflict: 'key' }
  )
  cache.set(key, { value, at: Date.now() }) // keep cache coherent immediately
}

/** Drop the cache (used after a write from a different instance, optional). */
export function invalidateSettingsCache(): void {
  cache.clear()
}
