/*
 * A VIDEO'S THUMBNAIL — one picture per video, the same everywhere it is shown
 * (owner, 2026-10-18: the Library's pictures were random crops — half-words
 * like "olicy, Plain E", empty boxes; approved option A: "the cover itself").
 *
 * WHAT IT IS. A 1280×720 JPEG of the video's cover, made once when the video
 * finishes and kept in the `videos` bucket beside the film:
 *   - explainer and template videos: the engine's own drawn cover page (the
 *     first scene still the render worker saves as <video>_slide_01.png) —
 *     the real design, not a frame caught mid-animation;
 *   - older engines: a frame from the film at the MIDDLE of the cover scene
 *     (its length is slide_durations[0]), never frame 0 (a fade from black).
 * The person can change it (⋯ › Change thumbnail): another scene's still, a
 * picture of their own, or back to the cover.
 *
 * WHERE IT IS KEPT — no new columns. `thumbnail_url` holds the picture in use,
 * so everything that already reads it (the watch page, its link preview, the
 * share email, the client page) shows it with no change. What it was made
 * from is noted in draft_data.thumbnail (ThumbMeta below), so "Use the cover
 * again" can go back and a sweep knows the cover is already made.
 *
 * WHICH PICTURE, in order: the person's own choice → the made cover → the
 * film's old poster frame → a still of the first scene → none (the card's
 * tidy placeholder, never a broken picture).
 *
 * Pure, so a test can check it; the making (fetch, ffmpeg, sharp, upload)
 * lives in video-thumbnail-make.ts.
 */

export const THUMB_W = 1280
export const THUMB_H = 720

/** What a video's thumbnail was made from — draft_data.thumbnail. */
export type ThumbMeta = {
  /** The made cover (1280×720 JPEG). */
  cover?: string | null
  /** The film's own poster, as the render saved it, before any cover was made. */
  frame?: string | null
  /** The person's choice: a scene's still or their own picture (1280×720 JPEG). */
  custom?: string | null
  /** Which one is in use. Absent = the cover (or the next best). */
  chosen?: 'cover' | 'custom'
  /** For a chosen scene: its 0-based index. Null for an uploaded picture. */
  scene?: number | null
  /** When it was last set. */
  at?: string
}

export type ThumbSource = {
  thumbnail_url?: string | null
  slide_urls?: string[] | null
  draft_data?: unknown
}

/** draft_data.thumbnail, if it looks like one. */
export function thumbMeta(draft: unknown): ThumbMeta {
  const t = (draft && typeof draft === 'object' ? (draft as { thumbnail?: unknown }).thumbnail : null)
  if (!t || typeof t !== 'object') return {}
  const m = t as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null)
  return {
    cover: str(m.cover),
    frame: str(m.frame),
    custom: str(m.custom),
    chosen: m.chosen === 'custom' || m.chosen === 'cover' ? m.chosen : undefined,
    scene: typeof m.scene === 'number' && Number.isInteger(m.scene) && m.scene >= 0 ? m.scene : null,
    at: str(m.at) ?? undefined,
  }
}

/** A still the render engine drew (a stored picture), as opposed to anything else. */
export function isStill(url: string | null | undefined): url is string {
  return !!url && /^https?:\/\//i.test(url) && /\.(png|jpe?g|webp)(\?|#|$)/i.test(url)
}

/** The explainer / template engine's own drawn pages: <user>/<video>_slide_NN.png. */
export function isEngineStill(url: string | null | undefined): url is string {
  return isStill(url) && /_slide_\d{2}\.png(\?|#|$)/i.test(url)
}

/**
 * THE ONE ANSWER to "what picture is this video?" — for the Library, and for
 * the share page, the email and the link preview when they adopt it.
 * Null means: show the placeholder.
 */
export function videoThumbnail(v: ThumbSource): string | null {
  const m = thumbMeta(v.draft_data)
  if (m.chosen === 'custom' && m.custom) return m.custom
  if (m.cover) return m.cover
  if (m.frame) return m.frame
  if (isStill(v.thumbnail_url)) return v.thumbnail_url
  const first = v.slide_urls?.[0]
  return isStill(first) ? first : null
}

/** Seconds into the film for an older engine's cover frame: late in the
 *  first scene, once its title has finished animating in (the middle caught
 *  titles half-typed, owner backfill check 2026-10-18), kept clear of the
 *  cut out. Never 0. */
export function coverFrameAt(durations: number[] | null | undefined): number {
  const d = durations?.[0]
  if (typeof d !== 'number' || !Number.isFinite(d) || d <= 0) return 4.5
  return Math.round(Math.min(Math.max(d * 0.8, 0.8), Math.max(0.8, d - 0.6)) * 100) / 100
}

export type CoverPlan =
  | { kind: 'still'; url: string }
  | { kind: 'frame'; url: string; at: number }
  | { kind: 'none'; why: string }

/** Where a video's cover comes from. */
export function coverPlan(v: { video_url?: string | null; slide_urls?: string[] | null; slide_durations?: number[] | null; status?: string | null }): CoverPlan {
  if (v.status && v.status !== 'completed') return { kind: 'none', why: 'not finished' }
  const first = v.slide_urls?.[0]
  if (isEngineStill(first)) return { kind: 'still', url: first }
  if (v.video_url) return { kind: 'frame', url: v.video_url, at: coverFrameAt(v.slide_durations) }
  if (isStill(first)) return { kind: 'still', url: first }
  return { kind: 'none', why: 'no film and no still' }
}

/** The scenes a person can pick from: every stored scene still, in order. */
export function sceneChoices(v: { slide_urls?: string[] | null }): { index: number; url: string }[] {
  return (v.slide_urls ?? []).map((url, index) => ({ index, url })).filter((s) => isStill(s.url))
}

/** Where the pictures are kept in the `videos` bucket. */
export function thumbPaths(userId: string, videoId: string): { cover: string; custom: string } {
  return { cover: `${userId}/${videoId}_cover.jpg`, custom: `${userId}/${videoId}_thumb_custom.jpg` }
}

/* ── An uploaded picture ─────────────────────────────────────────────────── */
export const UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const UPLOAD_MAX_BYTES = 4 * 1024 * 1024 // under Vercel's 4.5 MB request cap
export const UPLOAD_MIN_W = 640
export const UPLOAD_MIN_H = 360

/** Null when fine; otherwise what to tell the person. Dimensions are checked
 *  only once the picture has been read (pass them when known). */
export function uploadProblem(f: { type: string; size: number; width?: number; height?: number }): string | null {
  if (!(UPLOAD_TYPES as readonly string[]).includes(f.type)) return 'Use a JPG, PNG or WebP picture.'
  if (f.size <= 0) return 'That file is empty.'
  if (f.size > UPLOAD_MAX_BYTES) return 'That picture is over 4 MB. Use a smaller one.'
  if (f.width != null && f.height != null && (f.width < UPLOAD_MIN_W || f.height < UPLOAD_MIN_H)) {
    return `That picture is too small (${f.width}×${f.height}). Use one at least ${UPLOAD_MIN_W}×${UPLOAD_MIN_H}.`
  }
  return null
}

/** The backfill's plan for finished videos without a made cover (scripts/backfill-thumbnails.ts). */
export function backfillPlan(rows: { id: string; status?: string | null; video_url?: string | null; slide_urls?: string[] | null; slide_durations?: number[] | null; draft_data?: unknown }[]): {
  make: { id: string; plan: Exclude<CoverPlan, { kind: 'none' }> }[]
  skip: { id: string; why: string }[]
} {
  const make: { id: string; plan: Exclude<CoverPlan, { kind: 'none' }> }[] = []
  const skip: { id: string; why: string }[] = []
  for (const r of rows) {
    if (thumbMeta(r.draft_data).cover) { skip.push({ id: r.id, why: 'cover already made' }); continue }
    const plan = coverPlan(r)
    if (plan.kind === 'none') skip.push({ id: r.id, why: plan.why })
    else make.push({ id: r.id, plan })
  }
  return { make, skip }
}

/** draft_data with a new thumbnail note, everything else kept. */
export function withThumbMeta(draft: unknown, meta: ThumbMeta): Record<string, unknown> {
  const base = draft && typeof draft === 'object' && !Array.isArray(draft) ? (draft as Record<string, unknown>) : {}
  return { ...base, thumbnail: { ...meta, at: meta.at ?? new Date().toISOString() } }
}
