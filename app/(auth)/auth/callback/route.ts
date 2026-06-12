import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { ensureCreditBalance } from '../../../_lib/credits'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

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
