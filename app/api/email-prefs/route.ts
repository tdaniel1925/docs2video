import { NextResponse } from 'next/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { readUnsubToken } from '../../_lib/unsubscribe-token'

export const runtime = 'nodejs'
export const maxDuration = 15

/**
 * GET /api/email-prefs?t=<signed token>          ← every link we send now
 * GET /api/email-prefs?uid=<profileId>           ← older account emails
 * GET /api/email-prefs?lead=<demo_videos id>     ← older lead-nurture emails
 *
 * One-click unsubscribe. Linked from email footers; works without a session
 * (exempted from the auth proxy).
 *
 * The signed token covers three kinds of person (see unsubscribe-token.ts):
 * an account holder, a demo lead, and an agent's client opting out of that
 * agent's automatic follow-ups. Editing the URL breaks the signature, so
 * nobody can unsubscribe someone else.
 *
 * WHY THE UNSIGNED FORMS STILL WORK: those links are already sitting in
 * people's inboxes, and an unsubscribe link must keep working (CAN-SPAM).
 * They carry a random UUID that only appears in that one person's email, so
 * guessing someone else's is not realistic. Lead links used to fail outright
 * ("Invalid unsubscribe link") because this route only understood ?uid=.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const page = (msg: string, status = 200) => new NextResponse(
    `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="font-family:-apple-system,Segoe UI,sans-serif;display:flex;align-items:center;justify-content:center;min-height:90vh;background:#F4F1EC;margin:0;padding:16px;"><div style="text-align:center;max-width:420px;"><h2 style="color:#1B3A5C;">${msg}</h2><p style="color:#666;font-size:14px;">You can close this window.</p></div></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
  const UUID = /^[0-9a-f-]{36}$/i

  // Work out who is unsubscribing.
  let kind: 'user' | 'lead' | 'client' | null = null
  let id = ''
  let email = ''
  const token = searchParams.get('t')
  if (token) {
    const p = readUnsubToken(token)
    if (!p) return page('This unsubscribe link is not valid.', 400)
    kind = p.k; id = p.id; email = (p.e ?? '').toLowerCase().trim()
  } else if (searchParams.get('uid')) {
    kind = 'user'; id = String(searchParams.get('uid'))
  } else if (searchParams.get('lead')) {
    kind = 'lead'; id = String(searchParams.get('lead'))
  }
  if (!kind || !UUID.test(id)) return page('This unsubscribe link is not valid.', 400)

  const admin = createAdminClient()

  if (kind === 'user') {
    const { data: profile } = await admin.from('profiles').select('id, nurture_sent').eq('id', id).maybeSingle()
    if (!profile) return page('This unsubscribe link is not valid.', 400)
    const { error } = await admin.from('profiles').update({
      nurture_sent: { ...(profile.nurture_sent ?? {}), unsubscribed: new Date().toISOString() },
    }).eq('id', id)
    if (error) return page('Something went wrong — please try the link again.', 500)
    return page('You’ve been unsubscribed from Docs2Video emails.')
  }

  if (kind === 'lead') {
    // The nurture cron de-dupes leads by EMAIL, so mark every demo row that
    // shares this address — otherwise the next row for the same person
    // would still get the email.
    const { data: lead } = await admin.from('demo_videos').select('id, email, nurture_sent').eq('id', id).maybeSingle()
    if (!lead) return page('This unsubscribe link is not valid.', 400)
    const stamp = new Date().toISOString()
    const leadEmail = String(lead.email ?? '').trim()
    const { data: rows } = leadEmail
      ? await admin.from('demo_videos').select('id, nurture_sent').eq('email', leadEmail)
      : { data: [lead] }
    for (const r of rows ?? [lead]) {
      const { error } = await admin.from('demo_videos')
        .update({ nurture_sent: { ...((r as { nurture_sent?: Record<string, string> }).nurture_sent ?? {}), unsubscribed: stamp } })
        .eq('id', (r as { id: string }).id)
      if (error) return page('Something went wrong — please try the link again.', 500)
    }
    return page('You’ve been unsubscribed from Docs2Video emails.')
  }

  // kind === 'client': stop THIS agent's automatic follow-ups to this address.
  if (!email) return page('This unsubscribe link is not valid.', 400)
  const { error } = await admin
    .from('email_suppressions')
    .upsert({ user_id: id, email, reason: 'unsubscribe' }, { onConflict: 'user_id,email', ignoreDuplicates: true })
  if (error) {
    console.error('[email-prefs] could not save client unsubscribe:', error.message)
    return page('We couldn’t save that just now — please try the link again later.', 500)
  }
  const { data: agent } = await admin.from('profiles').select('full_name, company_name').eq('id', id).maybeSingle()
  const who = agent?.full_name || agent?.company_name
  return page(`You won’t get any more automatic reminders${who ? ` from ${escape(who)}` : ''}.`)
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
