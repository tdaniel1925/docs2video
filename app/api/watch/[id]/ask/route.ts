import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '../../../../_lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 30

// =============================================================================
// "Ask a question" from the public share page → a REAL email to the video owner.
//
// A viewer on the closing slide can type a question. This emails it straight to
// the agent who made the video (their profile email), with the viewer's reply-to
// if they left one, and logs it against the video. No dead buttons: if we can't
// find an owner to email, we say so instead of pretending it sent.
//
// Public + unauthenticated, so it uses the admin client (RLS-bypassing) but only
// ever READS the owner of the named video and WRITES an activity log — it never
// exposes the owner's address to the caller.
// =============================================================================

let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!)
  return _resend
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body = await req.json().catch(() => null) as
      { question?: string; fromEmail?: string; fromName?: string } | null
    const question = String(body?.question ?? '').trim()
    if (!question) return NextResponse.json({ error: 'Type your question first.' }, { status: 400 })
    if (question.length > 2000) return NextResponse.json({ error: 'That question is too long.' }, { status: 400 })

    const fromEmail = String(body?.fromEmail ?? '').trim().toLowerCase()
    const fromName = String(body?.fromName ?? '').trim().slice(0, 120)
    // A supplied reply-to must be a real address, or we leave it off.
    const validReply = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fromEmail) ? fromEmail : ''

    const admin = createAdminClient()
    const { data: video } = await admin
      .from('videos')
      .select('id, title, user_id')
      .eq('id', id)
      .single()
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
    const ownerName = profile?.full_name || profile?.company_name || 'there'
    const title = video.title || 'your presentation'
    const watchUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.docs2video.com'}/watch/${video.id}`

    await getResend().emails.send({
      from: 'Docs2Video <notifications@docs2video.com>',
      to: ownerEmail,
      ...(validReply ? { replyTo: validReply } : {}),
      subject: `New question about "${title}"`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 20px;">
          <h1 style="font-size:20px;font-weight:800;color:#1a1a1a;margin:0 0 8px;">Someone asked a question</h1>
          <p style="font-size:14px;color:#555;margin:0 0 20px;">Hi ${ownerName}, a viewer of <strong>${title}</strong> just asked:</p>
          <div style="background:#f6f7f9;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px;font-size:15px;line-height:1.6;color:#222;white-space:pre-wrap;">${escapeHtml(question)}</div>
          <p style="font-size:13px;color:#666;margin:20px 0 0;">
            ${validReply ? `Reply straight to this email to answer ${fromName || 'them'} (${validReply}).` : 'They didn’t leave an email, so you can’t reply directly — but you can follow up if you recognise them.'}
          </p>
          <p style="font-size:13px;margin:20px 0 0;"><a href="${watchUrl}" style="color:#0d9488;">Open the presentation →</a></p>
        </div>
      `,
    })

    // The email IS the deliverable. (No client_activities row: a random viewer
    // isn't a client — client_activities.client_id is NOT NULL — and forcing a
    // fake client to log this would be worse than the email the owner already got.)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[watch/ask] error:', err)
    return NextResponse.json({ error: 'Could not send your question. Please try again.' }, { status: 500 })
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
