import { createAdminClient } from '../../_lib/supabase/admin'

/*
 * CUSTOM GRAPHICS PICTURES, SIGNED ONCE FOR THE WHOLE PAGE.
 *
 * A saved graphic's address is /api/flyer-file/<id>: that route checks the
 * owner and redirects to a short-lived signed link (the bucket is private).
 * On a page of picture cards that meant one trip through our own server per
 * card — 18+ at once — and the browser's handful of connections to our site
 * were all busy, so pressing any link on the Library waited ~5 seconds.
 *
 * Instead the Library page asks once: one query for the designs' file paths
 * (only this person's), one batch call to sign them all. The pictures then
 * load straight from storage. Anything that fails keeps the old address, so
 * the worst case is the old (slow) behaviour, never a broken picture.
 */
const FLYER_FILE = /^\/api\/flyer-file\/([0-9a-f-]{36})$/i
const CHUNK = 200

export function flyerFileId(url: string | null | undefined): string | null {
  return url ? (FLYER_FILE.exec(url)?.[1] ?? null) : null
}

/** id → signed picture address, for every /api/flyer-file/<id> given. */
export async function signFlyerPictures(userId: string, urls: (string | null | undefined)[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const ids = [...new Set(urls.map(flyerFileId).filter((x): x is string => !!x))]
  if (ids.length === 0) return out
  try {
    const admin = createAdminClient()
    for (let i = 0; i < ids.length; i += CHUNK) {
      const { data: rows } = await admin
        .from('flyer_designs')
        .select('id, image_path')
        .eq('user_id', userId)
        .in('id', ids.slice(i, i + CHUNK))
      const withPath = (rows ?? []).filter((r): r is { id: string; image_path: string } => !!r.image_path)
      if (withPath.length === 0) continue
      // An hour is plenty for a page someone is looking at; a refresh signs again.
      const { data: signed } = await admin.storage
        .from('creation-assets')
        .createSignedUrls(withPath.map((r) => r.image_path), 3600)
      signed?.forEach((s, n) => { if (s?.signedUrl && !s.error) out.set(withPath[n].id, s.signedUrl) })
    }
  } catch {
    // Keep the old addresses (they still work, just slower).
  }
  return out
}
