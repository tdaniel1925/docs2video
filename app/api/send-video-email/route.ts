import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { checkRateLimit, rateLimit } from '../../_lib/rate-limit'
import { sendShareEmail } from '../../_lib/share-send'
export const maxDuration = 60

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

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

    // The email itself (load, compose, track, send, log to the client) is the
    // shared path in share-send.ts — a scheduled annual-review send uses it too.
    const result = await sendShareEmail(createAdminClient(), {
      userId: user.id,
      userEmail: user.email ?? null,
      videoId,
      clientEmail: toEmail,
      clientName: clientName ?? null,
      message: message ?? null,
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ success: true, via: result.via, tracked: result.tracked })
  } catch (err) {
    console.error('[send-video-email] Error:', err)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}

