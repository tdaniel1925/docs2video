'use server'

import { redirect } from 'next/navigation'
import { createClient } from '../_lib/supabase/server'
import { createAdminClient } from '../_lib/supabase/admin'
import { siteUrl } from '../_lib/site-url'
import { sendWelcomeEmailOnce } from '../_lib/welcome-email'
import { getAffiliateByCode } from '../_lib/affiliate'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const referredBy = ((formData.get('referred_by') as string | null) ?? '').trim() || null
  const phone = (formData.get('phone') as string | null)?.trim() || null

  const { data, error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      // Where the confirmation link lands. Without this Supabase falls back to
      // the dashboard's "Site URL", which may not be this deployment.
      emailRedirectTo: `${siteUrl()}/auth/callback?next=/setup-payment`,
      data: {
        full_name: formData.get('full_name') as string,
        ...(referredBy ? { referred_by: referredBy } : {}),
        ...(phone ? { phone } : {}),
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  // Persist phone to the profile (the signup trigger may not map it) so SMS
  // view-notifications + the watch-page contact card work without re-entry.
  if (phone && data.user) {
    try {
      await createAdminClient().from('profiles').update({ phone }).eq('id', data.user.id)
    } catch { /* non-fatal */ }
  }

  // Referral attribution. `referrals` belongs to the affiliate program:
  // affiliate_id is an AFFILIATES row id (not a profile id) and the status
  // values are clicked / signed_up / converted / paid — the same shape
  // /api/affiliate/track-signup and the Stripe commission code write. The old
  // insert here used the referrer's PROFILE id and status 'pending', so it
  // was rejected by the table and every sign-up referral was lost.
  if (referredBy && data.user) {
    try {
      const admin = createAdminClient()
      const affiliate = await getAffiliateByCode(referredBy)
      let valid = false
      if (affiliate && affiliate.status === 'active' && affiliate.user_id !== data.user.id) {
        valid = true
        const { data: existing } = await admin.from('referrals').select('id')
          .eq('affiliate_id', affiliate.id).eq('referred_user_id', data.user.id).maybeSingle()
        if (!existing) {
          await admin.from('referrals').insert({
            affiliate_id: affiliate.id,
            referred_user_id: data.user.id,
            status: 'signed_up',
            signup_at: new Date().toISOString(),
          })
        }
      } else {
        // Older personal referral codes live on profiles.referral_code.
        const { data: referrer } = await admin.from('profiles').select('id')
          .eq('referral_code', referredBy).maybeSingle()
        valid = !!referrer && referrer.id !== data.user.id
      }
      if (valid) await admin.from('profiles').update({ referred_by: referredBy }).eq('id', data.user.id)
    } catch (e) {
      console.error('[signup] referral attribution failed:', e instanceof Error ? e.message : e)
    }
  }

  // If session exists, email confirmation is disabled — the address counts as
  // confirmed, so welcome now and go to card collection. Otherwise the welcome
  // email goes out when they click the confirmation link (auth callback).
  if (data.session && data.user) {
    await sendWelcomeEmailOnce(data.user).catch(err =>
      console.error('[signup] Welcome email failed:', err instanceof Error ? err.message : err)
    )
    redirect('/setup-payment')
  }

  return { success: 'Check your email to confirm your account.' }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient()

  // The link lands on /reset-password (outside the dashboard), so a user who
  // never finished onboarding can still reach the new-password form.
  const { error } = await supabase.auth.resetPasswordForEmail(
    formData.get('email') as string,
    { redirectTo: `${siteUrl()}/auth/callback?next=/reset-password` }
  )

  if (error) {
    return { error: error.message }
  }

  return { success: 'Check your email for a password reset link.' }
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }

  const newPassword = formData.get('password') as string
  if (!newPassword || newPassword.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }
  const confirm = formData.get('confirm_password')
  if (typeof confirm === 'string' && confirm !== newPassword) {
    return { error: 'The two passwords don’t match.' }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { error: error.message }
  return { success: 'Password updated.' }
}

export async function updateEmail(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }

  const newEmail = formData.get('email') as string
  if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(newEmail.trim())) {
    return { error: 'Please enter a valid email address.' }
  }

  // Supabase sends confirmation links to BOTH addresses; email isn't changed
  // until confirmed. The auth callback / confirm route mirrors it onto the
  // profile afterwards — here we just kick off the secure change.
  const { error } = await supabase.auth.updateUser(
    { email: newEmail.trim() },
    { emailRedirectTo: `${siteUrl()}/auth/callback?next=/settings` }
  )
  if (error) return { error: error.message }
  return { success: 'Check both your old and new inbox to confirm the change.' }
}
