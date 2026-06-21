import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '../../../../_lib/supabase/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'
import { OAUTH_STATE_COOKIE } from '../route'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

    if (error) {
      console.error('[stripe/oauth/callback] OAuth error:', error)
      return NextResponse.redirect(`${siteUrl}/settings?stripe_error=${encodeURIComponent(error)}`)
    }

    if (!code || !state) {
      return NextResponse.redirect(`${siteUrl}/settings?stripe_error=missing_params`)
    }

    // --- CSRF + identity verification (audit B2) ---
    // 1) The `state` must match the per-session nonce cookie set in /oauth.
    // 2) There MUST be an authenticated session; tokens are written to THAT
    //    user, never to an id taken from the query string. This prevents an
    //    attacker from binding their Stripe account to a victim's profile.
    const cookieStore = await cookies()
    const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value
    if (!expectedState || expectedState !== state) {
      console.error('[stripe/oauth/callback] state mismatch (possible CSRF)')
      return NextResponse.redirect(`${siteUrl}/settings?stripe_error=invalid_state`)
    }

    const authed = await createClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) {
      return NextResponse.redirect(`${siteUrl}/settings?stripe_error=not_authenticated`)
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://connect.stripe.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_secret: process.env.STRIPE_SECRET_KEY!,
      }),
    })

    const tokenData = await tokenResponse.json()

    if (tokenData.error) {
      console.error('[stripe/oauth/callback] Token exchange error:', tokenData.error)
      return NextResponse.redirect(`${siteUrl}/settings?stripe_error=${encodeURIComponent(tokenData.error_description ?? tokenData.error)}`)
    }

    const stripeUserId = tokenData.stripe_user_id
    const accessToken = tokenData.access_token

    if (!stripeUserId) {
      return NextResponse.redirect(`${siteUrl}/settings?stripe_error=no_account_id`)
    }

    // Save to the AUTHENTICATED user's profile only. We persist only the
    // connected-account id and use the platform key + Stripe-Account header for
    // charges; the raw access token is a live secret we don't need (audit LOW).
    void accessToken
    const supabase = createAdminClient()
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ stripe_user_id: stripeUserId })
      .eq('id', user.id)

    if (updateError) {
      console.error('[stripe/oauth/callback] DB update error:', updateError)
      return NextResponse.redirect(`${siteUrl}/settings?stripe_error=save_failed`)
    }

    const ok = NextResponse.redirect(`${siteUrl}/settings?stripe_connected=true`)
    ok.cookies.delete(OAUTH_STATE_COOKIE)
    return ok
  } catch (err: unknown) {
    console.error('[stripe/oauth/callback] Error:', err)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    return NextResponse.redirect(`${siteUrl}/settings?stripe_error=unknown`)
  }
}
