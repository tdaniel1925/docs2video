import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '../../_lib/supabase/server'
export const maxDuration = 60

let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!)
  return _resend
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { videoId, clientName, clientEmail, message } = await req.json()

    if (!videoId || !clientEmail) {
      return NextResponse.json({ error: 'videoId and clientEmail are required' }, { status: 400 })
    }

    // Load video
    const { data: video } = await supabase
      .from('videos')
      .select('id, title, thumbnail_url, script, video_url')
      .eq('id', videoId)
      .eq('user_id', user.id)
      .single()

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    // Load sender profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, company_name, email')
      .eq('id', user.id)
      .single()

    const senderName = profile?.company_name || profile?.full_name || 'Your agent'
    const senderEmail = profile?.email || user.email || ''
    const videoTitle = video.title || 'Video Explainer'
    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.docs2video.com'}/watch/${video.id}`
    const thumbnailUrl = video.thumbnail_url || ''
    const customMessage = message?.trim() || "I've prepared a video overview for you."

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

    // Find or create client for activity logging
    const { createAdminClient } = await import('../../_lib/supabase/admin')
    const admin = createAdminClient()
    try {
      const normalizedEmail = clientEmail.toLowerCase().trim()
      const { data: existingClient } = await admin
        .from('clients')
        .select('id, total_videos_sent')
        .eq('user_id', user.id)
        .eq('email', normalizedEmail)
        .single()

      let cid = existingClient?.id
      if (!cid) {
        const { data: newClient } = await admin
          .from('clients')
          .insert({
            user_id: user.id,
            name: clientName || normalizedEmail,
            email: normalizedEmail,
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
        await admin
          .from('clients')
          .update({
            total_videos_sent: (existingClient!.total_videos_sent ?? 0) + 1,
            last_activity_at: new Date().toISOString(),
            status: 'active',
          })
          .eq('id', cid)
      }

      if (cid) {
        await admin.from('client_activities').insert({
          client_id: cid,
          user_id: user.id,
          type: 'email_sent',
          title: `Video email sent: ${videoTitle}`,
          description: `Sent "${videoTitle}" to ${normalizedEmail}`,
          metadata: { video_id: videoId, video_title: videoTitle },
        })
      }
    } catch (actErr) {
      console.error('[send-video-email] Activity log error:', actErr)
    }

    await getResend().emails.send({
      from: 'Docs2Video <notifications@docs2video.com>',
      to: clientEmail,
      replyTo: senderEmail,
      subject: `${senderName} shared a video: ${videoTitle}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <img src="${process.env.NEXT_PUBLIC_APP_URL || 'https://app.docs2video.com'}/logo.png" alt="Docs2Video" style="height: 32px; margin-bottom: 16px;" />
            <h1 style="font-size: 22px; font-weight: 800; color: #1a1a1a; margin: 0;">
              ${senderName} shared a video with you
            </h1>
          </div>

          <p style="font-size: 15px; line-height: 1.6; color: #444;">
            Hi${clientName ? ` ${clientName}` : ''},
          </p>
          <p style="font-size: 15px; line-height: 1.6; color: #444;">
            ${customMessage}
          </p>

          ${thumbnailUrl ? `
          <div style="margin: 24px 0; text-align: center;">
            <img src="${thumbnailUrl}" alt="${videoTitle}" style="width: 100%; max-width: 480px; border-radius: 10px; border: 1px solid #e2e8f0;" />
          </div>
          ` : ''}

          <div style="text-align: center; margin: 32px 0;">
            <a href="${shareUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px;">
              Watch Video &rarr;
            </a>
          </div>

          ${disclaimerHtml}

          <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
          <p style="font-size: 11px; color: #999; text-align: center;">
            Sent by ${senderName} via Docs2Video<br/>
            <a href="https://docs2video.com/privacy" style="color: #999;">Privacy Policy</a>
          </p>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[send-video-email] Error:', err)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
