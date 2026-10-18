import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { textingReady, hasConsent, isOptedOut } from '../../../_lib/texting-core'
import { checkTextingHealth } from '../../../_lib/twilio-rest'
import { normalizePhone } from '../../../_lib/texting'
import { CREDIT_COSTS } from '../../../_lib/credits'
import { TEXTING_ON } from '../../../_lib/texting-switch'

export const runtime = 'nodejs'
export const maxDuration = 20

/**
 * GET /api/texting/status?videoId=…&phone=… — what the send panel's Text tab
 * needs: is texting on (tables there + number registered), the price, the
 * agent's name for the preview, the client's phone on file, and for the typed
 * number: did they already agree, did they reply STOP.
 */
export async function GET(request: Request) {
  if (!TEXTING_ON) return NextResponse.json({ error: 'Texting is switched off' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const url = new URL(request.url)
  const videoId = url.searchParams.get('videoId') ?? ''
  const db = createAdminClient()
  if (!(await textingReady(db))) return NextResponse.json({ available: false })

  const [{ data: video }, { data: profile }, health] = await Promise.all([
    db.from('videos').select('id, client_id, draft_data').eq('id', videoId).eq('user_id', user.id).maybeSingle(),
    db.from('profiles').select('full_name, company_name').eq('id', user.id).maybeSingle(),
    checkTextingHealth(),
  ])
  if (!video) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const v = video as { client_id?: string | null; draft_data?: { clientId?: string } | null }
  const clientId = v.client_id || v.draft_data?.clientId || null
  let clientPhone: string | null = null
  if (clientId) {
    const { data: c } = await db.from('clients').select('phone').eq('id', clientId).eq('user_id', user.id).maybeSingle()
    clientPhone = normalizePhone((c as { phone?: string } | null)?.phone ?? '')
  }
  const typed = normalizePhone(url.searchParams.get('phone') ?? '') ?? clientPhone
  const p = profile as { full_name?: string; company_name?: string } | null
  return NextResponse.json({
    available: true,
    clientTexts: health.clientTexts,
    detail: health.detail,
    state: health.state,
    cost: CREDIT_COSTS['client-text'],
    agentName: p?.full_name || p?.company_name || '',
    clientPhone,
    phone: typed,
    consent: typed ? await hasConsent(db, user.id, typed) : false,
    optedOut: typed ? await isOptedOut(db, typed) : false,
  })
}
