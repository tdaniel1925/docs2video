import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createOAuthState, OAUTH_NONCE_COOKIE, nonceCookieOptions } from '../../../_lib/oauth-state'
import { googleConfigured } from '../../../_lib/email-connections'
export const maxDuration = 30

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001'
  if (!user) return NextResponse.redirect(new URL('/login', siteUrl))
  if (!googleConfigured()) return NextResponse.redirect(`${siteUrl}/settings?tab=integrations&email_error=google_not_configured`)

  // Signed, expiring state tied to this user + a nonce cookie on this browser
  // (see oauth-state.ts). The callback checks all of it before saving.
  const { state, nonce } = createOAuthState(user.id, 'google')

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: `${siteUrl}/api/auth/google/callback`,
    scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email',
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
  res.cookies.set(OAUTH_NONCE_COOKIE, nonce, nonceCookieOptions())
  return res
}
