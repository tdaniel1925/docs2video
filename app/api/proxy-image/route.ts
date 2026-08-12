import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { isSafePublicUrl } from '../../_lib/brand-scraper'

// =============================================================================
// Fetch one image from another site, on the browser's behalf.
//
// WHY THIS HAS TO EXIST. A browser can display an image from another site but
// it cannot READ ONE — the pixels are off limits unless that site opts in, and
// almost none do. We need the actual bytes: to shrink them, to sort them, and
// to send them to the image model. So the fetch happens here.
//
// A SERVER THAT FETCHES A URL A STRANGER CHOSE IS A DOOR. Left open it can be
// pointed at things only this machine can reach — an internal address, a cloud
// metadata service — and made to hand back what it finds. Hence:
//
//   - signed in only, so it is never an open relay for the whole internet
//   - isSafePublicUrl on the address AND on every redirect it follows, because
//     a public URL that redirects to a private one defeats a single check
//   - images only, verified by the content type that comes back rather than by
//     the file extension, which is chosen by whoever wrote the link
//   - a size ceiling, so one enormous file cannot tie up the request
// =============================================================================

export const runtime = 'nodejs'
export const maxDuration = 30

/** Bigger than any real page image; past this something is wrong. */
const MOST_BYTES = 12 * 1024 * 1024

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const target = new URL(req.url).searchParams.get('url') ?? ''
  if (!target) return NextResponse.json({ error: 'No address' }, { status: 400 })

  try {
    // Redirects followed by hand so that EVERY hop is checked. `redirect:
    // 'follow'` would check the first address and then quietly go wherever it
    // was sent, which is the whole trick this is guarding against.
    let current = target
    for (let hop = 0; hop < 4; hop++) {
      if (!(await isSafePublicUrl(current))) {
        return NextResponse.json({ error: 'That address cannot be reached from here.' }, { status: 400 })
      }

      const res = await fetch(current, {
        redirect: 'manual',
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; Text2Art/1.0)' },
        signal: AbortSignal.timeout(15_000),
      })

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location')
        if (!loc) return NextResponse.json({ error: 'Broken redirect' }, { status: 502 })
        current = new URL(loc, current).toString()
        continue
      }
      if (!res.ok) return NextResponse.json({ error: `That image returned ${res.status}` }, { status: 502 })

      // THE CONTENT TYPE DECIDES, not the file name. A link ending in .png can
      // serve anything at all, and the name is chosen by whoever wrote it.
      const type = (res.headers.get('content-type') ?? '').split(';')[0].trim()
      if (!type.startsWith('image/')) {
        return NextResponse.json({ error: 'That address is not an image' }, { status: 415 })
      }

      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length > MOST_BYTES) {
        return NextResponse.json({ error: 'That image is too large' }, { status: 413 })
      }

      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'content-type': type,
          // Private: this is somebody else's picture fetched for one signed-in
          // person. It must not sit in a shared cache.
          'cache-control': 'private, max-age=300',
        },
      })
    }
    return NextResponse.json({ error: 'Too many redirects' }, { status: 502 })
  } catch (e) {
    console.error('[proxy-image]', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Could not fetch that image' }, { status: 502 })
  }
}
