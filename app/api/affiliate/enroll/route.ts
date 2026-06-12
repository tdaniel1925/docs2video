import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { enrollAffiliate } from '../../../_lib/affiliate'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * POST /api/affiliate/enroll
 * Self-serve: any signed-in user becomes an affiliate and gets a unique
 * Stripe promo code. Idempotent.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()
    const result = await enrollAffiliate(user.id, profile?.full_name || user.email?.split('@')[0])
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Enrollment failed'
    console.error('[affiliate/enroll]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
