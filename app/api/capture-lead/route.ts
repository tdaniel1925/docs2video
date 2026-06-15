import { NextResponse } from 'next/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { Resend } from 'resend'

export const runtime = 'nodejs'
export const maxDuration = 30

// Simple in-memory rate limit: max 5 captures per video per hour
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(videoId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(videoId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(videoId, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return false
  }
  if (entry.count >= 5) return true
  entry.count++
  return false
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Escape user-supplied values before interpolating into the owner's HTML email
// (prevents HTML/phishing injection into the creator's inbox).
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export async function POST(request: Request) {
  try {
    const { videoId, email, name } = (await request.json()) as {
      videoId?: string
      email?: string
      name?: string
    }

    if (!videoId || !email) {
      return NextResponse.json({ error: 'Missing videoId or email' }, { status: 400 })
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    if (isRateLimited(videoId)) {
      return NextResponse.json({ error: 'Too many submissions' }, { status: 429 })
    }

    const supabase = createAdminClient()

    // Store lead in video_analytics table
    const viewerIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const userAgent = request.headers.get('user-agent') ?? 'unknown'

    await supabase.from('video_analytics').insert({
      video_id: videoId,
      event_type: 'lead_capture',
      viewer_ip: viewerIp,
      user_agent: userAgent,
      metadata: { email, name: name || null },
    })

    // Find video owner and send notification
    try {
      const { data: video } = await supabase
        .from('videos')
        .select('title, user_id')
        .eq('id', videoId)
        .single()

      if (video) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', video.user_id)
          .single()

        if (profile?.email && process.env.RESEND_API_KEY) {
          const resend = new Resend(process.env.RESEND_API_KEY)
          // Escape everything user-controlled before it enters the email HTML.
          const videoTitle = esc(video.title ?? 'Untitled')
          const safeEmail = esc(email.slice(0, 200))
          const safeName = name ? esc(name.slice(0, 120)) : ''
          await resend.emails.send({
            from: 'Docs2Video <notifications@docs2video.com>',
            to: profile.email,
            subject: `New lead on your video: ${videoTitle}`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 20px;">
                <h2 style="color: #1B3A5C; margin: 0 0 16px; font-size: 20px;">Someone left their email on your video</h2>
                <p style="color: #444; font-size: 14px; line-height: 1.6;">
                  A viewer expressed interest after watching <strong>"${videoTitle}"</strong>.
                </p>
                <div style="background: #F0F4F8; border-radius: 10px; padding: 16px 20px; margin: 20px 0;">
                  <div style="font-size: 13px; color: #7A8FA3; margin-bottom: 4px;">Email</div>
                  <div style="font-size: 15px; font-weight: 700; color: #1B3A5C;">${safeEmail}</div>
                  ${safeName ? `
                    <div style="font-size: 13px; color: #7A8FA3; margin: 12px 0 4px;">Name</div>
                    <div style="font-size: 15px; font-weight: 700; color: #1B3A5C;">${safeName}</div>
                  ` : ''}
                </div>
                <p style="color: #7A8FA3; font-size: 12px; margin-top: 24px;">
                  This lead was captured from your Docs2Video share page.
                </p>
              </div>
            `,
          })
        }
      }
    } catch (notifyErr) {
      console.error('[capture-lead] Notification error:', notifyErr)
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('[capture-lead] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
