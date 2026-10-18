import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createOAuthState, OAUTH_NONCE_COOKIE, nonceCookieOptions } from '../../../_lib/oauth-state'
import { microsoftConfigured } from '../../../_lib/email-connections'
export const maxDuration = 30

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001'
  if (!user) return NextResponse.redirect(new URL('/login', siteUrl))

  // Without the app registration Microsoft gets `client_id=undefined` and shows
  // the user a confusing error page. Send them back with a clear message.
  if (!microsoftConfigured()) return NextResponse.redirect(`${siteUrl}/settings?tab=integrations&email_error=outlook_not_configured`)

  // Signed, expiring state tied to this user + a nonce cookie on this browser
  // (see oauth-state.ts). The callback checks all of it before saving.
  const { state, nonce } = createOAuthState(user.id, 'microsoft')

  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
    scope: 'Mail.Send Mail.ReadWrite User.Read offline_access',
    response_mode: 'query',
    state,
  })

  const res = NextResponse.redirect(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`)
  res.cookies.set(OAUTH_NONCE_COOKIE, nonce, nonceCookieOptions())
  return res
}
