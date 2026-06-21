import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '../../../_lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 30

// Name of the httpOnly cookie that binds the OAuth `state` nonce to this
// browser session. Verified in the callback (audit B2: state was the raw,
// guessable user id with no CSRF protection → payout takeover).
export const OAUTH_STATE_COOKIE = 'stripe_oauth_state'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientId = process.env.STRIPE_CLIENT_ID
    if (!clientId) {
      return NextResponse.json({ error: 'Stripe client ID not configured' }, { status: 500 })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const redirectUri = `${siteUrl}/api/stripe/oauth/callback`

    // Random, unguessable CSRF nonce — NOT the user id. The callback must see
    // BOTH a matching cookie AND an authenticated session for the same user.
    const state = randomBytes(32).toString('hex')

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: 'read_write',
      redirect_uri: redirectUri,
      state,
    })

    const res = NextResponse.redirect(`https://connect.stripe.com/oauth/authorize?${params.toString()}`)
    res.cookies.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: siteUrl.startsWith('https'),
      sameSite: 'lax',
      path: '/',
      maxAge: 600, // 10 minutes to complete the flow
    })
    return res
  } catch (err: unknown) {
    console.error('[stripe/oauth] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
