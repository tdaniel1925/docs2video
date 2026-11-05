import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { validateEmail, sanitizeString } from '../../_lib/validate'
import { checkRateLimit } from '../../_lib/rate-limit'
import { spamReason } from '../../_lib/contact-spam'
export const maxDuration = 30

export async function POST(request: Request) {
  const { name, email, subject, message, website, startedAt } = await request.json()

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!validateEmail(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
  }

  // Spam: dropped quietly with the same answer a person gets (app/_lib/contact-spam.ts).
  const reason = spamReason({ website, startedAt, message: String(message) })
  if (reason) {
    console.info(`[contact] dropped as spam (${reason})`)
    return NextResponse.json({ ok: true })
  }
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { allowed } = await checkRateLimit(`contact:ip:${ip}`, 5, 3600)
  if (!allowed) return NextResponse.json({ error: 'Too many messages. Please email support@docs2video.com' }, { status: 429 })

  const cleanName = sanitizeString(name, 200)
  const cleanSubject = sanitizeString(subject || '', 300)
  const cleanMessage = sanitizeString(message, 5000)

  try {
    const resend = new Resend(process.env.RESEND_API_KEY!)
    // Route to the support inbox (env-configurable), not a personal address
    const supportInbox = process.env.SUPPORT_EMAIL || 'support@docs2video.com'
    // Resend returns failures instead of throwing. Without this check a failed
    // send showed the visitor "Message sent" while nobody ever got it.
    const { error: sendError } = await resend.emails.send({
      from: 'Docs2Video <noreply@docs2video.com>',
      to: supportInbox,
      replyTo: email,
      subject: `[Contact] ${cleanSubject || 'General'} — ${cleanName}`,
      text: `Name: ${cleanName}\nEmail: ${email}\nSubject: ${cleanSubject || 'General'}\n\nMessage:\n${cleanMessage}`,
    })
    if (sendError) {
      console.error('[contact] send failed:', sendError.message)
      return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[contact] send failed:', err)
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }
}
