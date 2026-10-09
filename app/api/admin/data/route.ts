import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { requireAdmin } from '../../../_lib/admin'
import { isTestAccount } from '../../../_lib/admin/money'
import { testEmails } from '../../../_lib/admin/money-server'
import { ADMIN_USER_COLUMNS } from '../../../_lib/admin/columns'
export const maxDuration = 30

const head = { count: 'exact' as const, head: true }

/**
 * GET /api/admin/data — the admin home's small numbers + the audit log.
 * Every number is COUNTED BY THE DATABASE (it used to send up to 1,000
 * profiles and 2,000 videos — every column, secrets included — to the browser
 * and count them there). Users and videos have their own paged routes
 * (/api/admin/users, /api/admin/videos).
 */
export async function GET() {
  try {
    const user = await requireAdmin()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const db = createAdminClient()
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString()
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()

    const [users, videos, completed, failed, failed24h, waiting, thisWeek, cards, signups, auditRes] = await Promise.all([
      db.from('profiles').select('id', head),
      db.from('videos').select('id', head).neq('status', 'draft'),
      db.from('videos').select('id', head).eq('status', 'completed'),
      db.from('videos').select('id', head).eq('status', 'failed'),
      db.from('videos').select('id', head).eq('status', 'failed').gte('updated_at', dayAgo),
      db.from('videos').select('id', head).eq('status', 'review_required'),
      db.from('videos').select('id', head).neq('status', 'draft').gte('created_at', weekAgo),
      db.from('profiles').select('id', head).eq('card_on_file', true),
      db.from('profiles').select(ADMIN_USER_COLUMNS).order('created_at', { ascending: false }).limit(10),
      db.from('admin_audit_log').select('id, admin_id, action, target_user_id, details, created_at').order('created_at', { ascending: false }).limit(300),
    ])

    // Emails for the audit rows, and which of them are test accounts.
    const audit = auditRes.data ?? []
    const ids = [...new Set(audit.flatMap((a) => [a.admin_id, a.target_user_id]).filter(Boolean) as string[])]
    const { data: people } = ids.length ? await db.from('profiles').select('id, email').in('id', ids) : { data: [] as { id: string; email: string }[] }
    const emailOf = new Map((people ?? []).map((p) => [p.id, p.email]))
    const tests = testEmails()

    return NextResponse.json({
      counts: {
        users: users.count ?? 0,
        videos: videos.count ?? 0,
        completed: completed.count ?? 0,
        failed: failed.count ?? 0,
        failed24h: failed24h.count ?? 0,
        waitingReview: waiting.count ?? 0,
        thisWeek: thisWeek.count ?? 0,
        cardsOnFile: cards.count ?? 0,
      },
      recentSignups: signups.data ?? [],
      auditLog: audit.map((a) => {
        const adminEmail = emailOf.get(a.admin_id) ?? null
        const targetEmail = a.target_user_id ? emailOf.get(a.target_user_id) ?? null : null
        return {
          ...a,
          admin_email: adminEmail,
          target_email: targetEmail,
          is_test: isTestAccount(adminEmail, tests) || isTestAccount(targetEmail, tests),
        }
      }),
    })
  } catch (err) {
    console.error('[admin/data] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
