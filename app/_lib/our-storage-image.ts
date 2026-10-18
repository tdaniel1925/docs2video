/**
 * Read a picture the app itself stored (Supabase Storage), never anything else.
 *
 * Routes that take a slide picture's web address from the browser (the older
 * scene editor's per-slide AI edit, its Save & Regenerate) must not fetch
 * whatever address a user sends — that would let anyone make our server call
 * private or internal addresses. Only our own project's storage is allowed:
 *   https://<our-project>.supabase.co/storage/v1/object/(public|sign)/...
 * Redirects are refused (a storage address can't bounce us elsewhere), the
 * size is capped, and the bytes must really be a PNG, JPEG or WebP picture.
 *
 * Kept free of other app imports so it can be tested on its own.
 */

export const MAX_SLIDE_IMAGE_BYTES = 20 * 1024 * 1024

export class ForeignImageError extends Error {
  constructor(message = 'That picture is not one of ours.') {
    super(message)
    this.name = 'ForeignImageError'
  }
}

/** True only for an https address on our own Supabase project's storage. */
export function isOurStorageUrl(raw: unknown, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL): boolean {
  if (typeof raw !== 'string' || !supabaseUrl) return false
  let url: URL
  let ours: URL
  try {
    url = new URL(raw)
    ours = new URL(supabaseUrl)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  if (url.username || url.password) return false
  if (url.port && url.port !== '443') return false
  if (url.hostname.toLowerCase() !== ours.hostname.toLowerCase()) return false
  return /^\/storage\/v1\/object\/(public|sign)\/[^/]+\/.+/.test(url.pathname)
}

/** The picture type from its first bytes, or null when it is not a picture we take. */
export function sniffImageType(buf: Uint8Array): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return 'image/webp'
  return null
}

/**
 * Download a picture from our storage. Throws ForeignImageError for any other
 * address (before any request is made), and a plain Error when the download
 * fails or the file is not a picture.
 */
export async function fetchOurStorageImage(
  raw: string,
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<{ data: Buffer; mimeType: 'image/png' | 'image/jpeg' | 'image/webp' }> {
  if (!isOurStorageUrl(raw)) throw new ForeignImageError()
  const doFetch = opts.fetchImpl ?? fetch
  const res = await doFetch(raw, { redirect: 'error', signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000) })
  if (!res.ok) throw new Error(`Could not download the slide picture (${res.status})`)
  const len = Number(res.headers.get('content-length') || 0)
  if (len > MAX_SLIDE_IMAGE_BYTES) throw new Error('The slide picture is too large')
  const data = Buffer.from(await res.arrayBuffer())
  if (data.length > MAX_SLIDE_IMAGE_BYTES) throw new Error('The slide picture is too large')
  const mimeType = sniffImageType(data)
  if (!mimeType) throw new Error('The slide file is not a picture')
  return { data, mimeType }
}
