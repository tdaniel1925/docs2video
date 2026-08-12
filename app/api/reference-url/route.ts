import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { isSafePublicUrl, fetchPage, extractColors, extractLogoUrl } from '../../_lib/brand-scraper'

// =============================================================================
// Point the app at a web page and let it go and look.
//
// WHY. "Here is what we look like" is a link, not a folder. A small business
// has a website with their logo, their photographs and their colours already on
// it, and asking them to save each one to disk and upload it is asking them to
// do a job they already did once. Paste the address instead.
//
// It comes back with CANDIDATES, never a decision. Everything it finds lands in
// the same tray as a dropped file, gets sorted the same way, and is thrown away
// with one click if it grabbed the wrong thing. A page has navigation icons,
// stock banners and somebody else's badges on it; picking automatically would
// be wrong often enough to be worse than useless.
//
// SAFETY IS NOT NEW HERE. isSafePublicUrl and fetchPage already guard against
// being pointed at something private — every redirect hop is re-checked, not
// just the first — because this is a server fetching a URL a stranger chose.
// Reused rather than rewritten for exactly that reason.
// =============================================================================

export const runtime = 'nodejs'
export const maxDuration = 60

/** How many pictures are worth offering. Beyond this it is a contact sheet. */
const MOST = 12

/** Junk that is on every page and is never what somebody meant. */
const NEVER = /sprite|icon|favicon|avatar|pixel|tracking|spacer|1x1|placeholder|badge|payment|visa|mastercard|paypal|app-?store|google-?play|facebook|twitter|instagram|linkedin|youtube|tiktok/i

/** Turn a possibly-relative src into an absolute one, or null if it is unusable. */
function absolute(src: string, base: string): string | null {
  try {
    if (src.startsWith('data:')) return null
    const u = new URL(src, base)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

/**
 * Every picture on the page worth offering, best first.
 *
 * "Best" means biggest, because the images somebody would recognise as theirs
 * are the hero shots and the product photography — while the noise is icons,
 * badges and payment logos. Where a size is declared we use it; where it is
 * not, position on the page is the tie-breaker.
 */
function findImages(html: string, base: string): string[] {
  const found: { url: string; score: number }[] = []
  const seen = new Set<string>()

  const add = (raw: string | undefined, score: number) => {
    if (!raw) return
    const url = absolute(raw.trim(), base)
    if (!url || seen.has(url) || NEVER.test(url)) return
    seen.add(url)
    found.push({ url, score })
  }

  // The share image, which is the one the site itself chose to represent it.
  // Ranked top for that reason alone.
  for (const m of html.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi)) {
    add(m[1], 10_000)
  }

  let order = 0
  for (const tag of html.match(/<img[^>]*>/gi) ?? []) {
    order++
    // srcset carries the big versions; take the last entry, which is the
    // largest by convention.
    const srcset = tag.match(/srcset=["']([^"']+)["']/i)?.[1]
    const fromSet = srcset?.split(',').pop()?.trim().split(/\s+/)[0]
    const src = fromSet || tag.match(/\bsrc=["']([^"']+)["']/i)?.[1] || tag.match(/data-src=["']([^"']+)["']/i)?.[1]

    const w = Number(tag.match(/\bwidth=["']?(\d+)/i)?.[1] ?? 0)
    const h = Number(tag.match(/\bheight=["']?(\d+)/i)?.[1] ?? 0)
    // A declared area where there is one; otherwise a middling score that
    // decays down the page, so the top of the page wins ties.
    const area = w && h ? w * h : Math.max(0, 4000 - order * 20)
    // Tiny declared sizes are decoration, whatever they are called.
    if (w && h && (w < 80 || h < 80)) continue
    add(src, area)
  }

  return found.sort((a, b) => b.score - a.score).slice(0, MOST).map((f) => f.url)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await req.json().catch(() => null) as { url?: string } | null
  let url = String(body?.url ?? '').trim()
  if (!url) return NextResponse.json({ error: 'No address given' }, { status: 400 })
  // People paste "northsideheating.com", not "https://northsideheating.com".
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`

  if (!(await isSafePublicUrl(url))) {
    return NextResponse.json({ error: 'That address cannot be reached from here.' }, { status: 400 })
  }

  const html = await fetchPage(url)
  if (!html) {
    return NextResponse.json({
      error: 'Could not read that page — it may be private, or blocking us. Save the images and drop them in instead.',
    }, { status: 502 })
  }

  const images = findImages(html, url)
  const logo = extractLogoUrl(html, url)
  // The logo goes first and is never dropped, even if the page put it in a
  // small header image — it is the single most useful thing on the page and
  // scoring by size would rank it below a stock banner.
  const ordered = logo ? [logo, ...images.filter((i) => i !== logo)] : images

  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim().slice(0, 80) ?? ''

  return NextResponse.json({
    url,
    title,
    images: ordered.slice(0, MOST),
    // Colours come free with the page and are what makes the designs feel
    // like theirs even when none of the pictures are used.
    colors: extractColors(html).slice(0, 6),
    logo,
  })
}
