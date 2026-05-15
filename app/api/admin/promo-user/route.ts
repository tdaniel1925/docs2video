import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { isAdmin } from '../../../_lib/admin'

export const runtime = 'nodejs'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) return null
  return user
}

export async function POST(request: Request) {
  const admin = await verifyAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { email, name } = await request.json() as { email: string; name?: string | null }
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const supabase = createAdminClient()

  // Check if user exists
  const { data: existing } = await supabase.from('profiles').select('id, email').eq('email', email.toLowerCase()).single()

  if (existing) {
    // Upgrade existing user
    await supabase.from('profiles').update({
      subscription_status: 'agency',
      card_on_file: true,
      free_videos_remaining: 999,
    }).eq('id', existing.id)

    return NextResponse.json({ ok: true, created: false })
  }

  // Create new account
  const password = `D2V-${email.split('@')[0].slice(0, 8)}-${Date.now().toString(36).slice(-4)}!`
  const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
    email: email.toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { full_name: name || email.split('@')[0] },
  })

  if (createErr || !newUser.user) {
    return NextResponse.json({ error: createErr?.message || 'Failed to create user' }, { status: 500 })
  }

  // Set to agency tier
  await supabase.from('profiles').update({
    subscription_status: 'agency',
    full_name: name || null,
    onboarding_completed: true,
    card_on_file: true,
    free_videos_remaining: 999,
  }).eq('id', newUser.user.id)

  // Send welcome email
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'Docs2Video <notifications@docs2video.com>',
      to: email,
      subject: 'Welcome to Docs2Video — Your Account is Ready',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <img src="https://docs2video.com/logo.png" alt="Docs2Video" style="height: 48px; margin-bottom: 24px;" />
          <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">Welcome to Docs2Video${name ? `, ${name}` : ''}!</h1>
          <p style="font-size: 15px; color: #4a5568; line-height: 1.6;">Your account has been set up with unlimited access. Here are your login details:</p>
          <div style="background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0 0 8px;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 0 0 8px;"><strong>Password:</strong> ${password}</p>
            <p style="margin: 0;"><strong>Login:</strong> <a href="https://docs2video.com/login">docs2video.com/login</a></p>
          </div>
          <p style="font-size: 15px; color: #4a5568; line-height: 1.6;">You have unlimited video creation — no limits or charges. We recommend changing your password after your first login.</p>
          <a href="https://docs2video.com/login" style="display: inline-block; background: #1B365D; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">Log In Now</a>
          <p style="font-size: 13px; color: #a0aec0; margin-top: 32px;">— The Docs2Video Team</p>
        </div>
      `,
    })
  } catch (e) {
    console.error('[promo-user] Email failed:', e)
  }

  return NextResponse.json({ ok: true, created: true })
}

export async function DELETE(request: Request) {
  const admin = await verifyAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { email } = await request.json() as { email: string }
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const supabase = createAdminClient()
  await supabase.from('profiles').update({
    subscription_status: null,
    free_videos_remaining: 0,
  }).eq('email', email.toLowerCase())

  return NextResponse.json({ ok: true })
}
