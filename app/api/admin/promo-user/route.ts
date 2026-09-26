import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { requireAdmin } from '../../../_lib/admin'
import { randomBytes } from 'crypto'
import { ensureCreditBalance, grantMonthlyCredits } from '../../../_lib/credits'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { email, name } = await request.json() as { email: string; name?: string | null }
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const supabase = createAdminClient()

  // Check if user exists
  const { data: existing } = await supabase.from('profiles').select('id, email').eq('email', email.toLowerCase()).single()

  if (existing) {
    // Upgrade existing user. is_beta = true gives genuine unlimited (bypasses
    // all credit checks) — matches what the welcome email promises (audit #5).
    await supabase.from('profiles').update({
      subscription_status: 'enterprise',
      is_beta: true,
      card_on_file: true,
      free_videos_remaining: 999,
    }).eq('id', existing.id)
    await ensureCreditBalance(existing.id, 'enterprise')

    return NextResponse.json({ ok: true, created: false })
  }

  // Create new account. NO emailed password (audit, Medium): the old one was
  // built from the email name + a timestamp — guessable — and sent in plain
  // text. The account gets an unguessable random password nobody sees, and the
  // email sends them to "Forgot password" to choose their own. (That page's
  // email-link flow is the one that lands correctly today; an admin-made
  // one-time link has no page to land on — see /auth/callback.)
  const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
    email: email.toLowerCase(),
    password: randomBytes(32).toString('base64url'),
    email_confirm: true,
    user_metadata: { full_name: name || email.split('@')[0] },
  })

  if (createErr || !newUser.user) {
    console.error('[promo-user] createUser failed:', createErr?.message)
    return NextResponse.json({ error: createErr?.message || 'Failed to create user' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://docs2video.com'

  // Set to enterprise tier with unlimited (is_beta bypass). Use a recognized
  // status — NOT 'agency', which getUserTier maps to free (audit #5).
  await supabase.from('profiles').update({
    subscription_status: 'enterprise',
    is_beta: true,
    full_name: name || null,
    onboarding_completed: true,
    card_on_file: true,
    free_videos_remaining: 999,
  }).eq('id', newUser.user.id)
  await ensureCreditBalance(newUser.user.id, 'enterprise')

  // Send welcome email. Resend returns failures instead of throwing, so check
  // the result and tell the admin — they're waiting on this and would
  // otherwise assume the person got their set-password instructions.
  let emailSent = false
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error: sendError } = await resend.emails.send({
      from: 'Docs2Video <notifications@docs2video.com>',
      to: email,
      subject: 'Welcome to Docs2Video — Your Account is Ready',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <img src="https://docs2video.com/logo.png" alt="Docs2Video" style="height: 48px; margin-bottom: 24px;" />
          <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">Welcome to Docs2Video${name ? `, ${escapeHtml(name)}` : ''}!</h1>
          <p style="font-size: 15px; color: #4a5568; line-height: 1.6;">Your account has been set up with unlimited access. Your login email is <strong>${escapeHtml(email)}</strong>.</p>
          <p style="font-size: 15px; color: #4a5568; line-height: 1.6;">To choose your password: click the button below, enter this email address, and we'll send you a secure link.</p>
          <p style="font-size: 15px; color: #4a5568; line-height: 1.6;">You have unlimited video creation — no limits or charges.</p>
          <a href="${appUrl}/forgot-password" style="display: inline-block; background: #1B365D; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">Set My Password</a>
          <p style="font-size: 13px; color: #a0aec0; margin-top: 32px;">— The Docs2Video Team</p>
        </div>
      `,
    })
    if (sendError) console.error('[promo-user] Email failed:', sendError.message)
    else emailSent = true
  } catch (e) {
    console.error('[promo-user] Email failed:', e)
  }

  return NextResponse.json({
    ok: true,
    created: true,
    emailSent,
    ...(emailSent ? {} : { warning: 'Account created, but the welcome email did not send. Tell them to use "Forgot password" on the login page.' }),
  })
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { email } = await request.json() as { email: string }
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: target } = await supabase
    .from('profiles')
    .select('id, stripe_subscription_id')
    .eq('email', email.toLowerCase())
    .maybeSingle()
  if (!target) return NextResponse.json({ error: 'No account with that email' }, { status: 404 })

  // Revoke = take away what the PROMO gave (audit, Medium). is_beta is the
  // unlimited-credits switch; leaving it on meant a "revoked" promo user kept
  // unlimited everything. A person who also pays us through Stripe keeps
  // their real plan — the webhook owns that status.
  const payingViaStripe = !!target.stripe_subscription_id
  const { error } = await supabase.from('profiles').update({
    is_beta: false,
    free_videos_remaining: 0,
    ...(payingViaStripe ? {} : { subscription_status: null }),
  }).eq('id', target.id)
  if (error) {
    console.error('[promo-user] revoke failed:', error.message)
    return NextResponse.json({ error: 'Could not revoke the promo account.' }, { status: 500 })
  }
  // Their wallet was filled at the enterprise allotment; drop a non-paying
  // account back to the free allotment now instead of at the next cycle.
  if (!payingViaStripe) await grantMonthlyCredits(target.id, 'free', { forceNewCycle: true })

  return NextResponse.json({ ok: true, keptPaidPlan: payingViaStripe })
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
