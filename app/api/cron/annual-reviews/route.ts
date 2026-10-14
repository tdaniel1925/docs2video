import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { verifyCronAuth } from '../../../_lib/cron-auth'
import { recordCronRun } from '../../../_lib/cron-heartbeat'
import { alertOps } from '../../../_lib/ops-alert'
import { sendNotification } from '../../../_lib/notify'
import { sendShareEmail } from '../../../_lib/share-send'
import { appUrl, escapeHtml, sendWithResend } from '../../../_lib/client-email'
import { dateWords, dueWords, planReviewRun, todayIn, type ClientDates, type ReviewRow } from '../../../_lib/annual-review'
import { CLIENT_DATE_COLS, REVIEW_COLS, type ReviewFull } from '../../../_lib/annual-review-db'
import { alertMissingSchema, isMissingSchema } from '../../../_lib/feature-tables'

export const runtime = 'nodejs'
export const maxDuration = 300

/** A scheduled send that fails this many days running stops and tells the agent. */
const MAX_SEND_ATTEMPTS = 3

/**
 * Cron: ANNUAL REVIEW AUTOPILOT — daily (vercel.json).
 *  1. Every client with a CONFIRMED policy date whose anniversary is within
 *     30 days gets this year's review row (one per client per anniversary —
 *     the database refuses a second, so running twice is harmless).
 *  2. Each agent gets one email listing reviews newly 30 days out and newly
 *     7 days out. Each reminder is stamped on the row BEFORE it is counted
 *     (only the run that flips the stamp sends it), and un-stamped if the
 *     email fails, so the next run tries again.
 *  3. Reviews scheduled to send today go out through the normal Send path
 *     (share-send.ts) — claimed first, so two runs can't send one twice.
 * Home's "Today's clients" reads the same rows directly.
 * GET /api/cron/annual-reviews
 */
export async function GET(request: Request) {
  if (!verifyCronAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await recordCronRun('annual-reviews')
  const admin = createAdminClient()
  const now = new Date()

  const load = async () => {
    const [c, r, s] = await Promise.all([
      admin.from('clients').select(CLIENT_DATE_COLS).not('anniversary_date', 'is', null).eq('anniversary_confirmed', true).limit(10000),
      admin.from('client_reviews').select(REVIEW_COLS).gte('cycle_date', todayIn('UTC', new Date(now.getTime() - 86_400_000 * 2))).limit(10000),
      // A send day can come after the anniversary itself.
      admin.from('client_reviews').select(REVIEW_COLS).eq('status', 'scheduled').limit(5000),
    ])
    const err = c.error ?? r.error ?? s.error
    if (err) return { error: err }
    const reviews = new Map<string, ReviewFull>()
    for (const row of [...(r.data ?? []), ...(s.data ?? [])] as ReviewFull[]) reviews.set(row.id, row)
    return { clients: (c.data ?? []) as (ClientDates & { email: string | null })[], reviews: [...reviews.values()] }
  }

  let data = await load()
  if ('error' in data) {
    if (isMissingSchema(data.error)) { await alertMissingSchema('reviews', data.error?.message); return NextResponse.json({ ok: true, skipped: 'not migrated' }) }
    await alertOps({ source: 'cron', stage: 'annual-reviews', message: 'The annual reviews job could not read its tables.', detail: data.error?.message })
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  // 1. Create this year's reviews.
  const first = planReviewRun(data.clients, data.reviews as ReviewRow[], now)
  if (first.create.length) {
    const { error } = await admin.from('client_reviews').upsert(first.create.map((c) => ({ ...c, status: 'due' })), { onConflict: 'client_id,cycle_date', ignoreDuplicates: true })
    if (error) console.error('[annual-reviews] create failed:', error.message)
    data = await load()
    if ('error' in data) return NextResponse.json({ ok: false }, { status: 500 })
  }
  const plan = planReviewRun(data.clients, data.reviews as ReviewRow[], now)
  const clientName = new Map(data.clients.map((c) => [c.id, c.name]))
  const reviewByKey = new Map(data.reviews.map((r) => [`${r.client_id}|${r.cycle_date}`, r]))

  // 2. Reminders, grouped per agent. Stamp first (only rows WE flipped count).
  const perUser = new Map<string, { reviewId: string; clientId: string; which: '30' | '7'; daysLeft: number; cycleDate: string }[]>()
  for (const rem of plan.remind) {
    const row = reviewByKey.get(`${rem.clientId}|${rem.cycleDate}`)
    if (!row) continue
    const col = rem.which === '30' ? 'reminded_30_at' : 'reminded_7_at'
    const { data: flipped } = await admin.from('client_reviews').update({ [col]: now.toISOString() }).eq('id', row.id).is(col, null).select('id')
    if (!flipped?.length) continue
    const list = perUser.get(rem.userId) ?? []
    list.push({ ...rem, reviewId: row.id })
    perUser.set(rem.userId, list)
  }
  let emailed = 0
  for (const [userId, list] of perUser) {
    const { data: profile } = await admin.from('profiles').select('email, full_name').eq('id', userId).maybeSingle()
    const to = String(profile?.email ?? '').trim()
    const lines = list.sort((a, b) => a.daysLeft - b.daysLeft).map((l) => ({ name: clientName.get(l.clientId) ?? 'A client', words: dueWords(l.daysLeft), date: dateWords(l.cycleDate), href: `${appUrl()}/clients/${l.clientId}/review` }))
    const res = to ? await sendWithResend({
      from: 'Docs2Video <notifications@docs2video.com>',
      to,
      subject: list.length === 1 ? `${lines[0].name}: ${lines[0].words.toLowerCase()}` : `${list.length} annual reviews coming up`,
      html: reviewDigestHtml(profile?.full_name || 'there', lines),
    }) : { ok: false as const, error: 'no email' }
    if (res.ok) {
      emailed++
      for (const l of list) {
        await sendNotification(admin, userId, { type: 'review_due', title: `${clientName.get(l.clientId) ?? 'A client'}: ${dueWords(l.daysLeft).toLowerCase()}`, link: `/clients/${l.clientId}/review` }).catch(() => {})
      }
    } else {
      // Un-stamp so tomorrow's run tries again.
      for (const l of list) await admin.from('client_reviews').update({ [l.which === '30' ? 'reminded_30_at' : 'reminded_7_at']: null }).eq('id', l.reviewId)
    }
  }

  // 3. Scheduled sends due today.
  let sent = 0, failed = 0
  for (const s of plan.send) {
    const { data: claimed } = await admin.from('client_reviews').update({ status: 'sending', updated_at: new Date().toISOString() })
      .eq('id', s.reviewId).eq('status', 'scheduled').select(REVIEW_COLS)
    const row = (claimed?.[0] ?? null) as ReviewFull | null
    if (!row || !row.video_id || !row.send_to) continue
    const result = await sendShareEmail(admin, {
      userId: row.user_id, videoId: row.video_id, clientEmail: row.send_to, clientName: clientName.get(row.client_id) ?? null,
      message: 'Here’s your year in review — a short video of where your plan stands. Have a look, and let’s find a time to talk it through.',
    })
    if (result.ok) {
      sent++
      await admin.from('client_reviews').update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq('id', row.id)
      await sendNotification(admin, row.user_id, { type: 'review_sent', title: `Annual review sent to ${clientName.get(row.client_id) ?? 'your client'}`, link: `/clients/${row.client_id}/review` }).catch(() => {})
    } else {
      failed++
      const attempts = (row.send_attempts ?? 0) + 1
      const giveUp = attempts >= MAX_SEND_ATTEMPTS
      await admin.from('client_reviews').update({ status: giveUp ? 'send_failed' : 'scheduled', send_attempts: attempts, last_error: result.error.slice(0, 300), updated_at: new Date().toISOString() }).eq('id', row.id)
      if (giveUp) await sendNotification(admin, row.user_id, { type: 'review_failed', title: `The annual review for ${clientName.get(row.client_id) ?? 'your client'} didn’t send`, message: result.error.slice(0, 140), link: `/clients/${row.client_id}/review` }).catch(() => {})
    }
  }
  if (failed) await alertOps({ source: 'cron', stage: 'annual-reviews', message: `${failed} scheduled annual review email(s) did not send today (they retry tomorrow, up to ${MAX_SEND_ATTEMPTS} days).` })

  const out = { ok: true, created: first.create.length, reminders: [...perUser.values()].reduce((n, l) => n + l.length, 0), agentsEmailed: emailed, sent, failed }
  console.log('[annual-reviews]', JSON.stringify(out))
  return NextResponse.json(out)
}

function reviewDigestHtml(name: string, lines: { name: string; words: string; date: string; href: string }[]): string {
  const rows = lines.map((l) => `
    <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;color:#222;"><strong>${escapeHtml(l.name)}</strong><br/><span style="color:#666;font-size:13px;">${escapeHtml(l.words)} · ${escapeHtml(l.date)}</span></td>
    <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;"><a href="${l.href}" style="color:#0B2545;font-weight:700;font-size:13px;">Prepare review →</a></td></tr>`).join('')
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 20px;">
    <h1 style="font-size:20px;font-weight:800;color:#1a1a1a;margin:0 0 8px;">Annual reviews coming up</h1>
    <p style="font-size:14px;color:#555;margin:0 0 16px;">Hi ${escapeHtml(name)}, these clients’ policy anniversaries are close. A short “year in review” video is a friendly reason to get in touch.</p>
    <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    <p style="font-size:12px;color:#888;margin:20px 0 0;">Preparing one is free. You only pay when you press Make it, at the normal price.</p></div>`
}
