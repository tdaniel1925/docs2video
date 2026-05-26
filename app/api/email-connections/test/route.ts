import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { sendViaSMTP, sendViaMicrosoft } from '../../../_lib/email'
import type { EmailConnection } from '../../../_lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { connectionId } = (await request.json()) as { connectionId: string }
    if (!connectionId) {
      return NextResponse.json({ error: 'Missing connectionId' }, { status: 400 })
    }

    // Load the email connection (must belong to this user)
    const { data: connection, error } = await supabase
      .from('email_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('user_id', user.id)
      .single()

    if (error || !connection) {
      return NextResponse.json({ error: 'Email connection not found' }, { status: 404 })
    }

    const conn = connection as EmailConnection
    const subject = 'Docs2Video \u2014 Email Connection Test'
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:40px;font-family:Arial,Helvetica,sans-serif;background:#f4f4f4;">
  <div style="max-width:480px;margin:0 auto;background:white;border-radius:12px;padding:32px;text-align:center;">
    <h2 style="margin:0 0 12px;font-size:20px;color:#1a1a1a;">Email Connection Test</h2>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
      This is a test email from Docs2Video. Your email connection is working correctly!
    </p>
    <p style="margin:0;font-size:12px;color:#aaa;">Sent via ${conn.provider === 'microsoft' ? 'Microsoft 365' : 'SMTP'}</p>
  </div>
</body>
</html>`

    if (conn.provider === 'smtp') {
      await sendViaSMTP(conn, user.email!, subject, html)
    } else if (conn.provider === 'microsoft') {
      await sendViaMicrosoft(conn, user.email!, subject, html)
    } else {
      return NextResponse.json({ error: `Unsupported provider: ${conn.provider}` }, { status: 400 })
    }

    // Update the connection with last test timestamp
    await supabase
      .from('email_connections')
      .update({ last_tested_at: new Date().toISOString(), last_test_success: true })
      .eq('id', connectionId)

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('[email-connections/test] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'

    // Try to record the failure
    try {
      const body = await request.clone().json().catch(() => null)
      if (body?.connectionId) {
        const supabase = await createClient()
        await supabase
          .from('email_connections')
          .update({ last_tested_at: new Date().toISOString(), last_test_success: false })
          .eq('id', body.connectionId)
      }
    } catch { /* ignore */ }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
