import type { User } from '@supabase/supabase-js'
import { createAdminClient } from './supabase/admin'
import { ensureCreditBalance } from './credits'
import { sendWelcomeEmailOnce } from './welcome-email'

/**
 * Housekeeping after a user comes back through an email link (sign-up
 * confirmation, password reset, email change) — shared by /auth/callback and
 * /auth/confirm. Never throws: the user must still land where they were going.
 */
export async function finishEmailLinkSignIn(user: User): Promise<void> {
  try {
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('subscription_status, email')
      .eq('id', user.id)
      .single()
    await ensureCreditBalance(user.id, profile?.subscription_status || 'free')
    // Keep profiles.email in sync with the CONFIRMED auth email (covers
    // email-change links — send-email and notifications key off this). Done
    // with the server key: users may not write profiles.email themselves.
    if (user.email && profile && profile.email !== user.email) {
      await admin.from('profiles').update({ email: user.email }).eq('id', user.id)
    }
  } catch (e) {
    console.error('[auth] Failed to ensure credit balance / sync email:', e instanceof Error ? e.message : e)
  }
  try {
    await sendWelcomeEmailOnce(user)
  } catch (e) {
    console.error('[auth] Welcome email failed:', e instanceof Error ? e.message : e)
  }
}
