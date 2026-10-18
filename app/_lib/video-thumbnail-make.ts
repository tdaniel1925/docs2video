import { execFile } from 'child_process'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  THUMB_H, THUMB_W, coverPlan, sceneChoices, thumbMeta, thumbPaths, withThumbMeta, isStill,
  type ThumbMeta,
} from './video-thumbnail'

/*
 * MAKING A VIDEO'S THUMBNAIL (the rules are in video-thumbnail.ts).
 *
 * makeCover: the cover as a 1280×720 JPEG — the engine's drawn cover page, or
 * a frame from the middle of an older film's cover scene — uploaded beside
 * the film, set as thumbnail_url unless the person chose their own.
 * sweepThumbnails: the stuck-video cron's hook — every finished video of the
 * last 45 minutes without a made cover gets one (a few per run).
 * setCustom / useCover: the Change thumbnail dialog.
 *
 * Nothing here throws at the caller's page: a picture that can't be made
 * leaves the old one in place.
 */

export type ThumbRow = {
  id: string
  user_id: string
  status?: string | null
  video_url?: string | null
  thumbnail_url?: string | null
  slide_urls?: string[] | null
  slide_durations?: number[] | null
  draft_data?: unknown
}

export const THUMB_COLUMNS = 'id, user_id, status, video_url, thumbnail_url, slide_urls, slide_durations, draft_data'

/** Any picture → 1280×720 JPEG, cropped to fill (sharp is loaded only when used). */
export async function toThumbJpeg(input: Buffer): Promise<Buffer> {
  const sharp = (await import('sharp')).default
  return sharp(input, { failOn: 'none' })
    .rotate()
    .resize(THUMB_W, THUMB_H, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer()
}

/** The size of a picture, or null when it can't be read. */
export async function pictureSize(input: Buffer): Promise<{ width: number; height: number } | null> {
  try {
    const sharp = (await import('sharp')).default
    const m = await sharp(input, { failOn: 'none' }).metadata()
    return m.width && m.height ? { width: m.width, height: m.height } : null
  } catch { return null }
}

/** ffmpeg-static's binary. Not video.ts's getFfmpegPath: its process.cwd()
 *  path search made Turbopack trace the whole project into the thumbnail
 *  route, and the Vercel build then failed on Google fonts (2026-10-18).
 *  ffmpeg-static is a server external traced into every route (next.config.ts). */
function ffmpegBinary(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- the package's export IS the path
  const p = require('ffmpeg-static') as string | null
  if (!p) throw new Error('ffmpeg is not available')
  return p
}

/** One frame of a film (a URL) at `at` seconds, as PNG bytes. */
export function grabFrame(url: string, at: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    execFile(ffmpegBinary(), ['-v', 'error', '-ss', String(at), '-i', url, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', 'pipe:1'],
      { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024, timeout: 40_000 },
      (err, stdout) => {
        if (err) return reject(err)
        const buf = stdout as unknown as Buffer
        if (!buf || buf.length === 0) return reject(new Error('no frame'))
        resolve(buf)
      })
  })
}

async function fetchPicture(url: string): Promise<Buffer> {
  const r = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  if (!r.ok) throw new Error(`picture ${r.status}`)
  return Buffer.from(await r.arrayBuffer())
}

/** Upload to the public `videos` bucket; the URL carries a version so a new picture is never served from a cache. */
async function put(admin: SupabaseClient, path: string, jpeg: Buffer): Promise<string> {
  const { error } = await admin.storage.from('videos').upload(path, jpeg, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' })
  if (error) throw new Error(`upload: ${error.message}`)
  const url = admin.storage.from('videos').getPublicUrl(path).data.publicUrl
  return `${url}?v=${Date.now().toString(36)}`
}

async function save(admin: SupabaseClient, row: ThumbRow, meta: ThumbMeta, inUse: string | null): Promise<void> {
  const { error } = await admin.from('videos')
    .update({ draft_data: withThumbMeta(row.draft_data, meta), ...(inUse ? { thumbnail_url: inUse } : {}) })
    .eq('id', row.id).eq('user_id', row.user_id)
  if (error) throw new Error(`save: ${error.message}`)
}

/** Make (or remake) the cover. Returns its URL, or null when there is nothing to make it from. */
export async function makeCover(admin: SupabaseClient, row: ThumbRow, opts: { capturePage?: (url: string) => Promise<Buffer> } = {}): Promise<string | null> {
  const plan = coverPlan(row)
  if (plan.kind === 'none') return null
  // A presentation's first screen needs a browser: only the backfill script
  // has one. Without it, leave the presentation to its own poster.
  if (plan.kind === 'page' && !opts.capturePage) return null
  const raw = plan.kind === 'still' ? await fetchPicture(plan.url)
    : plan.kind === 'page' ? await opts.capturePage!(plan.url)
    : await grabFrame(plan.url, plan.at)
  const jpeg = await toThumbJpeg(raw)
  const cover = await put(admin, thumbPaths(row.user_id, row.id).cover, jpeg)
  const old = thumbMeta(row.draft_data)
  // The film's own poster is kept, once, in case the cover is ever unwanted.
  const frame = old.frame ?? (isStill(row.thumbnail_url) && !/_cover\.jpg/.test(row.thumbnail_url!) ? row.thumbnail_url! : null)
  const meta: ThumbMeta = { ...old, cover, frame, at: undefined }
  await save(admin, row, meta, meta.chosen === 'custom' && meta.custom ? null : cover)
  return cover
}

/** The person's own picture, or a scene's still, as the thumbnail. */
export async function setCustom(admin: SupabaseClient, row: ThumbRow, picture: Buffer, scene: number | null): Promise<string> {
  const jpeg = await toThumbJpeg(picture)
  const custom = await put(admin, thumbPaths(row.user_id, row.id).custom, jpeg)
  await save(admin, row, { ...thumbMeta(row.draft_data), custom, chosen: 'custom', scene, at: undefined }, custom)
  return custom
}

/** A scene's still (by index) as the thumbnail. */
export async function setScene(admin: SupabaseClient, row: ThumbRow, index: number): Promise<string> {
  const pick = sceneChoices(row).find((s) => s.index === index)
  if (!pick) throw new Error('That scene has no picture.')
  return setCustom(admin, row, await fetchPicture(pick.url), index)
}

/** Back to the cover (made now if it never was). */
export async function useCover(admin: SupabaseClient, row: ThumbRow): Promise<string | null> {
  const meta = thumbMeta(row.draft_data)
  if (!meta.cover) {
    const made = await makeCover(admin, { ...row, draft_data: withThumbMeta(row.draft_data, { ...meta, chosen: 'cover' }) })
    return made
  }
  await save(admin, row, { ...meta, chosen: 'cover', scene: null, at: undefined }, meta.cover)
  return meta.cover
}

/** How far back the sweep looks (it runs every 2 minutes with the ready sweep). */
export const THUMB_WINDOW_MS = 45 * 60 * 1000
/** Per cron run, so the run stays well inside its minute. */
export const THUMB_PER_RUN = 3

/** Finished videos of the last few minutes without a made cover: make one each. */
export async function sweepThumbnails(admin: SupabaseClient, deps: { now?: number; make?: typeof makeCover } = {}): Promise<number> {
  const since = new Date((deps.now ?? Date.now()) - THUMB_WINDOW_MS).toISOString()
  const { data, error } = await admin.from('videos')
    .select(THUMB_COLUMNS)
    .eq('status', 'completed')
    .is('draft_data->thumbnail->>cover', null)
    .or(`progress_updated_at.gt.${since},and(progress_updated_at.is.null,created_at.gt.${since})`)
    .limit(THUMB_PER_RUN)
  if (error || !data) return 0
  const make = deps.make ?? makeCover
  let made = 0
  for (const row of data as ThumbRow[]) {
    let ok = false
    try { ok = !!(await make(admin, row)) } catch (e) {
      console.error(`[thumbnail] ${row.id}:`, e instanceof Error ? e.message : e)
    }
    if (ok) { made++; continue }
    // Nothing to make it from, or it failed: noted (cover '') so the next run
    // moves on to other videos; the backfill script retries these.
    try { await save(admin, row, { ...thumbMeta(row.draft_data), cover: '', at: undefined }, null) } catch { /* next run retries */ }
  }
  return made
}
