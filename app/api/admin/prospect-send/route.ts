import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { isAdmin } from '../../../_lib/admin'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { prospectId, contactEmail, contactName, subject, body } = (await request.json()) as {
      prospectId: string
      contactEmail: string
      contactName?: string
      subject: string
      body?: string
    }

    if (!prospectId || !contactEmail || !subject) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Load prospect record
    const { data: prospect, error: loadErr } = await admin
      .from('prospect_demos')
      .select('*')
      .eq('id', prospectId)
      .single()

    if (loadErr || !prospect) {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 })
    }

    if (!prospect.video_url) {
      return NextResponse.json({ error: 'No video available for this prospect' }, { status: 400 })
    }

    // Build email HTML
    const watchUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://docs2video.com'}/watch/prospect/${prospectId}`
    const thumbnailUrl = prospect.thumbnail_url ?? ''
    const companyName = prospect.company_name ?? 'Your Company'
    const firstName = contactName?.split(' ')[0] ?? ''

    const personalGreeting = firstName ? `Hi ${firstName},` : 'Hi there,'
    const bodyText = body || `I created a short personalized video showing how ${companyName} could use Docs2Video to turn documents into professional videos automatically. Take a look — it's only ${prospect.duration ?? 60} seconds.`

    const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8f6f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <tr><td>
      <div style="background:white;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <!-- Video Thumbnail with Play Button -->
        <a href="${watchUrl}" style="display:block;position:relative;text-decoration:none;">
          <img src="${thumbnailUrl}" alt="Watch your personalized demo" style="width:100%;height:auto;display:block;" />
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:72px;height:72px;background:rgba(0,0,0,0.7);border-radius:50%;display:flex;align-items:center;justify-content:center;">
            <div style="width:0;height:0;border-style:solid;border-width:14px 0 14px 24px;border-color:transparent transparent transparent white;margin-left:4px;"></div>
          </div>
        </a>

        <!-- Body -->
        <div style="padding:28px 32px;">
          <p style="margin:0 0 16px;font-size:16px;color:#1a1a1a;line-height:1.6;">${personalGreeting}</p>
          <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.6;">${bodyText}</p>

          <a href="${watchUrl}" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">
            Watch Your Demo
          </a>

          <p style="margin:24px 0 0;font-size:13px;color:#888;line-height:1.5;">
            This video was created specifically for ${companyName} by Docs2Video — the AI platform that turns any document into a professional video in minutes.
          </p>
        </div>
      </div>

      <div style="text-align:center;padding:24px 0;font-size:12px;color:#999;">
        <a href="https://docs2video.com" style="color:#666;text-decoration:none;">Docs2Video</a> — Turn documents into videos, automatically.
      </div>
    </td></tr>
  </table>
</body>
</html>`

    // Send via Resend
    const { Resend } = require('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)

    const { error: sendError } = await resend.emails.send({
      from: 'Docs2Video <noreply@docs2video.com>',
      to: contactEmail,
      subject: subject,
      html: emailHtml,
    })

    if (sendError) {
      return NextResponse.json({ error: `Email send failed: ${sendError.message}` }, { status: 500 })
    }

    // Update prospect record
    await admin.from('prospect_demos').update({
      status: 'sent',
      contact_email: contactEmail,
      contact_name: contactName ?? null,
      email_subject: subject,
      email_body: bodyText,
      email_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', prospectId)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}
