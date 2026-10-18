import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { normalizePref, VIEW_ALERT_PREFS, type ViewAlertPref } from '../../../_lib/view-alerts'

export const runtime = 'nodejs'
export const maxDuration = 15

/**
 * GET  /api/analytics/alert-prefs → { viewAlerts: 'all' | 'first' | 'off', available }
 * PUT  /api/analytics/alert-prefs   { viewAlerts }
 *
 * How often the agent is emailed/texted when a client watches (see
 * view-alerts.ts). Stored in profiles.view_alerts, added by migration
 * 20260926. Until that runs, GET reports the default and PUT says plainly
 * that the setting can't be saved yet — never a fake "Saved".
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('profiles').select('view_alerts').eq('id', user.id).maybeSingle()
  if (error) return NextResponse.json({ viewAlerts: 'all', available: false })
  return NextResponse.json({ viewAlerts: normalizePref((data as { view_alerts?: string } | null)?.view_alerts), available: true })
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { viewAlerts?: string }
  if (!VIEW_ALERT_PREFS.includes(body.viewAlerts as ViewAlertPref)) {
    return NextResponse.json({ error: 'Choose all, first, or off.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .update({ view_alerts: body.viewAlerts })
    .eq('id', user.id)
    .select('view_alerts')
    .maybeSingle()
  if (error || !data) {
    console.error('[alert-prefs] save failed:', error?.message)
    return NextResponse.json({ error: 'This setting can’t be saved yet — the database needs an update. Your alerts stay as they are.' }, { status: 503 })
  }
  return NextResponse.json({ viewAlerts: normalizePref((data as { view_alerts?: string }).view_alerts) })
}
