import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'
import { createClient } from '../../../../_lib/supabase/server'
import { verifyOAuthState, OAUTH_NONCE_COOKIE, nonceCookieOptions } from '../../../../_lib/oauth-state'
import { saveOAuthConnection } from '../../../../_lib/email-connections'
export const maxDuration = 30

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001'

  // Every exit clears the one-time nonce cookie, so a state value can never be
  // replayed from this browser.
  const done = (qs: string) => {
    const res = NextResponse.redirect(`${siteUrl}/settings?tab=integrations&${qs}`)
    res.cookies.set(OAUTH_NONCE_COOKIE, '', nonceCookieOptions(0))
    return res
  }

  if (error || !code || !state) {
    return done(`email_error=${encodeURIComponent(error ?? 'no_code')}`)
  }

  // The state must be ours (signed), fresh, started in THIS browser, and the
  // signed-in user must be the one who started it. Nothing is changed in the
  // database unless all of that holds.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const check = verifyOAuthState(state, {
    provider: 'google',
    cookieNonce: request.cookies.get(OAUTH_NONCE_COOKIE)?.value,
    sessionUserId: user?.id ?? null,
  })
  if (!check.ok) {
    console.warn('[google-oauth] rejected state:', check.reason)
    return done(`email_error=${check.reason === 'expired' ? 'link_expired' : 'invalid_state'}`)
  }
  const userId = check.payload.u

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        redirect_uri: `${siteUrl}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    })

    const tokens = await tokenRes.json()
    if (tokens.error || !tokens.access_token) {
      return done(`email_error=${encodeURIComponent(tokens.error ?? 'token_exchange_failed')}`)
    }

    // Get user's email from Google userinfo API
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const userInfo = await userInfoRes.json()
    const emailAddress = userInfo.email ?? 'unknown'

    // Save first, then remove the old Google connection (inside the helper), so
    // a failed save never leaves the user with no connection. Tokens are
    // encrypted at rest.
    await saveOAuthConnection(createAdminClient(), {
      userId,
      provider: 'google',
      emailAddress,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresInSeconds: tokens.expires_in,
    })

    return done('email_connected=google')
  } catch (err) {
    console.error('[google-oauth] Error:', err instanceof Error ? err.message : err)
    return done('email_error=token_exchange_failed')
  }
}
