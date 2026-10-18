import { NextRequest, NextResponse, after } from 'next/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'
import { checkRateLimit, rateLimit } from '../../../../_lib/rate-limit'
import { sendWithResend, appUrl } from '../../../../_lib/client-email'
import { checkAsk } from '../../../../_lib/client-questions'
import { agentQuestionEmail, createQuestion, logEvent, runDraft } from '../../../../_lib/client-questions-db'
import { sendNotification } from '../../../../_lib/notify'

export const runtime = 'nodejs'
// The AI draft runs after the reply (after()), inside this budget.
export const maxDuration = 60

// =============================================================================
// "Ask a question" from the public share page.
//
// 1. Spam checks: a hidden honeypot field, a too-fast form, link spam, length
//    limits, and rate limits per visitor+video, per visitor per day, and per
//    video per day. A bot is told "thanks" and nothing happens.
// 2. The question is SAVED (client_questions + the audit log) and the agent is
//    emailed + gets a bell notice with a link to the reply screen.
// 3. The client is told "Your agent will reply shortly."
// 4. AFTER the reply, a draft answer is made from the video's document and
//    script (client-questions.ts). It is for the AGENT only — nothing reaches
//    the client until the agent approves it on /questions/[id].
//
// Before the migration has run (no client_questions table) this behaves
// exactly as before: the question is emailed to the agent and nothing else.
// Public + unauthenticated: it never exposes the owner's address.
// =============================================================================

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body = await req.json().catch(() => null)
    const ask = checkAsk(body)
    // A bot: say thanks, do nothing (no hint about what gave it away).
    if (ask.kind === 'bot') return NextResponse.json({ ok: true, message: 'Thanks — your agent will reply shortly.' })
    if (ask.kind === 'bad') return NextResponse.json({ error: ask.error }, { status: 400 })

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const tooMany = () => NextResponse.json({ error: 'You’ve sent several questions already — please wait a little and try again.' }, { status: 429 })
    if (!rateLimit(`watch-ask:${ip}:${id}`, 5, 60 * 60 * 1000).allowed) return tooMany()
    if (!(await checkRateLimit(`watch-ask:ip:${ip}:${id}`, 5, 3600)).allowed) return tooMany()
    if (!(await checkRateLimit(`watch-ask:ip-day:${ip}`, 20, 86400)).allowed) return tooMany()
    if (!(await checkRateLimit(`watch-ask:video:${id}`, 30, 86400)).allowed) return tooMany()

    const admin = createAdminClient()
    const { data: video } = await admin
      .from('videos')
      .select('id, title, user_id, client_id')
      .eq('id', id)
      .maybeSingle()
    if (!video) return NextResponse.json({ error: 'This presentation is no longer available.' }, { status: 404 })

    const { data: profile } = await admin
      .from('profiles')
      .select('full_name, company_name, email')
      .eq('id', video.user_id)
      .single()

    // Save it first: the agent can always find it in the app, even if the
    // email below doesn't go out.
    const saved = await createQuestion(admin, {
      video_id: video.id,
      user_id: video.user_id,
      client_id: (video as { client_id?: string | null }).client_id ?? null,
      question: ask.question,
      asker_name: ask.name || null,
      asker_email: ask.email || null,
    })
    const questionId = saved.ok ? saved.id : null

    const ownerEmail = (profile?.email ?? '').trim()
    if (!ownerEmail && !questionId) {
      // Nothing saved and nobody to email — be honest.
      return NextResponse.json({ error: 'We couldn’t reach the presenter for this presentation.' }, { status: 422 })
    }
    const rawTitle = String(video.title || 'your presentation').replace(/[\r\n]+/g, ' ')
    let emailed = false
    if (ownerEmail) {
      const mail = agentQuestionEmail({
        ownerName: profile?.full_name || profile?.company_name || 'there',
        title: rawTitle,
        question: ask.question,
        questionId,
        askerName: ask.name,
        askerEmail: ask.email,
        watchUrl: `${appUrl()}/watch/${video.id}`,
      })
      const res = await sendWithResend({
        from: 'Docs2Video <notifications@docs2video.com>',
        to: ownerEmail,
        ...(ask.email ? { replyTo: ask.email } : {}),
        subject: mail.subject,
        html: mail.html,
      })
      emailed = res.ok
      if (!res.ok) console.error('[watch/ask] email not accepted:', res.error)
    }

    if (!questionId) {
      // Old behaviour (migration not run): the email IS the deliverable.
      if (!emailed) return NextResponse.json({ error: 'Your question could not be sent right now. Please try again in a few minutes.' }, { status: 502 })
      return NextResponse.json({ ok: true, message: 'Your agent will reply shortly.' })
    }

    const q = { id: questionId, user_id: video.user_id }
    await logEvent(admin, q, 'system', emailed ? 'agent_emailed' : 'agent_email_failed', {})
    await sendNotification(admin, video.user_id, {
      type: 'client_question',
      title: `${ask.name || 'A client'} asked a question`,
      message: ask.question.slice(0, 140),
      link: `/questions/${questionId}`,
    }).catch(() => {})

    // The draft is made after the client already has their answer.
    after(() => runDraft(admin, questionId))

    return NextResponse.json({ ok: true, message: 'Your agent will reply shortly.' })
  } catch (err) {
    console.error('[watch/ask] error:', err)
    return NextResponse.json({ error: 'Could not send your question. Please try again.' }, { status: 500 })
  }
}
