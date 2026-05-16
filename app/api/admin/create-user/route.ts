import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { isAdmin } from '../../../_lib/admin'
import { logAdminAction } from '../../../_lib/audit'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { email, fullName, companyName, plan, password, sendWelcome, isBeta } = body as {
    email: string
    fullName?: string
    companyName?: string
    plan?: string
    password?: string
    sendWelcome?: boolean
    isBeta?: boolean
  }

  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  const admin = createAdminClient()

  try {
    // Check if user already exists
    const { data: existing } = await admin.from('profiles').select('id, email').eq('email', email).single()
    if (existing) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 })
    }

    // Create auth user via Supabase Admin API
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const tempPassword = password || Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName ?? '' },
    })

    if (authError || !authUser.user) {
      return NextResponse.json({ error: authError?.message ?? 'Failed to create auth user' }, { status: 500 })
    }

    // Create or update profile
    await admin.from('profiles').upsert({
      id: authUser.user.id,
      email,
      full_name: fullName ?? null,
      company_name: companyName ?? null,
      subscription_status: plan ?? 'trial',
      is_beta: isBeta ?? false,
      is_admin: false,
      onboarding_completed: false,
      credits_remaining: plan === 'pro' ? 100 : plan === 'agency' ? 300 : 10,
    })

    // Log admin action
    await logAdminAction(user.id, 'create_user', authUser.user.id, {
      email,
      plan: plan ?? 'trial',
      isBeta: isBeta ?? false,
    })

    return NextResponse.json({
      success: true,
      userId: authUser.user.id,
      email,
      tempPassword: password ? undefined : tempPassword,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create user'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
