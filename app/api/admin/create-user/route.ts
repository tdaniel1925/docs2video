import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { isAdmin , isAdminRequest } from '../../../_lib/admin'
import { logAdminAction } from '../../../_lib/audit'
import { ensureCreditBalance } from '../../../_lib/credits'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdminRequest(user))) {
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

    // Create or update profile. 'trial' is treated as free for tiering.
    const planStatus = plan ?? 'trial'
    await admin.from('profiles').upsert({
      id: authUser.user.id,
      email,
      full_name: fullName ?? null,
      company_name: companyName ?? null,
      subscription_status: planStatus,
      is_beta: isBeta ?? false,
      is_admin: false,
      onboarding_completed: false,
    })

    // Grant real, spendable credits at the plan's tier (credit_balances), not
    // the dead profiles.credits_remaining column (audit #4).
    await ensureCreditBalance(authUser.user.id, planStatus)

    // Log admin action
    await logAdminAction(user.id, 'create_user', authUser.user.id, {
      email,
      plan: plan ?? 'trial',
      isBeta: isBeta ?? false,
    })

    // Log the temp password server-side only — never return it in the response
    if (!password) {
      console.log(`[admin/create-user] Temp password generated for ${email} — deliver via secure channel`)
    }

    return NextResponse.json({
      success: true,
      userId: authUser.user.id,
      email,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create user'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
