import type { EmailConnection } from './types'

// Build branded HTML email template
export function buildEmailTemplate(options: {
  videoUrl?: string
  infographicUrl?: string
  thumbnailUrl?: string
  title: string
  clientName: string
  agentName: string
  agentPhoto?: string | null
  logoUrl?: string | null
  brandColors: { primary: string; secondary: string; accent: string }
  trackingPixelUrl?: string
}): string {
  const { videoUrl, infographicUrl, thumbnailUrl, title, clientName, agentName, agentPhoto, logoUrl, brandColors, trackingPixelUrl } = options
  const shareUrl = videoUrl ?? infographicUrl ?? ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;margin-top:20px;margin-bottom:20px;">
  <!-- Header -->
  <tr><td style="background:${brandColors.primary};padding:24px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      ${logoUrl ? `<td width="60"><img src="${logoUrl}" alt="" style="max-height:40px;max-width:120px;" /></td>` : ''}
      <td style="color:white;font-size:16px;font-weight:bold;">${agentName}</td>
    </tr></table>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:32px;">
    <h1 style="margin:0 0 8px;font-size:22px;color:#1a1a1a;">Hi ${clientName},</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
      I've put together a personalized overview of your policy. Click below to watch your explainer video.
    </p>

    <!-- Video/Image Preview -->
    ${thumbnailUrl ? `
    <a href="${shareUrl}" style="display:block;text-decoration:none;">
      <div style="position:relative;border-radius:8px;overflow:hidden;margin-bottom:24px;">
        <img src="${thumbnailUrl}" alt="${title}" style="width:100%;display:block;border-radius:8px;" />
        ${videoUrl ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:64px;height:64px;background:rgba(0,0,0,0.6);border-radius:50%;display:flex;align-items:center;justify-content:center;">
          <div style="width:0;height:0;border-left:24px solid white;border-top:14px solid transparent;border-bottom:14px solid transparent;margin-left:4px;"></div>
        </div>` : ''}
      </div>
    </a>` : ''}

    <p style="margin:0 0 8px;font-size:14px;color:#888;font-weight:bold;">${title}</p>

    <!-- CTA Button -->
    <a href="${shareUrl}" style="display:inline-block;background:${brandColors.primary};color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;margin-top:16px;">
      ${videoUrl ? 'Watch Your Video' : 'View Your Infographic'}
    </a>

    <hr style="border:none;border-top:1px solid #eee;margin:32px 0;" />

    <!-- Agent info -->
    <table cellpadding="0" cellspacing="0"><tr>
      ${agentPhoto ? `<td width="56" style="padding-right:12px;"><img src="${agentPhoto}" alt="" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /></td>` : ''}
      <td>
        <p style="margin:0;font-size:14px;font-weight:bold;color:#1a1a1a;">${agentName}</p>
        <p style="margin:2px 0 0;font-size:13px;color:#888;">Your Insurance Professional</p>
      </td>
    </tr></table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#fafafa;padding:16px 32px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#aaa;">Sent by ${agentName}</p>
  </td></tr>
</table>
${trackingPixelUrl ? `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" />` : ''}
</body>
</html>`
}

// Send email via SMTP
export async function sendViaSMTP(
  connection: EmailConnection,
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const nodemailer = require('nodemailer')
  const transport = nodemailer.createTransport({
    host: connection.smtp_host,
    port: connection.smtp_port ?? 587,
    secure: (connection.smtp_port ?? 587) === 465,
    auth: {
      user: connection.smtp_user,
      pass: connection.smtp_pass,
    },
  })

  await transport.sendMail({
    from: `"${connection.email_address}" <${connection.email_address}>`,
    to,
    subject,
    html,
  })
}

// Send email via Google Gmail API
export async function sendViaGoogle(
  connection: EmailConnection,
  to: string,
  subject: string,
  html: string
): Promise<void> {
  // Refresh token if expired
  let accessToken = connection.access_token
  if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
    accessToken = await refreshGoogleToken(connection.refresh_token!)
  }

  const rawMessage = createMimeMessage(connection.email_address, to, subject, html)
  const encoded = Buffer.from(rawMessage).toString('base64url')

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encoded }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Gmail API error: ${err.error?.message ?? res.statusText}`)
  }
}

// Send email via Microsoft Graph API
export async function sendViaMicrosoft(
  connection: EmailConnection,
  to: string,
  subject: string,
  html: string
): Promise<void> {
  let accessToken = connection.access_token
  if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
    accessToken = await refreshMicrosoftToken(connection.refresh_token!)
  }

  const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: html },
        toRecipients: [{ emailAddress: { address: to } }],
      },
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Microsoft Graph error: ${err.error?.message ?? res.statusText}`)
  }
}

function createMimeMessage(from: string, to: string, subject: string, html: string): string {
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    html,
  ].join('\r\n')
}

async function refreshGoogleToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  return data.access_token
}

async function refreshMicrosoftToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: 'Mail.Send offline_access',
    }),
  })
  const data = await res.json()
  return data.access_token
}
