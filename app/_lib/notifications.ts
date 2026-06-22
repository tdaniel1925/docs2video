import { Resend } from 'resend'
import twilio from 'twilio'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!)
  return _resend
}

function getTwilioClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
}

export async function sendDemoReadyEmail(
  to: string,
  companyName: string,
  videoUrl: string,
  signupUrl: string
) {
  try {
    await getResend().emails.send({
      from: 'Docs2Video <support@docs2video.com>',
      to,
      subject: `Your ${companyName} demo video is ready`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 22px; font-weight: 800; color: #1a1a1a; margin: 0;">Your demo is ready</h1>
          </div>
          <p style="font-size: 15px; line-height: 1.6; color: #444;">
            We just finished creating a branded explainer video for <strong>${companyName}</strong>. Take a look — it only takes 60 seconds to watch.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${videoUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px;">
              Watch Your Demo &rarr;
            </a>
          </div>
          <p style="font-size: 14px; line-height: 1.6; color: #444;">
            This is a quick demo with a watermark. With full access you get:
          </p>
          <ul style="font-size: 14px; line-height: 1.8; color: #444; padding-left: 20px;">
            <li>32 professional visual styles</li>
            <li>6 natural AI voices</li>
            <li>Your brand colors, logo, and contact info</li>
            <li>HD video with no watermark</li>
            <li>Shareable client page with payments and booking</li>
          </ul>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${signupUrl}" style="display: inline-block; background: #C7E8A8; color: #1a1a1a; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px;">
              Sign Up Free &rarr;
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
          <p style="font-size: 11px; color: #999; text-align: center;">
            Docs2Video &mdash; Turn any document into a professional video explainer.<br/>
            27675 Nelson Way, 225, Katy, TX 77494<br/>
            <a href="https://docs2video.com/privacy" style="color: #999;">Privacy Policy</a>
          </p>
        </div>
      `,
    })
    console.log(`[notify] Demo ready email sent to ${to}`)
  } catch (err) {
    console.error(`[notify] Failed to send email to ${to}:`, err)
  }
}

export async function sendDemoReadySms(
  to: string,
  companyName: string,
  demoPageUrl: string
) {
  try {
    const client = getTwilioClient()
    await client.messages.create({
      body: `Your ${companyName} demo video from Docs2Video is ready! Watch it here: ${demoPageUrl}`,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to,
    })
    console.log(`[notify] Demo ready SMS sent to ${to}`)
  } catch (err) {
    console.error(`[notify] Failed to send SMS to ${to}:`, err)
  }
}

/**
 * Email the video creator when their video finishes generating.
 */
export async function sendVideoReadyEmail(
  to: string,
  videoTitle: string,
  videoUrl: string
) {
  try {
    await getResend().emails.send({
      from: 'Docs2Video <notifications@docs2video.com>',
      to,
      subject: `Your video "${videoTitle}" is ready`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 22px; font-weight: 800; color: #1a1a1a; margin: 0;">Your video is ready!</h1>
          </div>
          <p style="font-size: 15px; line-height: 1.6; color: #444;">
            Great news &mdash; your video <strong>&ldquo;${videoTitle}&rdquo;</strong> has finished generating and is ready to view.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${videoUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px;">
              View Your Video &rarr;
            </a>
          </div>
          <p style="font-size: 13px; line-height: 1.6; color: #888;">
            You can share this video with clients from your dashboard, or copy the direct link above.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
          <p style="font-size: 11px; color: #999; text-align: center;">
            Docs2Video &mdash; Turn any document into a professional video explainer.<br/>
            <a href="https://docs2video.com/privacy" style="color: #999;">Privacy Policy</a>
          </p>
        </div>
      `,
    })
    console.log(`[notify] Video ready email sent to ${to}`)
  } catch (err) {
    console.error(`[notify] Failed to send video ready email to ${to}:`, err)
  }
}

/**
 * Email the video creator when a client views their shared video.
 */
/** Rich, optional context about a single video view (all fields best-effort). */
export interface ViewDetails {
  viewerIp?: string
  viewerName?: string | null   // client name if we can attribute the view
  device?: string | null       // 'Mobile' | 'Desktop' | 'Tablet'
  browser?: string | null      // e.g. 'Chrome', 'Safari'
  os?: string | null           // e.g. 'iOS', 'Windows'
  location?: string | null     // e.g. 'Austin, TX, US'
  referrer?: string | null     // where they came from
  viewNumber?: number | null   // Nth total view of this video
  isReturningViewer?: boolean  // has this IP/client viewed before
  viewedAt?: string | null     // human time string
  videoId?: string | null      // for the dashboard deep-link
}

/** Build the labeled stat rows shared by every view-notification email. */
function viewStatRows(d: ViewDetails): string {
  const rows: Array<[string, string]> = []
  if (d.viewerName) rows.push(['Viewer', d.viewerName])
  if (d.location) rows.push(['Location', d.location])
  if (d.device) rows.push(['Device', [d.device, d.os, d.browser].filter(Boolean).join(' · ')])
  if (d.viewedAt) rows.push(['Viewed', d.viewedAt])
  if (typeof d.viewNumber === 'number') {
    rows.push(['Total views', `${d.viewNumber}${d.isReturningViewer ? ' (returning viewer)' : ' (first time)'}`])
  }
  if (d.referrer) rows.push(['Came from', d.referrer])
  if (d.viewerIp) rows.push(['IP', d.viewerIp])
  return rows
    .map(([k, v]) =>
      `<tr><td style="padding:4px 12px 4px 0;color:#8A968D;font-size:12px;white-space:nowrap;">${k}</td><td style="padding:4px 0;color:#3a3a3a;font-size:13px;font-weight:600;">${v}</td></tr>`
    )
    .join('')
}

/** Standalone HTML body so connected-provider sends match the Resend fallback. */
export function buildVideoViewedHtml(videoTitle: string, d: ViewDetails = {}): string {
  const who = d.viewerName ? `<strong>${d.viewerName}</strong>` : 'Someone'
  const link = d.videoId ? `https://docs2video.com/videos/${d.videoId}` : 'https://docs2video.com/dashboard'
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="font-size:22px;font-weight:800;color:#1a1a1a;margin:0;">${d.isReturningViewer ? 'A viewer came back' : 'Your video was just viewed'}</h1>
      </div>
      <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 20px;">
        ${who} just opened your video <strong>&ldquo;${videoTitle}&rdquo;</strong>. ${d.isReturningViewer ? 'They are re-watching — a strong buying signal.' : 'They may reach out with questions soon.'}
      </p>
      <table style="border-collapse:collapse;margin:0 0 24px;width:100%;background:#F7F8F6;border-radius:8px;padding:8px;">
        ${viewStatRows(d) || '<tr><td style="padding:8px;color:#8A968D;font-size:12px;">View recorded.</td></tr>'}
      </table>
      <p style="text-align:center;margin:0 0 28px;">
        <a href="${link}" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 26px;border-radius:8px;">View full analytics →</a>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:0 0 16px;" />
      <p style="font-size:11px;color:#999;text-align:center;">
        Docs2Video &mdash; Turn any document into a professional video explainer.<br/>
        <a href="https://docs2video.com/privacy" style="color:#999;">Privacy Policy</a>
      </p>
    </div>
  `
}

export async function sendVideoViewedEmail(
  to: string,
  videoTitle: string,
  details: ViewDetails | string = {}
) {
  // Back-compat: old callers passed a bare IP string.
  const d: ViewDetails = typeof details === 'string' ? { viewerIp: details } : details
  try {
    await getResend().emails.send({
      from: 'Docs2Video <notifications@docs2video.com>',
      to,
      subject: `${d.viewerName ? d.viewerName + ' viewed' : 'Someone viewed'} your video "${videoTitle}"`,
      html: buildVideoViewedHtml(videoTitle, d),
    })
    console.log(`[notify] Video viewed email sent to ${to}`)
  } catch (err) {
    console.error(`[notify] Failed to send video viewed email to ${to}:`, err)
  }
}

/**
 * SMS the video creator when a client views their shared video.
 */
export async function sendVideoViewedSms(
  to: string,
  videoTitle: string,
  details: ViewDetails = {}
) {
  try {
    const client = getTwilioClient()
    const who = details.viewerName || 'A client'
    const where = details.location ? ` from ${details.location}` : ''
    const onWhat = details.device ? ` on ${details.device}` : ''
    const again = details.isReturningViewer ? ' (returning viewer)' : ''
    await client.messages.create({
      body: `${who}${where} just viewed your video "${videoTitle}"${onWhat}${again}. See details in Docs2Video.`,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to,
    })
    console.log(`[notify] Video viewed SMS sent to ${to}`)
  } catch (err) {
    console.error(`[notify] Failed to send video viewed SMS to ${to}:`, err)
  }
}
