import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { validateEmail, sanitizeString } from '../../_lib/validate'

export async function POST(request: Request) {
  const { name, email, subject, message } = await request.json()

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!validateEmail(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
  }

  const cleanName = sanitizeString(name, 200)
  const cleanSubject = sanitizeString(subject || '', 300)
  const cleanMessage = sanitizeString(message, 5000)

  try {
    const resend = new Resend(process.env.RESEND_API_KEY!)
    await resend.emails.send({
      from: 'Docs2Video <noreply@docs2video.com>',
      to: 'trenttdaniel@gmail.com',
      replyTo: email,
      subject: `[Contact] ${cleanSubject || 'General'} — ${cleanName}`,
      text: `Name: ${cleanName}\nEmail: ${email}\nSubject: ${cleanSubject || 'General'}\n\nMessage:\n${cleanMessage}`,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }
}
