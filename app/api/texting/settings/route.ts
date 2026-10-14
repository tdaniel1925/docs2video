import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { textingReady, getAlertSettings, saveAlertSettings } from '../../../_lib/texting-core'
import { checkTextingHealth } from '../../../_lib/twilio-rest'
import { formatPhone } from '../../../_lib/texting'
import { TEXTING_ON } from '../../../_lib/texting-switch'

export const runtime = 'nodejs'
export const maxDuration = 20

/**
 * GET → { available, settings, phoneDisplay, health, email }
 * PUT { channel?, triggers?, timeZone? } → { settings }
 *
 * "Tell me when a client is ready" (Settings → Email & sending). `available`
 * is false until the texting migration has run; the screen then says so and
 * saves nothing.
 */
export async function GET() {
  if (!TEXTING_ON) return NextResponse.json({ error: 'Texting is switched off' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const db = createAdminClient()
  if (!(await textingReady(db))) return NextResponse.json({ available: false })
  const [settings, health] = await Promise.all([getAlertSettings(db, user.id), checkTextingHealth()])
  return NextResponse.json({
    available: true,
    settings,
    phoneDisplay: settings.phone ? formatPhone(settings.phone) : null,
    email: user.email ?? null,
    health: { agentTexts: health.agentTexts, clientTexts: health.clientTexts, state: health.state, detail: health.detail },
  })
}

export async function PUT(request: Request) {
  if (!TEXTING_ON) return NextResponse.json({ error: 'Texting is switched off' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const db = createAdminClient()
  if (!(await textingReady(db))) return NextResponse.json({ error: 'This isn’t switched on yet — nothing was saved.' }, { status: 503 })
  const body = await request.json().catch(() => ({})) as { channel?: unknown; triggers?: Record<string, unknown>; timeZone?: unknown }
  const r = await saveAlertSettings(db, user.id, { channel: body.channel, triggers: body.triggers, timeZone: body.timeZone })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ settings: r.settings })
}
