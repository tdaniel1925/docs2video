import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { isAdmin } from '../../../_lib/admin'
import { logAdminAction } from '../../../_lib/audit'
export const maxDuration = 30

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { action, userId, value, reason } = await request.json() as {
    action: 'change_plan' | 'add_credits' | 'reset_credits' | 'toggle_ban'
    userId: string
    value?: string | number
    reason?: string
  }

  if (!action || !userId) {
    return NextResponse.json({ error: 'action and userId are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    switch (action) {
      case 'change_plan': {
        const plan = (value as string) || null
        await admin.from('profiles').update({ subscription_status: plan }).eq('id', userId)
        break
      }
      case 'add_credits': {
        const amount = Number(value) || 0
        const { data: profile } = await admin.from('profiles').select('credits_remaining').eq('id', userId).single()
        const current = profile?.credits_remaining ?? 0
        await admin.from('profiles').update({ credits_remaining: current + amount }).eq('id', userId)
        break
      }
      case 'reset_credits': {
        await admin.from('profiles').update({ credits_remaining: 0 }).eq('id', userId)
        break
      }
      case 'toggle_ban': {
        const { data: profile } = await admin.from('profiles').select('subscription_status').eq('id', userId).single()
        const isBanned = profile?.subscription_status === 'banned'
        await admin.from('profiles').update({ subscription_status: isBanned ? null : 'banned' }).eq('id', userId)
        break
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    await logAdminAction(user.id, action, userId, { value, ...(reason ? { reason } : {}) })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/user-action] Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
