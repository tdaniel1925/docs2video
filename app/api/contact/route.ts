import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(request: Request) {
  const { name, email, subject, message } = await request.json()

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY!)
    await resend.emails.send({
      from: 'Docs2Video <noreply@docs2video.com>',
      to: 'trenttdaniel@gmail.com',
      replyTo: email,
      subject: `[Contact] ${subject || 'General'} — ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject || 'General'}\n\nMessage:\n${message}`,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }
}
