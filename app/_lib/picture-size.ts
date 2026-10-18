// =============================================================================
// SMALL PICTURES FOR SMALL BOXES.
//
// Card and scene pictures are the full 1920-wide stills (~350 KB each). A
// Library card is ~320 px wide, so on a slow phone most of every picture was
// thrown away after downloading it (audit 2026-10-09). Pictures in our own
// Supabase storage can be asked for at a smaller width through Supabase's
// image resizer (/render/image/, measured: 349 KB → 113 KB as PNG at 480 px,
// smaller again as WebP, which browsers get automatically).
//
// Anything that isn't a public picture in our storage is left exactly as it
// is. The card falls back to the original address if a resized one fails.
// Pure, so a test can check it.
// =============================================================================

const OBJECT_PATH = '/storage/v1/object/public/'
const RENDER_PATH = '/storage/v1/render/image/public/'

/** Our Supabase project's host (public env, the same in browser and server). */
function storageHost(): string | null {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    return url ? new URL(url).host : null
  } catch {
    return null
  }
}

/** The same picture at `width` px wide, or the address unchanged when it
 *  can't be resized (not ours, not public, not a still picture). */
export function sizedPicture(url: string | null | undefined, width: number, host: string | null = storageHost()): string | null {
  if (!url) return null
  let u: URL
  try { u = new URL(url) } catch { return url }
  if (!host || u.host !== host || !u.pathname.startsWith(OBJECT_PATH)) return url
  if (!/\.(png|jpe?g|webp)$/i.test(u.pathname)) return url
  u.pathname = RENDER_PATH + u.pathname.slice(OBJECT_PATH.length)
  u.searchParams.set('width', String(Math.round(width)))
  u.searchParams.set('quality', '70')
  return u.toString()
}

/** srcset for a card picture: 320 / 480 / 640 wide (null when it can't be resized). */
export function pictureSrcSet(url: string | null | undefined, widths: number[] = [320, 480, 640], host: string | null = storageHost()): string | null {
  if (!url) return null
  const first = sizedPicture(url, widths[0], host)
  if (!first || first === url) return null
  return widths.map((w) => `${sizedPicture(url, w, host)} ${w}w`).join(', ')
}
