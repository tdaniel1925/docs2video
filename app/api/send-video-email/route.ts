import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { checkRateLimit, rateLimit } from '../../_lib/rate-limit'
import { escapeHtml, messageToHtml, startsWithGreeting, sendWithResend, appUrl } from '../../_lib/client-email'
import type { EmailConnection } from '../../_lib/types'
export const maxDuration = 60

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
// Plans that get white-label (no Docs2Video name on client-facing pages/emails).
// Same list the share page uses.
const WHITELABEL_PLANS = ['enterprise', 'business']

/**
 * POST /api/send-video-email — "Share with client" from the video page.
 *
 * FIXES (audit H9):
 *   * A failed send used to say "sent". Resend v6 RETURNS its error instead of
 *     throwing, and the result was never read. Now every path checks the real
 *     outcome and the page is told the truth.
 *   * Every email said "Hi John, Hi John," — the page's message already starts
 *     with a greeting and this route added another. Now a greeting is added
 *     only when the message doesn't have one.
 *   * Paragraphs ran together (newlines were dropped into HTML). The message is
 *     now escaped and split into real paragraphs.
 *   * The tracking row wrote columns (recipient, sent_at) that the table does
 *     not have, so the insert failed and open-tracking never worked. It now
 *     writes to_email like every other writer and reader.
 *   * Rate-limited, so a stuck button or a script can't blast a client.
 *   * Sent from the agent's own connected mailbox when they have one, and
 *     without Docs2Video branding on white-label plans.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { videoId, clientName, clientEmail, message } = await req.json().catch(() => ({})) as {
      videoId?: string; clientName?: string; clientEmail?: string; message?: string
    }

    if (!videoId || !clientEmail) {
      return NextResponse.json({ error: 'videoId and clientEmail are required' }, { status: 400 })
    }
    const toEmail = String(clientEmail).toLowerCase().trim()
    if (!EMAIL_RE.test(toEmail)) {
      return NextResponse.json({ error: 'That email address doesn’t look right.' }, { status: 400 })
    }

    // Rate limits: in-memory (always works) + shared across servers (when the
    // rate_limit_hit function exists). 30 shares an hour per agent, and at
    // most 5 a day to the same person.
    if (!rateLimit(`send-video-email:${user.id}`, 30, 60 * 60 * 1000).allowed
      || !(await checkRateLimit(`send-video-email:user:${user.id}`, 30, 3600)).allowed) {
      return NextResponse.json({ error: 'You’ve sent a lot of emails in the last hour. Please wait a bit and try again.' }, { status: 429 })
    }
    if (!(await checkRateLimit(`send-video-email:to:${user.id}:${toEmail}`, 5, 86400)).allowed) {
      return NextResponse.json({ error: 'You’ve already emailed this person several times today. Please wait until tomorrow.' }, { status: 429 })
    }

    // Load video
    const { data: video } = await supabase
      .from('videos')
      .select('id, title, thumbnail_url, script, video_url, output_type')
      .eq('id', videoId)
      .eq('user_id', user.id)
      .single()

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    // Load sender profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, company_name, email, subscription_status')
      .eq('id', user.id)
      .single()

    const senderName = profile?.full_name || profile?.company_name || 'Your agent'
    const senderEmail = profile?.email || user.email || ''
    const isDeck = video.output_type === 'interactive' || video.output_type === 'deck'
    const thing = isDeck ? 'presentation' : 'video'
    const videoTitle = video.title || (isDeck ? 'Presentation' : 'Video Explainer')
    const shareUrl = `${appUrl()}/watch/${video.id}`
    const thumbnailUrl = /^https:\/\//i.test(String(video.thumbnail_url ?? '')) ? String(video.thumbnail_url) : ''
    const whiteLabel = WHITELABEL_PLANS.includes(String(profile?.subscription_status ?? '').toLowerCase())
    const name = String(clientName ?? '').trim().slice(0, 120)
    const customMessage = String(message ?? '').trim().slice(0, 5000) || `I've prepared a ${thing} overview for you.`

    // Detect insurance video for disclaimer
    const pipelineInput = (video.script as any)?._pipeline_input
    const isInsurance = !!(pipelineInput?.policyData?.deathBenefit)

    const disclaimerHtml = isInsurance ? `
      <div style="margin-top: 24px; padding: 16px; border-radius: 8px; background: #f8f9fa; border: 1px solid #e2e8f0;">
        <p style="font-size: 11px; line-height: 1.6; color: #666; margin: 0;">
          <strong>Important Disclosure:</strong> This video is for educational and informational purposes only and is not intended as legal, tax, or financial advice. Policy guarantees are based on the claims-paying ability of the issuing insurance company. Non-guaranteed values are subject to change. The policy contract and official carrier-issued illustration govern all policy values and guarantees. This video is not endorsed by or affiliated with any insurance carrier and is not a solicitation to purchase insurance. Please review all official policy materials and consult with your licensed professional before making any decisions.
        </p>
      </div>
    ` : ''

    const admin = createAdminClient()

    // The agent's own mailbox, if they connected one — the email then comes
    // from them, not from a Docs2Video address.
    const { data: connRow } = await admin
      .from('email_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_default', true)
      .limit(1)
      .maybeSingle()
    const connection = (connRow as EmailConnection | null) ?? null

    // RECORD THE SEND so it can be tracked. The row's id goes into an invisible
    // tracking pixel; when the client first opens the email, /api/email-track
    // stamps opened_at and notifies the sender. Written BEFORE sending (the id
    // must be in the email) and removed again if the send fails.
    const subjectLine = `${senderName} shared a ${thing}: ${videoTitle}`
    const sentEmailId = await recordShare(admin, {
      user_id: user.id,
      video_id: videoId,
      connection_id: connection?.id ?? null,
      to_email: toEmail,
      to_name: name || null,
      subject: subjectLine,
    })
    // The Watch button carries this email's id (?s=…). The share page passes
    // it along with its viewing events, so the result page can show how far
    // THIS person got. An email without a recorded row gets the plain link.
    const watchUrl = sentEmailId ? `${shareUrl}?s=${sentEmailId}` : shareUrl
    const trackPixel = sentEmailId
      ? `<img src="${appUrl()}/api/email-track?id=${sentEmailId}" width="1" height="1" alt="" style="display:block;" />`
      : ''

    const greeting = startsWithGreeting(customMessage)
      ? ''
      : `<p style="font-size: 15px; line-height: 1.6; color: #444; margin: 0 0 16px;">Hi${name ? ` ${escapeHtml(name)}` : ''},</p>`

    const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            ${whiteLabel ? '' : `<img src="${appUrl()}/logo.png" alt="Docs2Video" style="height: 32px; margin-bottom: 16px;" />`}
            <h1 style="font-size: 22px; font-weight: 800; color: #1a1a1a; margin: 0;">
              ${escapeHtml(senderName)} shared a ${thing} with you
            </h1>
          </div>

          ${greeting}
          ${messageToHtml(customMessage)}

          ${thumbnailUrl ? `
          <div style="margin: 24px 0; text-align: center;">
            <img src="${escapeHtml(thumbnailUrl)}" alt="${escapeHtml(videoTitle)}" style="width: 100%; max-width: 480px; border-radius: 10px; border: 1px solid #e2e8f0;" />
          </div>
          ` : ''}

          <div style="text-align: center; margin: 32px 0;">
            <a href="${watchUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px;">
              ${isDeck ? 'View Presentation' : 'Watch Video'} &rarr;
            </a>
          </div>

          ${disclaimerHtml}

          <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
          <p style="font-size: 11px; color: #999; text-align: center;">
            Sent by ${escapeHtml(senderName)}${whiteLabel ? '' : ' via Docs2Video<br/><a href="https://docs2video.com/privacy" style="color: #999;">Privacy Policy</a>'}
          </p>
          ${trackPixel}
        </div>
      `

    // SEND — and find out whether it really went.
    let via: 'mailbox' | 'docs2video' | null = null
    let failure = ''
    if (connection) {
      try {
        const { sendViaConnection } = await import('../../_lib/email')
        await sendViaConnection(connection, toEmail, subjectLine, html)
        via = 'mailbox'
      } catch (e) {
        // Their mailbox refused (expired login, etc.) — fall back to our sender
        // so the client still gets it. The agent is told which one it used.
        failure = e instanceof Error ? e.message : 'mailbox send failed'
        console.error('[send-video-email] connected mailbox failed, falling back:', failure)
      }
    }
    if (!via) {
      const res = await sendWithResend({
        from: whiteLabel ? `${senderName.replace(/[<>"]/g, '')} <notifications@docs2video.com>` : 'Docs2Video <notifications@docs2video.com>',
        to: toEmail,
        ...(senderEmail ? { replyTo: senderEmail } : {}),
        subject: subjectLine,
        html,
      })
      if (res.ok) via = 'docs2video'
      else failure = res.error
    }

    if (!via) {
      // Nothing went out: remove the tracking row so the history doesn't show
      // an email the client never got.
      if (sentEmailId) await admin.from('sent_emails').delete().eq('id', sentEmailId)
      console.error('[send-video-email] send failed:', failure)
      return NextResponse.json({ error: `The email service didn’t accept it (${failure.slice(0, 160)})` }, { status: 502 })
    }

    // Log to the client record only AFTER it really went.
    await logToClient(admin, user.id, toEmail, name, videoTitle, videoId)

    return NextResponse.json({ success: true, via, tracked: !!sentEmailId })
  } catch (err) {
    console.error('[send-video-email] Error:', err)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}

type Admin = ReturnType<typeof createAdminClient>

/**
 * Insert the sent_emails row. Tries with email_type (added by migration
 * 20260926); if that column isn't there yet, retries without it so open
 * tracking still works. Returns the row id, or null if it couldn't record.
 */
async function recordShare(admin: Admin, row: Record<string, unknown>): Promise<string | null> {
  const first = await admin.from('sent_emails').insert({ ...row, email_type: 'share' }).select('id').single()
  if (!first.error) return first.data?.id ?? null
  const second = await admin.from('sent_emails').insert(row).select('id').single()
  if (second.error) {
    console.error('[send-video-email] sent_emails insert failed (send continues):', second.error.message)
    return null
  }
  return second.data?.id ?? null
}

/** Find or create the client and add an "email sent" line to their history. */
async function logToClient(admin: Admin, userId: string, email: string, name: string, videoTitle: string, videoId: string) {
  try {
    const { data: existingClient } = await admin
      .from('clients')
      .select('id, total_videos_sent, status')
      .eq('user_id', userId)
      .eq('email', email)
      .maybeSingle()

    let cid = existingClient?.id
    if (!cid) {
      const { data: newClient } = await admin
        .from('clients')
        .insert({
          user_id: userId,
          name: name || email,
          email,
          source: 'email',
          status: 'active',
          total_videos_sent: 1,
          first_contact_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        })
        .select('id')
        .single()
      cid = newClient?.id
    } else {
      // Sending another video must not DOWNGRADE a client: an engaged or
      // converted client stays that way. Only new/cold ones become active.
      const promote = ['lead', 'inactive', null, undefined].includes(existingClient!.status as string | null | undefined)
      await admin
        .from('clients')
        .update({
          total_videos_sent: (existingClient!.total_videos_sent ?? 0) + 1,
          last_activity_at: new Date().toISOString(),
          ...(promote ? { status: 'active' } : {}),
        })
        .eq('id', cid)
    }

    if (cid) {
      await admin.from('client_activities').insert({
        client_id: cid,
        user_id: userId,
        type: 'email_sent',
        title: `Video email sent: ${videoTitle}`,
        description: `Sent "${videoTitle}" to ${email}`,
        metadata: { video_id: videoId, video_title: videoTitle },
      })
    }
  } catch (actErr) {
    console.error('[send-video-email] Activity log error:', actErr)
  }
}
