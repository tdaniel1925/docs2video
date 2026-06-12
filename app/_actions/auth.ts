'use server'

import { redirect } from 'next/navigation'
import { createClient } from '../_lib/supabase/server'
import { createAdminClient } from '../_lib/supabase/admin'

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

  const referredBy = formData.get('referred_by') as string | null

  const { data, error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      data: {
        full_name: formData.get('full_name') as string,
        ...(referredBy ? { referred_by: referredBy } : {}),
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  // If referred, create referral record linking referrer to new user
  if (referredBy && data.user) {
    const admin = createAdminClient()
    const { data: referrer } = await admin
      .from('profiles')
      .select('id')
      .eq('referral_code', referredBy)
      .single()
    if (referrer) {
      await admin.from('referrals').insert({
        affiliate_id: referrer.id,
        referred_user_id: data.user.id,
        status: 'pending',
      })
      await admin.from('profiles').update({ referred_by: referredBy }).eq('id', data.user.id)
    }
  }

  // Welcome email — fire-and-forget, never block signup on it
  if (data.user?.email) {
    const fullName = (formData.get('full_name') as string | null)?.split(' ')[0] || 'there'
    sendWelcomeEmail(data.user.email, fullName).catch(err =>
      console.error('[signup] Welcome email failed:', err instanceof Error ? err.message : err)
    )
  }

  // If session exists, email confirmation is disabled — go to card collection
  if (data.session) {
    redirect('/setup-payment')
  }

  return { success: 'Check your email to confirm your account.' }
}

async function sendWelcomeEmail(email: string, firstName: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) return
  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: 'Docs2Video <support@docs2video.com>',
    to: email,
    subject: 'Welcome to Docs2Video — your first video is 3 steps away',
    html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:24px auto;background:#fff;border-radius:10px;overflow:hidden;">
  <tr><td style="background:#1B3A5C;padding:24px 32px;"><h1 style="margin:0;font-size:20px;font-weight:800;color:#fff;">Docs2Video</h1></td></tr>
  <tr><td style="padding:32px;">
    <h2 style="margin:0 0 16px;font-size:20px;color:#1a1a1a;">Welcome, ${firstName}!</h2>
    <p style="font-size:15px;line-height:1.7;color:#444;">You're set up to turn any document, website, or idea into a personalized client video. Here's all it takes:</p>
    <ol style="font-size:15px;line-height:2;color:#444;">
      <li><strong>Pick who it's for</strong> — choose a client or skip for a general video</li>
      <li><strong>Add your content</strong> — paste a URL, upload a file, or describe it</li>
      <li><strong>Generate</strong> — we write the script, design the slides, and narrate it</li>
    </ol>
    <p style="font-size:15px;line-height:1.7;color:#444;">Your first project is on us. Most people finish their first video in under five minutes.</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="https://docs2video.com/create/client" style="display:inline-block;background:#3BB5C8;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">Create your first video</a>
    </div>
    <p style="font-size:13px;color:#888;line-height:1.6;">Questions? Just reply to this email — we read every one.</p>
  </td></tr>
  <tr><td style="background:#fafafa;padding:16px 32px;text-align:center;"><p style="margin:0;font-size:11px;color:#aaa;">Docs2Video &mdash; Turn any document into a professional video.<br/><a href="https://docs2video.com/help" style="color:#aaa;">Help Center</a></p></td></tr>
</table>
</body></html>`,
  })
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(
    formData.get('email') as string,
    { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/settings` }
  )

  if (error) {
    return { error: error.message }
  }

  return { success: 'Check your email for a password reset link.' }
}
