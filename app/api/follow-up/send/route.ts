import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { sendViaConnection } from '../../../_lib/email'
import { messageToHtml } from '../../../_lib/client-email'
import { checkRateLimit, rateLimit } from '../../../_lib/rate-limit'
import type { EmailConnection } from '../../../_lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { emailId } = (await request.json().catch(() => ({}))) as { emailId?: string }
  if (!emailId) return NextResponse.json({ error: 'emailId is required' }, { status: 400 })

  // Same limit as the other client-email senders: 30 an hour per agent.
  if (!rateLimit(`follow-up-send:${user.id}`, 30, 60 * 60 * 1000).allowed
    || !(await checkRateLimit(`client-email:user:${user.id}`, 30, 3600)).allowed) {
    return NextResponse.json({ error: 'You’ve sent a lot of emails in the last hour. Please wait a bit and try again.' }, { status: 429 })
  }

  // Load the follow-up email
  const { data: email } = await supabase
    .from('follow_up_emails')
    .select('*')
    .eq('id', emailId)
    .eq('user_id', user.id)
    .single()

  if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 })
  if (email.status === 'sent') return NextResponse.json({ error: 'Already sent' }, { status: 400 })

  // Load the plan
  const { data: plan } = await supabase
    .from('follow_up_plans')
    .select('*')
    .eq('id', email.plan_id)
    .single()

  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  if (!plan.client_email) return NextResponse.json({ error: 'No client email on plan' }, { status: 400 })

  // Load the video for share link
  const { data: video } = await supabase
    .from('videos')
    .select('id, title')
    .eq('id', plan.video_id)
    .single()

  // Load user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  // Load default email connection
  const { data: connection } = await supabase
    .from('email_connections')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_default', true)
    .single()

  if (!connection) return NextResponse.json({ error: 'No email connection configured' }, { status: 400 })

  // Build the share link
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  const shareLink = `${baseUrl}/watch/${plan.video_id}`
  const agentName = profile?.full_name ?? 'Your Agent'
  const clientName = plan.client_name ?? ''

  // Replace placeholders
  const subject = email.subject
    .replace(/\{\{share_link\}\}/g, shareLink)
    .replace(/\{\{agent_name\}\}/g, agentName)
    .replace(/\{\{client_name\}\}/g, clientName)

  const body = email.body
    .replace(/\{\{share_link\}\}/g, shareLink)
    .replace(/\{\{agent_name\}\}/g, agentName)
    .replace(/\{\{client_name\}\}/g, clientName)

  // Wrap body in simple HTML. The draft is text the agent (or the AI) wrote —
  // escape it, and keep blank-line paragraphs + line breaks.
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
${messageToHtml(body, 'margin:0 0 16px;')}
</body></html>`

  // CLAIM the draft before sending: only one request can flip it from its
  // current status to 'sent', so a double-click can't email the client twice.
  // If the send then fails, it's put back so it can be tried again.
  const { data: claimed, error: claimErr } = await supabase
    .from('follow_up_emails')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', emailId)
    .eq('user_id', user.id)
    .neq('status', 'sent')
    .select('id')
  if (claimErr) return NextResponse.json({ error: 'Could not send right now — try again.' }, { status: 500 })
  if (!claimed || claimed.length === 0) return NextResponse.json({ error: 'Already sent' }, { status: 400 })

  try {
    const conn = connection as EmailConnection
    await sendViaConnection(conn, plan.client_email, subject, html)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    await supabase
      .from('follow_up_emails')
      .update({ status: email.status ?? 'pending', sent_at: null })
      .eq('id', emailId)
    console.error('[follow-up/send] Error:', err)
    return NextResponse.json({ error: `The email did NOT send: ${err?.message ?? 'send failed'}` }, { status: 500 })
  }
}
