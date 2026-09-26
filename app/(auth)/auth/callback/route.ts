import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { finishEmailLinkSignIn } from '../../../_lib/auth-finish'
import { safeNextPath } from '../../../_lib/safe-redirect'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // WHERE TO LAND AFTER LOGIN — but never off this site (see safe-redirect.ts).
  const next = safeNextPath(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await finishEmailLinkSignIn(user)
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.warn('[auth/callback] code exchange failed:', error.message)
  }

  // A password-reset link that failed (expired, used twice, or opened on a
  // different device/browser than the one that asked for it) goes back to the
  // reset form with an explanation; everything else to the login page.
  const reason = searchParams.get('error_code') || 'auth_failed'
  if (next.startsWith('/reset-password')) {
    return NextResponse.redirect(`${origin}/forgot-password?error=${encodeURIComponent(reason)}`)
  }
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`)
}
