import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { checkRateLimit } from '../../../_lib/rate-limit'
import { textingReady, sendClientText } from '../../../_lib/texting-core'
import { TEXTING_ON } from '../../../_lib/texting-switch'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * POST /api/texting/send { videoId, phone, clientName?, clientId?, note?, consent? }
 * Text a client the share link (costs CREDIT_COSTS['client-text']; refunded
 * if Twilio refuses it). All the rules are in sendClientText.
 */
export async function POST(request: Request) {
  if (!TEXTING_ON) return NextResponse.json({ error: 'Texting is switched off' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const db = createAdminClient()
  if (!(await textingReady(db))) return NextResponse.json({ error: 'Texting isn’t switched on yet. Send it by email for now.' }, { status: 503 })

  if (!(await checkRateLimit(`texting-send:${user.id}`, 20, 3600)).allowed) {
    return NextResponse.json({ error: 'You’ve sent a lot of texts in the last hour. Please wait a bit.' }, { status: 429 })
  }
  const body = await request.json().catch(() => ({})) as {
    videoId?: string; phone?: string; clientName?: string; clientId?: string; note?: string; consent?: boolean
  }
  if (!body.videoId) return NextResponse.json({ error: 'videoId is required' }, { status: 400 })
  const r = await sendClientText(db, {
    userId: user.id, videoId: body.videoId, phone: body.phone, clientName: body.clientName ?? null,
    clientId: body.clientId ?? null, note: body.note ?? null, consent: body.consent === true,
  })
  if (!r.ok) return NextResponse.json({ error: r.error, code: r.code }, { status: r.status })
  return NextResponse.json({ success: true, to: r.to, withPicture: r.withPicture, credits: r.credits })
}
