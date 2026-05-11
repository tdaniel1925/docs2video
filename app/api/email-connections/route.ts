import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data } = await supabase
    .from('email_connections')
    .select('id, provider, email_address, is_default, created_at, last_tested_at, last_test_success')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json(data ?? [])
}

// SMTP connection setup
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { provider, emailAddress, smtpHost, smtpPort, smtpUser, smtpPass, imapHost, imapPort } = body as {
    provider: 'smtp'
    emailAddress: string
    smtpHost: string
    smtpPort: number
    smtpUser: string
    smtpPass: string
    imapHost?: string
    imapPort?: number
  }

  // Test SMTP connection
  try {
    const nodemailer = require('nodemailer')
    const transport = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    })
    await transport.verify()
  } catch {
    return NextResponse.json({ error: 'SMTP connection failed. Check your settings.' }, { status: 400 })
  }

  const { data, error } = await supabase.from('email_connections').insert({
    user_id: user.id,
    provider,
    email_address: emailAddress,
    smtp_host: smtpHost,
    smtp_port: smtpPort,
    smtp_user: smtpUser,
    smtp_pass: smtpPass,
    imap_host: imapHost ?? null,
    imap_port: imapPort ?? null,
    is_default: true,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
