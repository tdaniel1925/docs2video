import type { SupabaseClient } from '@supabase/supabase-js'
import {
  AI_DRAFTS_PER_ACCOUNT_DAY, AI_DRAFTS_PER_VIDEO_DAY, draftAnswer, UNSURE_ANSWER,
  type AnswerCall, type Citation,
} from './client-questions'
import { isRegulated } from './compliance'
import { alertMissingSchema, isMissingSchema } from './feature-tables'
import { appUrl, escapeHtml, messageToHtml, sendWithResend } from './client-email'

// =============================================================================
// CLIENT QUESTIONS — the database side. Every write here also writes a line to
// client_question_events (the audit log: append-only, see the migration).
// Every function fails SAFE: a missing table → `missing: true` (callers hide
// the feature) and one owner alert to run the migration.
// =============================================================================

type Admin = SupabaseClient
export type Actor = 'client' | 'ai' | 'agent' | 'system'

export type QuestionFull = {
  id: string
  video_id: string
  user_id: string
  client_id: string | null
  question: string
  asker_name: string | null
  asker_email: string | null
  status: string
  ai_draft: string | null
  ai_unsure: boolean | null
  ai_citations: Citation[] | null
  ai_model: string | null
  ai_cost_usd: number | null
  ai_note: string | null
  ai_drafted_at: string | null
  final_answer: string | null
  published: boolean
  answered_at: string | null
  client_emailed_at: string | null
  created_at: string
  updated_at: string
}

export const QUESTION_COLS = 'id, video_id, user_id, client_id, question, asker_name, asker_email, status, ai_draft, ai_unsure, ai_citations, ai_model, ai_cost_usd, ai_note, ai_drafted_at, final_answer, published, answered_at, client_emailed_at, created_at, updated_at'

/** Append one line to the audit log. Never throws. */
export async function logEvent(admin: Admin, q: { id: string; user_id: string }, actor: Actor, action: string, detail: Record<string, unknown> = {}): Promise<void> {
  try {
    const { error } = await admin.from('client_question_events').insert({ question_id: q.id, user_id: q.user_id, actor, action, detail })
    if (error) console.error('[client-questions] audit log write failed:', action, error.message)
  } catch (e) {
    console.error('[client-questions] audit log write failed:', action, e instanceof Error ? e.message : e)
  }
}

export type CreateResult = { ok: true; id: string } | { ok: false; missing: boolean }

export async function createQuestion(admin: Admin, row: {
  video_id: string; user_id: string; client_id: string | null; question: string; asker_name: string | null; asker_email: string | null
}): Promise<CreateResult> {
  const { data, error } = await admin.from('client_questions').insert({ ...row, status: 'new' }).select('id').single()
  if (error || !data) {
    if (isMissingSchema(error)) { await alertMissingSchema('questions', error?.message); return { ok: false, missing: true } }
    console.error('[client-questions] save failed:', error?.message)
    return { ok: false, missing: false }
  }
  await logEvent(admin, { id: data.id, user_id: row.user_id }, 'client', 'asked', {
    question: row.question, asker_name: row.asker_name, asker_email: row.asker_email,
  })
  return { ok: true, id: data.id }
}

/** AI drafts made in the last 24 h, for this video and this account. null = couldn't count. */
export async function draftsToday(admin: Admin, videoId: string, userId: string): Promise<{ video: number; account: number } | null> {
  const since = new Date(Date.now() - 86_400_000).toISOString()
  const [v, a] = await Promise.all([
    admin.from('client_questions').select('id', { count: 'exact', head: true }).eq('video_id', videoId).gte('ai_drafted_at', since),
    admin.from('client_questions').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('ai_drafted_at', since),
  ])
  if (v.error || a.error) return null
  return { video: v.count ?? 0, account: a.count ?? 0 }
}

/** The document + script a video's answers may use. */
export function answerContextOf(video: { draft_data?: unknown; script?: unknown; title?: string | null }): { extracted: unknown; scenes: unknown } {
  const dd = (video.draft_data && typeof video.draft_data === 'object' ? video.draft_data : {}) as Record<string, unknown>
  const sc = video.script as unknown
  const pi = sc && !Array.isArray(sc) && typeof sc === 'object' ? (sc as Record<string, unknown>)._pipeline_input as Record<string, unknown> | undefined : undefined
  const extracted = dd.extractedData ?? pi?.policyData ?? null
  const scenes = Array.isArray(sc) ? sc : Array.isArray(dd.scenes) ? dd.scenes : Array.isArray(dd.script) ? dd.script : Array.isArray(pi?.scenes) ? pi?.scenes : []
  return { extracted, scenes }
}

/**
 * Make the AI draft for one question (runs after the client has their answer
 * — "Your agent will reply shortly"). Free within the daily caps; over them,
 * the question waits for the agent with no draft. Never throws.
 */
export async function runDraft(admin: Admin, questionId: string, opts: { call?: AnswerCall | null } = {}): Promise<void> {
  try {
    const { data: q } = await admin.from('client_questions').select(QUESTION_COLS).eq('id', questionId).maybeSingle()
    if (!q || q.status !== 'new') return
    const row = q as QuestionFull
    const counts = await draftsToday(admin, row.video_id, row.user_id)
    if (!counts || counts.video >= AI_DRAFTS_PER_VIDEO_DAY || counts.account >= AI_DRAFTS_PER_ACCOUNT_DAY) {
      const note = !counts ? 'We couldn’t check today’s free AI limit, so no draft was made.' : 'Today’s free AI answers are used up, so no draft was made.'
      await admin.from('client_questions').update({ status: 'needs_reply', ai_note: note, updated_at: new Date().toISOString() }).eq('id', row.id).eq('status', 'new')
      await logEvent(admin, row, 'system', 'ai_skipped', { reason: note, counts })
      return
    }
    const { data: video } = await admin.from('videos').select('id, title, draft_data, script').eq('id', row.video_id).maybeSingle()
    const ctx = answerContextOf((video ?? {}) as Record<string, unknown>)
    const draft = await draftAnswer({ question: row.question, extracted: ctx.extracted, scenes: ctx.scenes, context: [video?.title] }, opts)
    const now = new Date().toISOString()
    const { error } = await admin.from('client_questions').update({
      status: draft.unsure ? 'needs_reply' : 'drafted',
      ai_draft: draft.answer,
      ai_unsure: draft.unsure,
      ai_citations: draft.citations,
      ai_model: draft.model,
      ai_cost_usd: draft.costUsd,
      ai_note: draft.note,
      ai_drafted_at: now,
      updated_at: now,
    }).eq('id', row.id).eq('status', 'new')
    if (error) console.error('[client-questions] draft save failed:', error.message)
    await logEvent(admin, row, 'ai', draft.unsure ? 'ai_unsure' : 'ai_drafted', {
      draft: draft.answer, citations: draft.citations, note: draft.note, cost_usd: draft.costUsd, model: draft.model,
    })
  } catch (e) {
    console.error('[client-questions] runDraft error:', e instanceof Error ? e.message : e)
  }
}

/** Is this video about insurance / money (so the strict rules apply)? */
export function videoIsRegulated(video: { title?: string | null; draft_data?: unknown; script?: unknown } | null): boolean {
  if (!video) return false
  const ctx = answerContextOf(video)
  return isRegulated(ctx.extracted, video.title)
}

// ── Emails ──────────────────────────────────────────────────────────────────

const WRAP = (inner: string) => `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 20px;">${inner}</div>`

/** The agent's email: the question, and the button to the reply screen. */
export function agentQuestionEmail(o: { ownerName: string; title: string; question: string; questionId: string | null; askerName: string; askerEmail: string; watchUrl: string }): { subject: string; html: string } {
  const replyUrl = o.questionId ? `${appUrl()}/questions/${o.questionId}` : ''
  const who = o.askerName || o.askerEmail || 'A viewer'
  return {
    subject: `New question about "${o.title}"`,
    html: WRAP(`
      <h1 style="font-size:20px;font-weight:800;color:#1a1a1a;margin:0 0 8px;">${escapeHtml(who)} asked a question</h1>
      <p style="font-size:14px;color:#555;margin:0 0 20px;">Hi ${escapeHtml(o.ownerName)}, about <strong>${escapeHtml(o.title)}</strong>:</p>
      <div style="background:#f6f7f9;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px;font-size:15px;line-height:1.6;color:#222;white-space:pre-wrap;">${escapeHtml(o.question)}</div>
      ${replyUrl ? `
      <p style="font-size:14px;color:#444;margin:20px 0 0;">We’re drafting an answer from their document. <strong>Nothing is sent until you approve it.</strong></p>
      <p style="margin:16px 0 0;"><a href="${replyUrl}" style="display:inline-block;background:#0B2545;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">Check the answer →</a></p>`
      : `<p style="font-size:13px;color:#666;margin:20px 0 0;">${o.askerEmail ? `Reply straight to this email to answer ${escapeHtml(o.askerName || 'them')} (${escapeHtml(o.askerEmail)}).` : 'They didn’t leave an email, so you can’t reply directly — but you can follow up if you recognize them.'}</p>`}
      <p style="font-size:13px;margin:20px 0 0;"><a href="${o.watchUrl}" style="color:#0d9488;">Open their page →</a></p>`),
  }
}

/** The client's email when the agent approves: the answer, and their page. */
export function clientAnswerEmail(o: { agentName: string; title: string; question: string; answer: string; watchUrl: string; whiteLabel: boolean }): { subject: string; html: string } {
  return {
    subject: `${o.agentName} answered your question`,
    html: WRAP(`
      <h1 style="font-size:20px;font-weight:800;color:#1a1a1a;margin:0 0 16px;">${escapeHtml(o.agentName)} answered your question</h1>
      <p style="font-size:13px;color:#666;margin:0 0 6px;">You asked about <strong>${escapeHtml(o.title)}</strong>:</p>
      <div style="background:#f6f7f9;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;font-size:14px;line-height:1.6;color:#444;white-space:pre-wrap;margin:0 0 16px;">${escapeHtml(o.question)}</div>
      ${messageToHtml(o.answer)}
      <p style="margin:20px 0 0;"><a href="${o.watchUrl}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">Back to your page →</a></p>
      <p style="font-size:11px;line-height:1.6;color:#888;margin:24px 0 0;">This answer comes from your agent and the document they shared with you. It is not a promise of coverage or of any result, and it is not legal, tax or financial advice. Your policy documents are what count.</p>
      <p style="font-size:11px;color:#999;margin:16px 0 0;">Sent by ${escapeHtml(o.agentName)}${o.whiteLabel ? '' : ' via Docs2Video'}</p>`),
  }
}

export { UNSURE_ANSWER }

/** Send the approved answer to the client. Returns whether it went. */
export async function sendClientAnswer(o: { to: string; replyTo: string | null; fromName: string; whiteLabel: boolean; subject: string; html: string }): Promise<{ ok: boolean; error?: string }> {
  const res = await sendWithResend({
    from: o.whiteLabel ? `${o.fromName.replace(/[<>"]/g, '')} <notifications@docs2video.com>` : 'Docs2Video <notifications@docs2video.com>',
    to: o.to,
    ...(o.replyTo ? { replyTo: o.replyTo } : {}),
    subject: o.subject,
    html: o.html,
  })
  return res.ok ? { ok: true } : { ok: false, error: res.error }
}
