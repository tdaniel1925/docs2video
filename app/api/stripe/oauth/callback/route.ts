import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state') // user_id
    const error = url.searchParams.get('error')

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

    if (error) {
      console.error('[stripe/oauth/callback] OAuth error:', error)
      return NextResponse.redirect(`${siteUrl}/settings?stripe_error=${encodeURIComponent(error)}`)
    }

    if (!code || !state) {
      return NextResponse.redirect(`${siteUrl}/settings?stripe_error=missing_params`)
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

    // Save to profiles
    const supabase = createAdminClient()
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        stripe_user_id: stripeUserId,
        stripe_access_token: accessToken,
      })
      .eq('id', state)

    if (updateError) {
      console.error('[stripe/oauth/callback] DB update error:', updateError)
      return NextResponse.redirect(`${siteUrl}/settings?stripe_error=save_failed`)
    }

    return NextResponse.redirect(`${siteUrl}/settings?stripe_connected=true`)
  } catch (err: unknown) {
    console.error('[stripe/oauth/callback] Error:', err)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    return NextResponse.redirect(`${siteUrl}/settings?stripe_error=unknown`)
  }
}
