import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'
import { validateTwilioSignature } from '../../../../_lib/twilio-rest'
import { handleStatus, textingReady } from '../../../../_lib/texting-core'
import { siteUrl } from '../../../../_lib/site-url'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * Delivery reports for client texts (the StatusCallback we set on each send).
 * Signature-checked like the inbound webhook. A text the carrier reports as
 * failed/undelivered gives its credits back (once) and shows on admin
 * "What needs you".
 */
export async function POST(request: Request) {
  const raw = await request.text()
  const params = Object.fromEntries(new URLSearchParams(raw)) as Record<string, string>
  if (!validateTwilioSignature(`${siteUrl()}/api/webhooks/twilio/status`, params, request.headers.get('x-twilio-signature'))) {
    return NextResponse.json({ error: 'Bad signature' }, { status: 403 })
  }
  const db = createAdminClient()
  if (await textingReady(db)) {
    try { await handleStatus(db, params) } catch (e) { console.error('[twilio-status] failed:', e instanceof Error ? e.message : e) }
  }
  return new NextResponse(null, { status: 204 })
}
