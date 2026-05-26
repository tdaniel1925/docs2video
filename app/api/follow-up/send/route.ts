import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { sendViaGoogle, sendViaMicrosoft, sendViaSMTP } from '../../../_lib/email'
import type { EmailConnection } from '../../../_lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { emailId } = (await request.json()) as { emailId: string }
  if (!emailId) return NextResponse.json({ error: 'emailId is required' }, { status: 400 })

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

  // Wrap body in simple HTML
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
${body.split('\n').map((p: string) => p.trim() ? `<p style="margin:0 0 16px;">${p}</p>` : '').join('\n')}
</body></html>`

  try {
    const conn = connection as EmailConnection
    if (conn.provider === 'google') {
      await sendViaGoogle(conn, plan.client_email, subject, html)
    } else if (conn.provider === 'microsoft') {
      await sendViaMicrosoft(conn, plan.client_email, subject, html)
    } else {
      await sendViaSMTP(conn, plan.client_email, subject, html)
    }

    // Update status
    await supabase
      .from('follow_up_emails')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', emailId)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[follow-up/send] Error:', err)
    return NextResponse.json({ error: err.message ?? 'Send failed' }, { status: 500 })
  }
}
