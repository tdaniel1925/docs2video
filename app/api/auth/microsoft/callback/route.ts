import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'
import { createClient } from '../../../../_lib/supabase/server'
import { verifyOAuthState, OAUTH_NONCE_COOKIE, nonceCookieOptions } from '../../../../_lib/oauth-state'
import { saveOAuthConnection, microsoftConfigured } from '../../../../_lib/email-connections'
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

  if (!microsoftConfigured()) return done('email_error=outlook_not_configured')
  if (error || !code || !state) {
    return done(`email_error=${encodeURIComponent(error ?? 'no_code')}`)
  }

  // The state must be ours (signed), fresh, started in THIS browser, and the
  // signed-in user must be the one who started it. Nothing is changed in the
  // database unless all of that holds.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const check = verifyOAuthState(state, {
    provider: 'microsoft',
    cookieNonce: request.cookies.get(OAUTH_NONCE_COOKIE)?.value,
    sessionUserId: user?.id ?? null,
  })
  if (!check.ok) {
    console.warn('[microsoft-oauth] rejected state:', check.reason)
    return done(`email_error=${check.reason === 'expired' ? 'link_expired' : 'invalid_state'}`)
  }
  const userId = check.payload.u

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        code,
        redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
        grant_type: 'authorization_code',
        scope: 'Mail.Send Mail.ReadWrite User.Read offline_access',
      }),
    })

    const tokens = await tokenRes.json()
    if (tokens.error || !tokens.access_token) {
      return done(`email_error=${encodeURIComponent(tokens.error ?? 'token_exchange_failed')}`)
    }

    // Get user's email from Microsoft Graph
    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const msProfile = await profileRes.json()
    const emailAddress = msProfile.mail ?? msProfile.userPrincipalName ?? 'unknown'

    // Save first, then remove the old Outlook connection (inside the helper),
    // so a failed save never leaves the user with no connection. Tokens are
    // encrypted at rest.
    await saveOAuthConnection(createAdminClient(), {
      userId,
      provider: 'microsoft',
      emailAddress,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresInSeconds: tokens.expires_in,
    })

    return done('email_connected=microsoft')
  } catch (err) {
    console.error('[microsoft-oauth] Error:', err instanceof Error ? err.message : err)
    return done('email_error=token_exchange_failed')
  }
}
