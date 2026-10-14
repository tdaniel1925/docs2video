import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { appUrl } from '../../../_lib/client-email'
import { checkApproval } from '../../../_lib/client-questions'
import {
  clientAnswerEmail, logEvent, QUESTION_COLS, sendClientAnswer, videoIsRegulated, type QuestionFull,
} from '../../../_lib/client-questions-db'
import { alertMissingSchema, isMissingSchema } from '../../../_lib/feature-tables'

export const runtime = 'nodejs'
export const maxDuration = 30

const WHITELABEL_PLANS = ['enterprise', 'business']

type Ctx = { params: Promise<{ id: string }> }

async function load(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { res: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) } as const
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { res: NextResponse.json({ error: 'Question not found' }, { status: 404 }) } as const
  const admin = createAdminClient()
  const { data, error } = await admin.from('client_questions').select(QUESTION_COLS).eq('id', id).eq('user_id', user.id).maybeSingle()
  if (error) {
    if (isMissingSchema(error)) {
      await alertMissingSchema('questions', error.message)
      return { res: NextResponse.json({ available: false, error: 'Client questions aren’t switched on yet.' }, { status: 503 }) } as const
    }
    return { res: NextResponse.json({ error: 'Could not load the question.' }, { status: 500 }) } as const
  }
  if (!data) return { res: NextResponse.json({ error: 'Question not found' }, { status: 404 }) } as const
  return { user, admin, q: data as QuestionFull } as const
}

/** GET — the question, the AI draft with where it came from, the video, the
 *  client (for "Call instead") and the full audit trail. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const r = await load(id)
  if ('res' in r) return r.res
  const { admin, q, user } = r
  const [{ data: video }, { data: events }, clientRes] = await Promise.all([
    admin.from('videos').select('id, title, draft_data, script, thumbnail_url').eq('id', q.video_id).eq('user_id', user.id).maybeSingle(),
    admin.from('client_question_events').select('actor, action, detail, created_at').eq('question_id', q.id).order('created_at', { ascending: true }).limit(100),
    q.client_id ? admin.from('clients').select('id, name, phone, email').eq('id', q.client_id).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  return NextResponse.json({
    available: true,
    question: q,
    video: video ? { id: video.id, title: video.title || 'Untitled', thumbnail_url: video.thumbnail_url ?? null } : null,
    client: clientRes.data ?? null,
    regulated: videoIsRegulated(video ?? null),
    events: events ?? [],
  })
}

/**
 * POST — what the agent decided.
 *   { action: 'approve', answer?: string, showOnPage?: boolean }
 *        answer = their edit (or the AI draft as is). Published on the share
 *        page unless showOnPage is false; emailed to the client once, if they
 *        left an email.
 *   { action: 'call' }       "Call instead" — off the waiting list.
 *   { action: 'later' }      "Not now" — off Home, still in the list.
 *   { action: 'unpublish' } / { action: 'publish' }  take it off / put it back
 *        on the share page.
 * Every step is written to the audit log.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const r = await load(id)
  if ('res' in r) return r.res
  const { admin, q, user } = r
  const body = await req.json().catch(() => ({})) as { action?: string; answer?: unknown; showOnPage?: unknown }
  const now = new Date().toISOString()
  const actor = { id: q.id, user_id: q.user_id }

  const save = async (patch: Record<string, unknown>) => {
    const { data, error } = await admin.from('client_questions').update({ ...patch, updated_at: now }).eq('id', q.id).eq('user_id', user.id).select(QUESTION_COLS).single()
    if (error) { console.error('[questions] update failed:', error.message); return null }
    return data as QuestionFull
  }

  switch (body.action) {
    case 'approve': {
      const { data: video } = await admin.from('videos').select('id, title, draft_data, script').eq('id', q.video_id).maybeSingle()
      const text = body.answer === undefined ? q.ai_draft : body.answer
      const check = checkApproval(text, { regulated: videoIsRegulated(video ?? null) })
      if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })
      const showOnPage = body.showOnPage !== false
      if (q.ai_draft && check.text !== q.ai_draft.trim()) {
        await logEvent(admin, actor, 'agent', 'edited', { from: q.ai_draft, to: check.text })
      }
      const saved = await save({ status: 'approved', final_answer: check.text, published: showOnPage, answered_at: now })
      if (!saved) return NextResponse.json({ error: 'Could not save your answer. Please try again.' }, { status: 500 })
      await logEvent(admin, actor, 'agent', 'approved', { answer: check.text, published: showOnPage, as_drafted: !!q.ai_draft && check.text === q.ai_draft.trim() })

      // Email the client — once — if they left an address.
      let emailed: boolean | null = null
      if (saved.asker_email && !saved.client_emailed_at) {
        const { data: profile } = await admin.from('profiles').select('full_name, company_name, email, subscription_status').eq('id', user.id).single()
        const agentName = profile?.full_name || profile?.company_name || 'Your agent'
        const whiteLabel = WHITELABEL_PLANS.includes(String(profile?.subscription_status ?? '').toLowerCase())
        const mail = clientAnswerEmail({
          agentName, title: video?.title || 'your video', question: saved.question, answer: check.text,
          watchUrl: `${appUrl()}/watch/${saved.video_id}`, whiteLabel,
        })
        const sent = await sendClientAnswer({ to: saved.asker_email, replyTo: profile?.email ?? null, fromName: agentName, whiteLabel, ...mail })
        emailed = sent.ok
        if (sent.ok) {
          await admin.from('client_questions').update({ client_emailed_at: new Date().toISOString() }).eq('id', q.id)
          await logEvent(admin, actor, 'system', 'client_emailed', { to: saved.asker_email })
        } else {
          await logEvent(admin, actor, 'system', 'client_email_failed', { to: saved.asker_email, error: String(sent.error ?? '').slice(0, 200) })
        }
      }
      return NextResponse.json({ question: { ...saved, client_emailed_at: emailed ? now : saved.client_emailed_at }, emailed })
    }
    case 'call':
    case 'later': {
      const saved = await save({ status: body.action === 'call' ? 'calling' : 'later' })
      if (!saved) return NextResponse.json({ error: 'Could not save that. Please try again.' }, { status: 500 })
      await logEvent(admin, actor, 'agent', body.action === 'call' ? 'calling' : 'later', {})
      return NextResponse.json({ question: saved })
    }
    case 'unpublish':
    case 'publish': {
      if (q.status !== 'approved') return NextResponse.json({ error: 'Only an approved answer can be shown on their page.' }, { status: 400 })
      const saved = await save({ published: body.action === 'publish' })
      if (!saved) return NextResponse.json({ error: 'Could not save that. Please try again.' }, { status: 500 })
      await logEvent(admin, actor, 'agent', body.action === 'publish' ? 'published' : 'unpublished', {})
      return NextResponse.json({ question: saved })
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
