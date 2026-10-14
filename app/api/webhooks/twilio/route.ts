import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { validateTwilioSignature } from '../../../_lib/twilio-rest'
import { handleInbound, textingReady } from '../../../_lib/texting-core'
import { siteUrl } from '../../../_lib/site-url'
import { TEXTING_ON } from '../../../_lib/texting-switch'

export const runtime = 'nodejs'
export const maxDuration = 30

const EMPTY = () => new NextResponse('<Response/>', { headers: { 'Content-Type': 'text/xml' } })

/**
 * TEXTS SENT TO OUR NUMBER (Twilio "A message comes in" webhook).
 * Set on the Twilio number to: https://docs2video.com/api/webhooks/twilio
 *
 * Signed by Twilio (X-Twilio-Signature over the PUBLIC address — taken from
 * our own config, never from the request). Unsigned or wrong → 403.
 * STOP / START / HELP update the do-not-text list (Twilio sends the standard
 * replies itself); anything else from a client is a reply for the agent.
 * Always answers an empty reply — we never auto-text back.
 */
export async function POST(request: Request) {
  if (!TEXTING_ON) return NextResponse.json({ error: 'Texting is switched off' }, { status: 404 })
  const raw = await request.text()
  const params = Object.fromEntries(new URLSearchParams(raw)) as Record<string, string>
  const url = `${siteUrl()}/api/webhooks/twilio`
  if (!validateTwilioSignature(url, params, request.headers.get('x-twilio-signature'))) {
    return NextResponse.json({ error: 'Bad signature' }, { status: 403 })
  }
  const db = createAdminClient()
  if (!(await textingReady(db))) return EMPTY()
  try {
    await handleInbound(db, params)
  } catch (e) {
    console.error('[twilio-inbound] failed:', e instanceof Error ? e.message : e)
  }
  return EMPTY()
}
