import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '../../../_lib/supabase/server'
import { finishEmailLinkSignIn } from '../../../_lib/auth-finish'
import { safeNextPath } from '../../../_lib/safe-redirect'

/**
 * GET /auth/confirm?token_hash=…&type=signup|recovery|email_change|…&next=/…
 *
 * Email links that work on ANY device. The /auth/callback?code=… links rely on
 * a secret the browser that ASKED for the email kept in a cookie, so opening
 * the email on a phone (or another browser) failed with "auth_failed". A
 * token_hash is checked by Supabase directly, no cookie needed.
 *
 * Needs the Supabase email templates to link here, e.g. for "Reset password":
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
 * and for "Confirm signup":
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/setup-payment
 */
const TYPES: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email']

const DEFAULT_NEXT: Record<string, string> = {
  recovery: '/reset-password',
  signup: '/setup-payment',
  email: '/setup-payment',
  invite: '/reset-password',
  email_change: '/settings',
  magiclink: '/dashboard',
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeNextPath(searchParams.get('next'), (type && DEFAULT_NEXT[type]) || '/dashboard')

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await finishEmailLinkSignIn(user)
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.warn('[auth/confirm] verifyOtp failed:', error.message)
  }

  if (type === 'recovery') {
    return NextResponse.redirect(`${origin}/forgot-password?error=link_expired`)
  }
  return NextResponse.redirect(`${origin}/login?error=link_expired`)
}
