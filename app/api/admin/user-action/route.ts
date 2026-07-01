import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { requireAdmin } from '../../../_lib/admin'
import { logAdminAction } from '../../../_lib/audit'
import { addTopupCredits, applyTierChange } from '../../../_lib/credits'
export const maxDuration = 30

export async function POST(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

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
        // Allowlist (review B15): the value is an arbitrary string from the UI
        // and the prod subscription_status CHECK constraint is a hand-maintained
        // list (it has rejected values before). An invalid value must fail HERE,
        // loudly — not leave the flag unchanged while credits are granted anyway.
        const ALLOWED_PLANS = ['free', 'trial', 'starter', 'pro', 'business', 'agency', 'enterprise']
        const raw = ((value as string) || '').toLowerCase().trim()
        const plan = raw === 'free' || raw === '' ? null : raw
        if (plan && !ALLOWED_PLANS.includes(plan)) {
          return NextResponse.json({ error: `Invalid plan "${raw}"` }, { status: 400 })
        }
        const { error: planErr } = await admin.from('profiles').update({ subscription_status: plan }).eq('id', userId)
        if (planErr) {
          // e.g. the CHECK constraint rejected the value — do NOT grant credits
          // for a plan the user isn't actually on (review B15).
          return NextResponse.json({ error: `Plan update failed: ${planErr.message}` }, { status: 500 })
        }
        // Grant the credits that match the new plan. Without this, flipping a user
        // to e.g. 'pro' set the flag but left them on the free 2,000-credit grant
        // (the Angela bug). applyTierChange adds the upgrade delta to match the
        // tier (no-op on downgrade/same-tier, so it's safe to always call).
        if (plan) await applyTierChange(userId, plan).catch((e) => console.error('[admin] applyTierChange failed:', e))
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
        // Zero out the REAL wallet only. (Don't touch the dead
        // profiles.credits_remaining column — nothing reads it now that the admin
        // shows the real balance; writing it just re-introduces the drift.)
        // Read the balance first so the ledger row records what was wiped, and
        // reset cycle_credits_granted (review B16): leaving it at the old tier's
        // number made a follow-up change_plan compute delta<=0 and grant NOTHING
        // — the exact Angela-bug recurrence path.
        const { data: wallet } = await admin.from('credit_balances')
          .select('balance, topup_balance').eq('user_id', userId).maybeSingle()
        const wiped = (wallet?.balance ?? 0) + (wallet?.topup_balance ?? 0)
        const { error: resetErr } = await admin.from('credit_balances').update({
          balance: 0,
          topup_balance: 0,
          cycle_credits_granted: 0,
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId)
        if (resetErr) {
          return NextResponse.json({ error: `Reset failed: ${resetErr.message}` }, { status: 500 })
        }
        // Ledger the reset so it's visible in credit history / billing audits.
        await admin.from('credit_transactions').insert({
          user_id: userId,
          amount: -wiped,
          balance_after: 0,
          action: 'admin_reset',
          description: `Admin reset: -${wiped.toLocaleString()} credits${reason ? ` (${reason})` : ''}`,
        }).then(({ error }) => { if (error) console.warn('[admin] reset ledger failed:', error.message) })
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
