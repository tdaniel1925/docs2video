import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { isAdmin , isAdminRequest } from '../../../_lib/admin'
import { logAdminAction } from '../../../_lib/audit'
import { addTopupCredits } from '../../../_lib/credits'
export const maxDuration = 30

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdminRequest(user))) {
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
        // Route through the real credit system (credit_balances.topup_balance),
        // not the legacy profiles.credits_remaining column which the app no
        // longer spends from. This is what makes admin grants actually usable.
        const amount = Number(value) || 0
        if (amount > 0) {
          await addTopupCredits(userId, amount, `admin grant${reason ? ` (${reason})` : ''}`)
        }
        // Do NOT write profiles.credits_remaining — it's the dead store and a
        // non-additive write here would re-introduce drift (audit #8).
        break
      }
      case 'reset_credits': {
        // Zero out the real balance table and the legacy column.
        await admin.from('credit_balances').update({
          balance: 0,
          topup_balance: 0,
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId)
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
