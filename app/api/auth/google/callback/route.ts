import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'
export const maxDuration = 30

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // user ID
  const error = searchParams.get('error')

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001'

  if (error || !code || !state) {
    return NextResponse.redirect(`${siteUrl}/settings?email_error=${error ?? 'no_code'}`)
  }

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
    if (tokens.error) {
      return NextResponse.redirect(`${siteUrl}/settings?email_error=${tokens.error}`)
    }

    // Get user's email from Google userinfo API
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const userInfo = await userInfoRes.json()
    const emailAddress = userInfo.email ?? 'unknown'

    // Save to database
    const admin = createAdminClient()
    const userId = state

    // Remove existing Google connection for this user
    await admin.from('email_connections').delete().eq('user_id', userId).eq('provider', 'google')

    // Insert new connection
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    await admin.from('email_connections').insert({
      user_id: userId,
      provider: 'google',
      email_address: emailAddress,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt,
      is_default: true,
    })

    return NextResponse.redirect(`${siteUrl}/settings?tab=integrations&email_connected=google`)
  } catch (err) {
    console.error('[google-oauth] Error:', err)
    return NextResponse.redirect(`${siteUrl}/settings?email_error=token_exchange_failed`)
  }
}
