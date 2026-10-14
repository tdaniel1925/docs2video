'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { BookOpen, Check, Clock, FileText, Pencil, Phone, Sparkles } from 'lucide-react'
import { Button, Card, Chip, EmptyState, Note, type ChipTone } from '../../../_components/kit'
import { QUESTION_STATUS_WORDS, UNSURE_ANSWER, type Citation } from '../../../_lib/client-questions'
import s from '../../../_components/answers-reviews/ar.module.css'

// =============================================================================
// THE REPLY SCREEN — one client question, the AI's draft, where it came from,
// and the agent's four choices: Approve / Edit / Call instead / Not now.
// Nothing reaches the client until Approve. Every step is in "What happened".
// =============================================================================

type Q = {
  id: string; video_id: string; question: string; asker_name: string | null; asker_email: string | null
  status: string; ai_draft: string | null; ai_unsure: boolean | null; ai_citations: Citation[] | null
  ai_note: string | null; final_answer: string | null; published: boolean; answered_at: string | null
  client_emailed_at: string | null; created_at: string
}
type Ev = { actor: string; action: string; created_at: string }
type Data = {
  available?: boolean; error?: string
  question: Q; video: { id: string; title: string } | null
  client: { id: string; name: string; phone: string | null; email: string | null } | null
  regulated: boolean; events: Ev[]
}

const TONE: Record<string, ChipTone> = { new: 'neutral', drafted: 'info', needs_reply: 'warn', approved: 'ok', calling: 'strong', later: 'neutral' }

const EVENT_WORDS: Record<string, string> = {
  asked: 'Client asked', agent_emailed: 'You were emailed', agent_email_failed: 'Email to you didn’t go out',
  ai_drafted: 'AI drafted an answer', ai_unsure: 'AI wasn’t sure — left it to you', ai_skipped: 'No AI draft (daily free limit)',
  edited: 'You edited the answer', approved: 'You approved it', published: 'Shown on their page', unpublished: 'Taken off their page',
  calling: 'You chose to call', later: 'You chose Not now', client_emailed: 'Answer emailed to the client', client_email_failed: 'Email to the client didn’t go out',
}

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export default function QuestionReplyPage() {
  const { id } = useParams() as { id: string }
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [showOnPage, setShowOnPage] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function load() {
    const r = await fetch(`/api/questions/${id}`)
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setError(j.error || 'We couldn’t load this question.'); return }
    setData(j)
    const q = j.question as Q
    setText(q.final_answer || (q.ai_draft && q.ai_draft !== UNSURE_ANSWER ? q.ai_draft : ''))
    setEditing(!q.ai_draft || q.ai_draft === UNSURE_ANSWER)
    // Still drafting? Look again shortly.
    if (q.status === 'new') setTimeout(() => { void load() }, 4000)
  }
  useEffect(() => { void load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action); setError(null); setDone(null)
    try {
      const r = await fetch(`/api/questions/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setError(j.error || 'That didn’t save. Please try again.'); return }
      if (action === 'approve') {
        setDone(j.emailed === true ? 'Approved. It’s on their page and we emailed it to them.' : j.emailed === false ? 'Approved and on their page — but the email to them didn’t go out. You can reply to them yourself.' : showOnPage ? 'Approved. It’s on their page now.' : 'Approved.')
        setEditing(false)
      }
      await load()
    } finally { setBusy(null) }
  }

  if (error && !data) {
    return <div className={s.page}><EmptyState title="We can’t show this question" actions={<Button href="/questions" variant="secondary">All questions</Button>}>{error}</EmptyState></div>
  }
  if (!data) return <div className={s.page}><span className="spinner" /></div>

  const q = data.question
  const unsure = !q.ai_draft || q.ai_draft === UNSURE_ANSWER || q.ai_unsure === true
  const answered = q.status === 'approved'
  const phone = data.client?.phone
  const who = q.asker_name || data.client?.name || q.asker_email || 'Someone'

  return (
    <div className={s.page} data-testid="question-reply">
      <Link href="/questions" className={s.back}>← All questions</Link>
      <div className={s.spread}>
        <div>
          <h1 className={s.title}>{who} asked</h1>
          <p className={s.lead}>
            About <Link href={`/videos/${q.video_id}`}>{data.video?.title ?? 'your video'}</Link> · {when(q.created_at)}
          </p>
        </div>
        <Chip tone={TONE[q.status] ?? 'neutral'}>{QUESTION_STATUS_WORDS[q.status] ?? q.status}</Chip>
      </div>

      <div className={s.stack}>
        <blockquote className={s.quote}>{q.question}</blockquote>

        {q.status === 'new' && <Note tone="info">Drafting an answer from their document… this takes a few seconds.</Note>}

        <Card>
          <p className={s.label}><Sparkles size={13} style={{ verticalAlign: '-2px' }} /> {answered ? 'Your answer' : unsure ? 'No draft — your answer' : 'Draft answer · not sent'}</p>
          {unsure && !answered && q.status !== 'new' && (
            <Note tone="warn">
              {q.ai_note || 'The AI wasn’t sure the document answers this.'} Write your own answer, or call them.
            </Note>
          )}
          {editing || (!answered && unsure) ? (
            <textarea
              className={s.box}
              aria-label="Your answer"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write your answer in plain words…"
              style={{ marginTop: 12 }}
            />
          ) : (
            <p className={s.draftText}>{answered ? q.final_answer : q.ai_draft}</p>
          )}

          {!answered && q.status !== 'new' && (
            <div style={{ marginTop: 14 }} className={s.stack}>
              <label className={s.check}>
                <input type="checkbox" checked={showOnPage} onChange={(e) => setShowOnPage(e.target.checked)} />
                Show it on their page, under the video
              </label>
              {q.asker_email
                ? <p className={s.small}>We’ll also email it to {q.asker_email}.</p>
                : <p className={s.small}>They didn’t leave an email, so it only shows on their page.</p>}
              <div className={s.actions}>
                <Button onClick={() => act('approve', { answer: editing || unsure ? text : undefined, showOnPage })} disabled={!!busy}>
                  <Check size={16} /> {busy === 'approve' ? 'Approving…' : editing || unsure ? 'Approve my answer' : 'Approve'}
                </Button>
                {!editing && !unsure && (
                  <Button variant="secondary" onClick={() => { setText(q.ai_draft || ''); setEditing(true) }} disabled={!!busy}><Pencil size={16} /> Edit</Button>
                )}
                {phone
                  ? <a className="kit-btn kit-btn--secondary" href={`tel:${phone}`} onClick={() => void act('call')}><Phone size={16} /> Call instead</a>
                  : <Button variant="secondary" onClick={() => act('call')} disabled={!!busy}><Phone size={16} /> Call instead</Button>}
                <Button variant="quiet" onClick={() => act('later')} disabled={!!busy}><Clock size={16} /> Not now</Button>
              </div>
              {data.regulated && <p className={s.muted}>Insurance rules: answers never name a company or product, never promise coverage, and never give advice beyond the document.</p>}
            </div>
          )}

          {answered && (
            <div className={s.actions} style={{ marginTop: 14 }}>
              <Chip tone={q.published ? 'ok' : 'neutral'}>{q.published ? 'On their page' : 'Not on their page'}</Chip>
              {q.client_emailed_at && <Chip tone="info">Emailed to them</Chip>}
              <Button variant="secondary" size="sm" onClick={() => act(q.published ? 'unpublish' : 'publish')} disabled={!!busy}>
                {q.published ? 'Take it off their page' : 'Show it on their page'}
              </Button>
              <Button variant="quiet" size="sm" href={`/watch/${q.video_id}`} external>Open their page</Button>
            </div>
          )}
        </Card>

        {error && <Note tone="stop">{error}</Note>}
        {done && <Note tone="ok">{done}</Note>}

        {(q.ai_citations?.length ?? 0) > 0 && (
          <Card>
            <p className={s.label}><BookOpen size={13} style={{ verticalAlign: '-2px' }} /> Where the draft came from</p>
            <ul className={s.cites}>
              {q.ai_citations!.map((c, i) => (
                <li key={i} className={s.cite}>
                  <p className={s.citeLabel}><FileText size={14} /> {c.label}</p>
                  <p className={s.citeQuote}>“{c.quote}”</p>
                </li>
              ))}
            </ul>
            <p className={s.muted} style={{ marginTop: 10 }}>Checked word for word against their document. The client sees only the section names, never these quotes.</p>
          </Card>
        )}

        <Card>
          <p className={s.label}>What happened</p>
          <ol className={s.log} aria-label="Everything that happened to this question">
            {data.events.map((e, i) => (
              <li key={i}><time dateTime={e.created_at}>{when(e.created_at)}</time><span>{EVENT_WORDS[e.action] ?? e.action}</span></li>
            ))}
          </ol>
          <p className={s.muted} style={{ marginTop: 10 }}>Every question and answer is kept, and this list can’t be changed.</p>
        </Card>
      </div>
    </div>
  )
}
