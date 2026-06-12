import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { getAffiliateByCode } from '../../../_lib/affiliate'

export const runtime = 'nodejs'

const COOKIE_NAME = 'd2v_ref'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 60 // 60 days

/**
 * GET /api/affiliate/r?ref=CODE
 * Affiliate referral link. Logs a click, drops a 60-day attribution cookie,
 * then redirects to the homepage. The cookie pre-fills the promo code at
 * signup/checkout; the Stripe promo code is the authoritative attribution.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = (url.searchParams.get('ref') || '').trim().toUpperCase()
  const origin = url.origin

  const res = NextResponse.redirect(`${origin}/?ref=${encodeURIComponent(code)}`)

  if (code && /^[A-Z0-9]{4,16}$/.test(code)) {
    const affiliate = await getAffiliateByCode(code)
    if (affiliate && affiliate.status === 'active') {
      res.cookies.set(COOKIE_NAME, code, {
        maxAge: COOKIE_MAX_AGE,
        httpOnly: false, // readable client-side so checkout can pre-fill
        sameSite: 'lax',
        path: '/',
      })
      // Best-effort click log.
      try {
        await createAdminClient().from('affiliate_clicks').insert({ affiliate_id: affiliate.id })
      } catch { /* non-fatal */ }
    }
  }

  return res
}
