import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { isSafePublicUrl, fetchPage, extractColors, extractLogoUrl, extractFonts } from '../../_lib/brand-scraper'

// =============================================================================
// Read a website's BRAND for the Style step.
//
// The user pastes their site (e.g. jordyn.app) on the Look step and we pull the
// things that make a design look like theirs: the main colours (to tint it), the
// fonts they use, and their logo. Colours/fonts feed the design as art direction;
// the logo comes back as a real image the user can drop into their images box —
// we never auto-place someone's logo, we hand it to them.
//
// SSRF-guarded: the URL is a stranger's, so every fetch (and redirect hop) is
// checked against the same allow-rules the chat scraper uses.
// =============================================================================

export const runtime = 'nodejs'
export const maxDuration = 30

function normUrl(raw: string): string | null {
  let u = String(raw || '').trim()
  if (!u) return null
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  try { const p = new URL(u); return (p.protocol === 'http:' || p.protocol === 'https:') ? p.toString() : null }
  catch { return null }
}

// Bring the logo back as a data URL so the browser can show it and store it with
// the other images — no second round-trip, and it survives to the generator.
async function logoAsDataUrl(logoUrl: string): Promise<string | null> {
  try {
    if (!(await isSafePublicUrl(logoUrl))) return null
    const res = await fetch(logoUrl, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return null
    const type = res.headers.get('content-type') || 'image/png'
    // Only real raster/vector image types; never HTML dressed up as an image.
    if (!/^image\//i.test(type)) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (!buf.length || buf.length > 3_000_000) return null // sanity + storage cap
    return `data:${type};base64,${buf.toString('base64')}`
  } catch { return null }
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await req.json().catch(() => null) as { url?: string } | null
  const url = normUrl(body?.url ?? '')
  if (!url) return NextResponse.json({ error: 'That doesn’t look like a web address.' }, { status: 400 })

  if (!(await isSafePublicUrl(url))) {
    return NextResponse.json({ error: 'I can’t read that address.' }, { status: 400 })
  }
  const html = await fetchPage(url)
  if (!html) {
    return NextResponse.json({ error: 'I couldn’t open that page — check the address and try again.' }, { status: 502 })
  }

  const colors = extractColors(html).slice(0, 3)
  const fonts = extractFonts(html).slice(0, 2)
  const rawLogo = extractLogoUrl(html, url)
  const logoDataUrl = rawLogo ? await logoAsDataUrl(rawLogo) : null

  return NextResponse.json({
    colors,
    fonts,
    logoDataUrl,          // null if none found or unreadable
    foundSomething: Boolean(colors.length || fonts.length || logoDataUrl),
  })
}
