import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'
import { checkRateLimit, rateLimit } from '../../../../_lib/rate-limit'
import { escapeHtml, sendWithResend, appUrl } from '../../../../_lib/client-email'

export const runtime = 'nodejs'
export const maxDuration = 30

// =============================================================================
// "Ask a question" from the public share page → a REAL email to the video owner.
//
// A viewer on the closing slide can type a question. This emails it straight to
// the agent who made the video (their profile email), with the viewer's reply-to
// if they left one. No dead buttons: if we can't find an owner to email, or the
// email service refuses the message, we say so instead of pretending it sent.
//
// Public + unauthenticated, so it uses the admin client (RLS-bypassing) but only
// ever READS the owner of the named video — it never exposes the owner's
// address to the caller.
//
// RATE-LIMITED: it's an open form that sends email to a real person, so a
// script could otherwise flood an agent's inbox. 5 per hour per visitor per
// video, and 30 a day per video overall.
// =============================================================================

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body = await req.json().catch(() => null) as
      { question?: string; fromEmail?: string; fromName?: string } | null
    const question = String(body?.question ?? '').trim()
    if (!question) return NextResponse.json({ error: 'Type your question first.' }, { status: 400 })
    if (question.length > 2000) return NextResponse.json({ error: 'That question is too long.' }, { status: 400 })

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const tooMany = () => NextResponse.json({ error: 'You’ve sent several questions already — please wait a little and try again.' }, { status: 429 })
    if (!rateLimit(`watch-ask:${ip}:${id}`, 5, 60 * 60 * 1000).allowed) return tooMany()
    if (!(await checkRateLimit(`watch-ask:ip:${ip}:${id}`, 5, 3600)).allowed) return tooMany()
    if (!(await checkRateLimit(`watch-ask:video:${id}`, 30, 86400)).allowed) return tooMany()

    const fromEmail = String(body?.fromEmail ?? '').trim().toLowerCase()
    const fromName = String(body?.fromName ?? '').trim().slice(0, 120)
    // A supplied reply-to must be a real address, or we leave it off.
    const validReply = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fromEmail) ? fromEmail : ''

    const admin = createAdminClient()
    const { data: video } = await admin
      .from('videos')
      .select('id, title, user_id')
      .eq('id', id)
      .maybeSingle()
    if (!video) return NextResponse.json({ error: 'This presentation is no longer available.' }, { status: 404 })

    const { data: profile } = await admin
      .from('profiles')
      .select('full_name, company_name, email')
      .eq('id', video.user_id)
      .single()

    const ownerEmail = (profile?.email ?? '').trim()
    if (!ownerEmail) {
      // Be honest — nothing to send to.
      return NextResponse.json({ error: 'We couldn’t reach the presenter for this presentation.' }, { status: 422 })
    }
    const ownerName = escapeHtml(profile?.full_name || profile?.company_name || 'there')
    const rawTitle = String(video.title || 'your presentation').replace(/[\r\n]+/g, ' ')
    const title = escapeHtml(rawTitle)
    const watchUrl = `${appUrl()}/watch/${video.id}`

    const res = await sendWithResend({
      from: 'Docs2Video <notifications@docs2video.com>',
      to: ownerEmail,
      ...(validReply ? { replyTo: validReply } : {}),
      subject: `New question about "${rawTitle}"`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 20px;">
          <h1 style="font-size:20px;font-weight:800;color:#1a1a1a;margin:0 0 8px;">Someone asked a question</h1>
          <p style="font-size:14px;color:#555;margin:0 0 20px;">Hi ${ownerName}, a viewer of <strong>${title}</strong> just asked:</p>
          <div style="background:#f6f7f9;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px;font-size:15px;line-height:1.6;color:#222;white-space:pre-wrap;">${escapeHtml(question)}</div>
          <p style="font-size:13px;color:#666;margin:20px 0 0;">
            ${validReply ? `Reply straight to this email to answer ${escapeHtml(fromName || 'them')} (${escapeHtml(validReply)}).` : 'They didn’t leave an email, so you can’t reply directly — but you can follow up if you recognize them.'}
          </p>
          <p style="font-size:13px;margin:20px 0 0;"><a href="${watchUrl}" style="color:#0d9488;">Open the presentation →</a></p>
        </div>
      `,
    })
    if (!res.ok) {
      console.error('[watch/ask] email not accepted:', res.error)
      return NextResponse.json({ error: 'Your question could not be sent right now. Please try again in a few minutes.' }, { status: 502 })
    }

    // The email IS the deliverable. (No client_activities row: a random viewer
    // isn't a client — client_activities.client_id is NOT NULL — and forcing a
    // fake client to log this would be worse than the email the owner already got.)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[watch/ask] error:', err)
    return NextResponse.json({ error: 'Could not send your question. Please try again.' }, { status: 500 })
  }
}
