import { NextResponse } from 'next/server'
import { aiDailyGate } from '../../_lib/cardless-prep'
import { normalizeUrl } from '../../_lib/normalize-url'
import { createClient } from '../../_lib/supabase/server'
import { isSafePublicUrl, fetchPage, extractColors, extractLogoUrl, extractFonts, logoAsDataUrl } from '../../_lib/brand-scraper'

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

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  // Free AI step: counts toward the daily caps (no-card + every account), fail closed — audit 2026-10-09.
  const capped = await aiDailyGate(user.id)
  if (capped) return capped

  const body = await req.json().catch(() => null) as { url?: string } | null
  const url = normalizeUrl(body?.url) // no one has to type https:// (normalize-url.ts)
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
