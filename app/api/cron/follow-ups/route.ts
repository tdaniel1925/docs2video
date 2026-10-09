import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { verifyCronAuth } from '../../../_lib/cron-auth'
import { recordCronRun } from '../../../_lib/cron-heartbeat'
import { GoogleGenAI } from '@google/genai'
import { pickFollowUpStage, FOLLOW_UP_TYPES, OPEN_QUOTE_STATUSES, FOLLOW_UP_STAGES, type FollowUpType } from '../../../_lib/follow-up-schedule'
import { escapeHtml, messageToHtml, appUrl } from '../../../_lib/client-email'
import { unsubscribeUrl } from '../../../_lib/unsubscribe-token'
import type { EmailConnection } from '../../../_lib/types'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Cron: automatic follow-up emails on open quotes. Daily, 9 AM UTC (vercel.json).
 *
 * WHAT WAS WRONG (audit C5). The old job emailed every client whose quote was
 * still "sent" — which was every quote, because nothing ever marked one paid.
 * Clients were chased after paying. The agent never turned it on. There was no
 * unsubscribe link. It read a video_views column that does not exist, and the
 * duplicate check never saw the emails it had just sent, so depending on the
 * database it either never ran or sent several copies a day, out of order.
 *
 * WHAT IT DOES NOW:
 *   * Only quotes the agent switched "Automatic follow-ups" ON for.
 *   * Only open quotes. Paid / accepted / declined (the agent marks these on
 *     the video page) and converted clients are never emailed again.
 *   * Every email has a signed unsubscribe link, and opt-outs are honored.
 *   * One email per quote per stage — recorded BEFORE sending, so an overlap
 *     or a retry can't double-send (the database refuses the second record).
 *     Stage rules live in follow-up-schedule.ts.
 *   * FAILS SAFE: if the database hasn't been updated for this yet (migration
 *     20260926_client_emails_followups.sql), it sends nothing at all.
 */

const MAX_SENDS_PER_RUN = 25
const DAY_MS = 24 * 60 * 60 * 1000

let _genai: GoogleGenAI | null = null
function genai(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) return null
  if (!_genai) _genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  return _genai
}

interface QuoteRow {
  id: string
  user_id: string
  video_id: string | null
  client_name: string | null
  client_email: string | null
  status: string | null
  created_at: string
  auto_follow_up: boolean
}

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Heartbeat: the health cron emails Trent if this stops running (audit 2026-10-09).
  await recordCronRun('follow-ups')

  const supabase = createAdminClient()
  const now = new Date()
  const earliestStageDays = Math.min(...FOLLOW_UP_STAGES.map(s => s.day))
  const dueBefore = new Date(now.getTime() - earliestStageDays * DAY_MS).toISOString()

  let sentCount = 0
  const errors: string[] = []

  try {
    // 1. Quotes the agent opted in, still open, old enough for a first stage.
    //    An error here (most likely: the auto_follow_up column isn't there yet)
    //    means we cannot tell who opted in — so nobody gets an email.
    const { data: quotesData, error: quotesErr } = await supabase
      .from('quotes')
      .select('id, user_id, video_id, client_name, client_email, status, created_at, auto_follow_up')
      .eq('auto_follow_up', true)
      .in('status', [...OPEN_QUOTE_STATUSES])
      .not('client_email', 'is', null)
      .lte('created_at', dueBefore)
      .order('created_at', { ascending: true })
      .limit(500)
    if (quotesErr) {
      console.error('[cron/follow-ups] quotes query failed — sending nothing:', quotesErr.message)
      return NextResponse.json({ message: 'Skipped: quotes not readable (migration pending?)', sent: 0 })
    }
    const quotes = (quotesData ?? []) as QuoteRow[]
    if (quotes.length === 0) {
      return NextResponse.json({ message: 'No quotes due for a follow-up', sent: 0 })
    }

    const quoteIds = quotes.map(q => q.id)
    const ownerIds = [...new Set(quotes.map(q => q.user_id))]

    // 2. Follow-ups already sent, per quote. Same rule: can't read it → send nothing.
    const { data: prior, error: priorErr } = await supabase
      .from('sent_emails')
      .select('quote_id, email_type, created_at')
      .in('quote_id', quoteIds)
      .in('email_type', FOLLOW_UP_TYPES)
    if (priorErr) {
      console.error('[cron/follow-ups] sent_emails dedupe query failed — sending nothing:', priorErr.message)
      return NextResponse.json({ message: 'Skipped: send history not readable (migration pending?)', sent: 0 })
    }
    const sentByQuote = new Map<string, { type: string; at: string }[]>()
    for (const r of prior ?? []) {
      if (!r.quote_id) continue
      const list = sentByQuote.get(r.quote_id) ?? []
      list.push({ type: r.email_type, at: r.created_at })
      sentByQuote.set(r.quote_id, list)
    }

    // 3. Unsubscribes. Can't read them → can't honor them → send nothing.
    const { data: supp, error: suppErr } = await supabase
      .from('email_suppressions')
      .select('user_id, email')
      .in('user_id', ownerIds)
    if (suppErr) {
      console.error('[cron/follow-ups] suppressions query failed — sending nothing:', suppErr.message)
      return NextResponse.json({ message: 'Skipped: unsubscribe list not readable (migration pending?)', sent: 0 })
    }
    const suppressed = new Set((supp ?? []).map(s => `${s.user_id}:${String(s.email).toLowerCase().trim()}`))

    // 4. Clients the agent already won. A deal that's done is not chased.
    const { data: converted, error: convErr } = await supabase
      .from('clients')
      .select('user_id, email')
      .in('user_id', ownerIds)
      .eq('status', 'converted')
    if (convErr) {
      console.error('[cron/follow-ups] clients query failed — sending nothing:', convErr.message)
      return NextResponse.json({ message: 'Skipped: clients not readable', sent: 0 })
    }
    const convertedSet = new Set((converted ?? []).map(c => `${c.user_id}:${String(c.email ?? '').toLowerCase().trim()}`))

    // Per-owner lookups, cached for the run.
    const connCache = new Map<string, EmailConnection | null>()
    const profileCache = new Map<string, { full_name: string | null; company_name: string | null } | null>()

    for (const quote of quotes) {
      if (sentCount >= MAX_SENDS_PER_RUN) break
      const clientEmail = String(quote.client_email ?? '').toLowerCase().trim()
      const key = `${quote.user_id}:${clientEmail}`
      const already = sentByQuote.get(quote.id) ?? []

      const stage = pickFollowUpStage({
        status: quote.status,
        autoFollowUp: quote.auto_follow_up === true,
        clientEmail,
        sentAt: quote.created_at,
        now,
        alreadySent: already,
        unsubscribed: suppressed.has(key),
        clientConverted: convertedSet.has(key),
      })
      if (!stage) continue
      if (!quote.video_id) continue

      const { data: video } = await supabase
        .from('videos')
        .select('id, title, status, user_id')
        .eq('id', quote.video_id)
        .maybeSingle()
      // Only follow up on a presentation the client can actually open.
      if (!video || video.user_id !== quote.user_id || video.status !== 'completed') continue

      if (!connCache.has(quote.user_id)) {
        const { data: c } = await supabase
          .from('email_connections')
          .select('*')
          .eq('user_id', quote.user_id)
          .eq('is_default', true)
          .limit(1)
          .maybeSingle()
        connCache.set(quote.user_id, (c as EmailConnection | null) ?? null)
      }
      const connection = connCache.get(quote.user_id)
      if (!connection) continue // follow-ups go from the agent's own mailbox only

      if (!profileCache.has(quote.user_id)) {
        const { data: p } = await supabase
          .from('profiles')
          .select('full_name, company_name')
          .eq('id', quote.user_id)
          .maybeSingle()
        profileCache.set(quote.user_id, p ?? null)
      }
      const profile = profileCache.get(quote.user_id)

      // No working unsubscribe link → this automated email must not go out.
      const unsub = unsubscribeUrl({ k: 'client', id: quote.user_id, e: clientEmail })
      if (!unsub) {
        errors.push(`${quote.id}: no unsubscribe signing secret configured`)
        continue
      }

      const agentName = profile?.full_name || profile?.company_name || 'Your advisor'
      const clientName = (quote.client_name || '').trim()
      const videoTitle = video.title || 'your presentation'
      const watchUrl = `${appUrl()}/watch/${video.id}`
      const { subject, bodyText } = await writeFollowUp(stage, { agentName, clientName, videoTitle })

      const html = buildFollowUpHtml({ clientName, bodyText, agentName, watchUrl, unsubUrl: unsub })

      // Record FIRST. The unique index on (quote_id, email_type) makes this the
      // lock: if another run already recorded this stage, the insert fails and
      // we skip — so a stage can never go out twice.
      const { data: reserved, error: reserveErr } = await supabase
        .from('sent_emails')
        .insert({
          user_id: quote.user_id,
          video_id: video.id,
          quote_id: quote.id,
          connection_id: connection.id,
          email_type: stage,
          to_email: clientEmail,
          to_name: clientName || null,
          subject,
        })
        .select('id')
        .single()
      if (reserveErr || !reserved) {
        if (reserveErr) console.warn(`[cron/follow-ups] could not record ${stage} for quote ${quote.id} — skipping:`, reserveErr.message)
        continue
      }

      try {
        const { sendViaConnection } = await import('../../../_lib/email')
        await sendViaConnection(connection, clientEmail, subject, html)
        sentCount++
        // Update the in-run history too, so nothing later in this loop repeats it.
        sentByQuote.set(quote.id, [...already, { type: stage, at: now.toISOString() }])
      } catch (sendErr) {
        // It didn't go — remove the record so tomorrow's run can try again.
        await supabase.from('sent_emails').delete().eq('id', reserved.id)
        const msg = sendErr instanceof Error ? sendErr.message : 'Unknown send error'
        errors.push(`${quote.id}: ${msg}`)
        console.error(`[cron/follow-ups] Send error for quote ${quote.id}:`, sendErr)
      }
    }
  } catch (err) {
    console.error('[cron/follow-ups] Fatal error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({
    message: 'Follow-up cron complete',
    sent: sentCount,
    errors: errors.length > 0 ? errors : undefined,
  })
}

/** Subject + plain-text body. AI-written when available, a fixed text otherwise. */
async function writeFollowUp(
  stage: FollowUpType,
  ctx: { agentName: string; clientName: string; videoTitle: string },
): Promise<{ subject: string; bodyText: string }> {
  const fallback = stage === 'follow_up_7day'
    ? {
        subject: `Any questions about "${ctx.videoTitle}"?`,
        bodyText: `I wanted to follow up one more time on the presentation I shared, "${ctx.videoTitle}". If you have any questions, I'm happy to set up a quick call.`,
      }
    : {
        subject: `Quick follow-up: ${ctx.videoTitle}`,
        bodyText: `I wanted to make sure you received the presentation I prepared for you, "${ctx.videoTitle}". Feel free to reach out with any questions.`,
      }

  const ai = genai()
  if (!ai) return fallback
  try {
    const prompt = `Write a short follow-up email from a professional to their client about a presentation and quote they sent.

Context:
- From: ${ctx.agentName}
- To: ${ctx.clientName || 'the client'}
- Presentation: "${ctx.videoTitle}"
- This is the ${stage === 'follow_up_7day' ? 'second and final' : 'first'} follow-up, ${stage === 'follow_up_7day' ? 'about a week' : 'a few days'} after it was sent.

Rules:
- 2-4 sentences. Warm, professional, not pushy.${stage === 'follow_up_7day' ? ' Offer a quick call.' : ''}
- No greeting line and no sign-off — those are added separately.
- Plain text only. No links (a button is added separately).

Return ONLY valid JSON (no markdown, no code fences):
{"subject": "email subject", "body": "the email body"}`
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt })
    const text = (response.text ?? '').trim().replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed = JSON.parse(text) as { subject?: unknown; body?: unknown }
    const subject = typeof parsed.subject === 'string' ? parsed.subject.trim().slice(0, 150) : ''
    const bodyText = typeof parsed.body === 'string' ? parsed.body.trim().slice(0, 1500) : ''
    if (!subject || !bodyText) return fallback
    return { subject, bodyText }
  } catch (e) {
    console.error('[cron/follow-ups] AI draft failed, using fixed text:', e)
    return fallback
  }
}

function buildFollowUpHtml(o: { clientName: string; bodyText: string; agentName: string; watchUrl: string; unsubUrl: string }): string {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#333;">
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hi ${escapeHtml(o.clientName || 'there')},</p>
  ${messageToHtml(o.bodyText, 'margin:0 0 16px;font-size:14px;line-height:1.6;color:#555;')}
  <p style="margin:24px 0;"><a href="${escapeHtml(o.watchUrl)}" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 26px;border-radius:8px;">View the presentation</a></p>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#555;">Best,<br/>${escapeHtml(o.agentName)}</p>
  <hr style="border:none;border-top:1px solid #eee;margin:28px 0 12px;" />
  <p style="font-size:11px;color:#999;line-height:1.5;margin:0;">This is an automatic reminder from ${escapeHtml(o.agentName)}. <a href="${escapeHtml(o.unsubUrl)}" style="color:#999;">Unsubscribe from these reminders</a>.</p>
</div>`
}
