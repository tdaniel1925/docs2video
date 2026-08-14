import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { ensureCreditBalance } from '../../../_lib/credits'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // WHERE TO LAND AFTER LOGIN — but never off this site. `next` comes from the
  // URL, so a crafted link (?next=//evil.com or ?next=https://evil.com) would
  // otherwise bounce a just-authenticated user to an attacker's page. Only a
  // plain in-app path is allowed: it must start with a single "/" and not "//".
  const rawNext = searchParams.get('next') ?? '/dashboard'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Ensure user has a credit balance row
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('subscription_status, email')
            .eq('id', user.id)
            .single()
          await ensureCreditBalance(user.id, profile?.subscription_status || 'free')
          // Keep profiles.email in sync with the auth email (covers confirmed
          // email-change flows — send-email and notifications key off this).
          if (user.email && profile?.email !== user.email) {
            await supabase.from('profiles').update({ email: user.email }).eq('id', user.id)
          }
        } catch (e) {
          console.error('[auth/callback] Failed to ensure credit balance / sync email:', e)
        }
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
