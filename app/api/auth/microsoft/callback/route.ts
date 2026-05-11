import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'

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
    if (tokens.error) {
      return NextResponse.redirect(`${siteUrl}/settings?email_error=${tokens.error}`)
    }

    // Get user's email from Microsoft Graph
    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const msProfile = await profileRes.json()
    const emailAddress = msProfile.mail ?? msProfile.userPrincipalName ?? 'unknown'

    // Save to database
    const admin = createAdminClient()
    const userId = state

    // Remove existing Microsoft connection for this user
    await admin.from('email_connections').delete().eq('user_id', userId).eq('provider', 'microsoft')

    // Insert new connection
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    await admin.from('email_connections').insert({
      user_id: userId,
      provider: 'microsoft',
      email_address: emailAddress,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt,
      is_default: true,
    })

    return NextResponse.redirect(`${siteUrl}/settings?email_connected=microsoft`)
  } catch (err) {
    console.error('[microsoft-oauth] Error:', err)
    return NextResponse.redirect(`${siteUrl}/settings?email_error=token_exchange_failed`)
  }
}
