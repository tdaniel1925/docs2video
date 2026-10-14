import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { textingReady, sendVerifyCode, checkVerifyCode } from '../../../_lib/texting-core'

export const runtime = 'nodejs'
export const maxDuration = 20

/**
 * POST { action: 'send', phone }  — text a 6-digit code to the agent's mobile
 * POST { action: 'check', code }  — confirm it; the number is then used for alerts
 * Free (no credits). At most 5 codes an hour, 5 guesses a code, 10 minutes.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const db = createAdminClient()
  if (!(await textingReady(db))) return NextResponse.json({ error: 'This isn’t switched on yet.' }, { status: 503 })
  const body = await request.json().catch(() => ({})) as { action?: string; phone?: string; code?: string }
  const r = body.action === 'check'
    ? await checkVerifyCode(db, user.id, body.code)
    : body.action === 'send'
      ? await sendVerifyCode(db, user.id, body.phone)
      : { ok: false as const, status: 400, error: 'Unknown action' }
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ ok: true, message: r.message })
}
