import { NextResponse } from 'next/server'
import { verifyCronAuth } from '../../../_lib/cron-auth'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { sendQueuedAlerts } from '../../../_lib/texting-core'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Every 15 minutes: send hot-client alerts that waited for the agent's quiet
 * hours (9pm–8am their time) to end. Does nothing until the texting
 * migration has run.
 */
export async function GET(request: Request) {
  if (!verifyCronAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const r = await sendQueuedAlerts(createAdminClient())
  return NextResponse.json({ ok: true, ...r })
}
