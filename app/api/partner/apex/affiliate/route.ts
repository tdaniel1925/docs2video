import { NextResponse } from 'next/server'
import { apexEnabled, verifyApexSignature, provisionApexAffiliate } from '@/app/_lib/apex'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * POST /api/partner/apex/affiliate — Apex-side lazy provisioning.
 *
 * Apex calls this the first time a rep requests their Docs2Video link (or in
 * a bulk seed). Body: { slug, email, name? } — the rep's Apex distributor
 * slug and account email. Signed with the shared APEX_WEBHOOK_SECRET
 * (HMAC-SHA256 hex of the raw body in x-webhook-signature).
 *
 * Response: { referral_code, link, created } — link is the rep's
 * docs2video.com/r/{slug} URL to surface in their back office.
 */
export async function POST(request: Request) {
  if (!apexEnabled()) {
    return NextResponse.json({ error: 'integration not configured' }, { status: 503 })
  }

  const raw = await request.text()
  if (!verifyApexSignature(raw, request.headers.get('x-webhook-signature'))) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  let body: { slug?: string; email?: string; name?: string }
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }
  if (!body.slug || !body.email) {
    return NextResponse.json({ error: 'slug and email required' }, { status: 400 })
  }

  try {
    const r = await provisionApexAffiliate({ slug: body.slug, email: body.email, name: body.name })
    return NextResponse.json({ referral_code: r.referralCode, link: r.link, created: r.created })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'provisioning failed'
    console.error('[apex] provisioning failed:', msg)
    // 409 for code conflicts (existing direct affiliate), 400 for bad input
    const status = msg.includes('belongs to an existing') ? 409 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}
