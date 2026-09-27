import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { checkSmtpTarget } from '../../_lib/net-guard'
import { encryptSecret } from '../../_lib/secret-box'
import { makeOnlyDefault, googleConfigured, microsoftConfigured } from '../../_lib/email-connections'
export const maxDuration = 60

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // ?providers=1 — which one-click connect buttons the server is set up for
  // (settings hides Outlook when its app registration is missing).
  if (new URL(request.url).searchParams.get('providers') === '1') {
    return NextResponse.json({ google: googleConfigured(), microsoft: microsoftConfigured() })
  }

  const { data } = await supabase
    .from('email_connections')
    .select('id, provider, email_address, is_default, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json(data ?? [])
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// SMTP connection setup
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json().catch(() => null) as {
    emailAddress?: unknown
    smtpHost?: unknown
    smtpPort?: unknown
    smtpUser?: unknown
    smtpPass?: unknown
    imapHost?: unknown
    imapPort?: unknown
  } | null
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const emailAddress = typeof body.emailAddress === 'string' ? body.emailAddress.trim() : ''
  const smtpUser = typeof body.smtpUser === 'string' && body.smtpUser.trim() ? body.smtpUser.trim() : emailAddress
  const smtpPass = typeof body.smtpPass === 'string' ? body.smtpPass : ''
  const imapHost = typeof body.imapHost === 'string' && body.imapHost.trim() ? body.imapHost.trim().slice(0, 253) : null
  const imapPort = imapHost && Number.isInteger(Number(body.imapPort)) ? Number(body.imapPort) : null
  if (!EMAIL_RE.test(emailAddress)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  if (!smtpPass) return NextResponse.json({ error: 'Enter your email password or app password.' }, { status: 400 })

  // Only real mail servers on mail ports — never our own network (SSRF).
  const target = await checkSmtpTarget(body.smtpHost, body.smtpPort)
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: 400 })
  const smtpPort = Number(body.smtpPort)

  // Test the SMTP login. Connect to the address we just checked, and give TLS
  // the real name so the certificate still matches.
  try {
    const nodemailer = require('nodemailer')
    const transport = nodemailer.createTransport({
      host: target.address,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
      tls: { servername: target.hostname },
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
    })
    await transport.verify()
  } catch {
    return NextResponse.json({ error: 'SMTP connection failed. Check your settings.' }, { status: 400 })
  }

  const { data, error } = await supabase.from('email_connections').insert({
    user_id: user.id,
    provider: 'smtp',
    email_address: emailAddress,
    smtp_host: target.hostname,
    smtp_port: smtpPort,
    smtp_user: smtpUser,
    smtp_pass: encryptSecret(smtpPass), // encrypted at rest when DATA_ENCRYPTION_KEY is set
    imap_host: imapHost,
    imap_port: imapPort,
    is_default: false,
  }).select('id, provider, email_address, is_default, created_at').single()

  if (error || !data) {
    console.error('[email-connections] save failed:', error?.message)
    return NextResponse.json({ error: 'Could not save the email connection. Please try again.' }, { status: 500 })
  }

  // The newest connection becomes the ONE default sender.
  try {
    await makeOnlyDefault(createAdminClient(), user.id, data.id)
    data.is_default = true
  } catch (e) {
    console.error('[email-connections] default update failed:', e instanceof Error ? e.message : e)
  }

  // Never echo the password (or any secret) back to the browser.
  return NextResponse.json(data)
}
