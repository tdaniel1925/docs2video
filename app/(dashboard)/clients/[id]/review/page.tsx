'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { CalendarCheck, CalendarHeart, FileText, Upload, X } from 'lucide-react'
import { Button, Card, Chip, EmptyState, Note } from '../../../../_components/kit'
import { uploadAndExtract } from '../../../create/_components/uploadAndExtract'
import Stages, { type Stage } from '../../../create/_components/workspace/Stages'
import { addDays, dateWords, dueWords, REVIEW_STATUS_WORDS, todayIn } from '../../../../_lib/annual-review'
import { resumeUrl } from '../../../dashboard/_home/derive'
import s from '../../../../_components/answers-reviews/ar.module.css'

// =============================================================================
// PREPARE REVIEW — one client's annual review, start to finish.
//
//   1. Prepare: upload this year's statement and/or reuse last year's
//      document. This makes an ordinary draft in the normal create flow
//      ("Your year in review"; two documents → the existing compare step lines
//      up last year's numbers against this year's), then opens the story step.
//      Nothing is charged here.
//   2. The agent checks the story and presses Make it — the normal price.
//   3. Back here: pick the day it goes out. The daily reviews job emails it
//      that morning through the normal Send.
// =============================================================================

const PURPOSE = 'Your year in review — where their plan stands this year, and a friendly invitation to talk it through'
const COMPARE = 'Your year in review: compare LAST year’s document with THIS year’s. Show what changed (values, premiums, coverage) side by side, using only the numbers in the two documents. Keep it warm and simple and end with an invitation to book a review call.'

type Doc = { videoId: string; title: string; madeAt: string; status: string }
type Info = {
  available: boolean
  client: { id: string; name: string; email: string | null; phone: string | null; anniversary_date: string | null; anniversary_confirmed: boolean | null; anniversary_tz: string | null }
  due: { cycleDate: string; daysLeft: number; due: boolean } | null
  current: { id: string; status: string; video_id: string | null; send_on: string | null; send_to: string | null; sent_at: string | null; last_error: string | null } | null
  currentVideo: { id: string; title: string | null; status: string } | null
  documents: Doc[]
}

export default function PrepareReviewPage() {
  const { id: clientId } = useParams() as { id: string }
  const router = useRouter()
  const [info, setInfo] = useState<Info | null>(null)
  const [off, setOff] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [useLast, setUseLast] = useState(true)
  const [lastId, setLastId] = useState<string>('')
  const [stages, setStages] = useState<Stage[] | null>(null)
  const [stageIdx, setStageIdx] = useState(0)
  const [sendOn, setSendOn] = useState('')
  const [sendTo, setSendTo] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const tz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'America/New_York'

  const load = useCallback(() => {
    fetch(`/api/reviews?clientId=${encodeURIComponent(clientId)}`).then((r) => r.json().then((j) => ({ ok: r.ok, j }))).then(({ ok, j }) => {
      if (!ok) { setError(j.error || 'We couldn’t load this client.'); return }
      if (!j.available) { setOff(true); return }
      setInfo(j)
      setLastId((prev) => prev || j.documents?.[0]?.videoId || '')
      setSendTo((prev) => prev || j.current?.send_to || j.client?.email || '')
      const today = todayIn(tz)
      const anniv = j.due?.cycleDate as string | undefined
      setSendOn((prev) => prev || j.current?.send_on || (anniv && anniv > today ? anniv : addDays(today, 1)))
    }).catch(() => setError('We couldn’t load this client.'))
  }, [clientId, tz])
  useEffect(load, [load])

  async function prepare() {
    if (!info?.due) return
    const last = useLast && lastId ? info.documents.find((d) => d.videoId === lastId) : null
    if (!file && !last) { setError('Add this year’s statement, or use last year’s document.'); return }
    setError(null)
    const list: Stage[] = [
      ...(file ? [{ key: 'read', label: `Reading ${file.name}` }] : []),
      ...(last ? [{ key: 'last', label: 'Getting last year’s document' }] : []),
      { key: 'save', label: 'Saving the review draft' },
      ...(file && last ? [{ key: 'compare', label: 'Comparing last year with this year' }] : []),
      { key: 'brief', label: 'Finding the one point and the numbers' },
    ]
    setStages(list)
    const go = (k: string) => setStageIdx(Math.max(0, list.findIndex((x) => x.key === k)))
    try {
      let thisYear: Record<string, unknown> | null = null
      if (file) { go('read'); thisYear = await uploadAndExtract(file, PURPOSE) }
      let lastYear: Record<string, unknown> | null = null
      if (last) {
        go('last')
        const r = await fetch(`/api/videos/draft?videoId=${encodeURIComponent(last.videoId)}`)
        const v = await r.json().catch(() => null)
        lastYear = (v?.draft_data?.extractedData as Record<string, unknown>) ?? null
        if (!lastYear) throw new Error('Last year’s document couldn’t be found. Upload it instead.')
      }
      go('save')
      const both = !!(thisYear && lastYear)
      const primary = (thisYear ?? lastYear)!
      const sourcePdf = thisYear?._sourcePdfPath ? { sourcePdfPath: thisYear._sourcePdfPath, sourcePdfName: thisYear._sourcePdfName } : {}
      const draftRes = await fetch('/api/videos/draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outputType: 'video', purpose: PURPOSE, recipientName: info.client.name, clientId, extractedData: primary, contentMethod: 'upload', ...sourcePdf,
          ...(both ? { extractedDocs: [{ fileName: `Last year — ${last!.title}`, data: lastYear }, { fileName: `This year — ${file!.name}`, data: thisYear }], combineInstruction: COMPARE } : {}),
        }),
      })
      const d = await draftRes.json().catch(() => ({}))
      if (!draftRes.ok || !d.videoId) throw new Error(d.error || 'We couldn’t save the review draft.')
      const link = await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId, cycleDate: info.due.cycleDate, videoId: d.videoId, priorVideoId: last?.videoId ?? null }) })
      if (!link.ok) throw new Error('The draft was saved, but we couldn’t link it to this review. Find it on Home under Recent.')
      if (both) { go('compare'); await fetch('/api/combine-docs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId: d.videoId }) }).catch(() => null) }
      go('brief')
      await fetch('/api/brief', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId: d.videoId }) }).catch(() => null)
      router.push(`/create/script?id=${d.videoId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setStages(null)
    }
  }

  async function patch(action: string, extra: Record<string, unknown> = {}) {
    if (!info?.current) return
    setBusy(true); setError(null)
    try {
      const r = await fetch(`/api/reviews/${info.current.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, tz, ...extra }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) setError(j.error || 'That didn’t save.')
      else load()
    } finally { setBusy(false) }
  }

  if (error && !info) return <div className={s.page}><EmptyState title="We can’t open this review" actions={<Button href="/clients" variant="secondary">Back to Clients</Button>}>{error}</EmptyState></div>
  if (off) return <div className={s.page}><Note tone="info">Annual reviews aren’t switched on yet.</Note></div>
  if (!info) return <div className={s.page}><span className="spinner" /></div>

  const c = info.client
  const cur = info.current
  const vid = info.currentVideo
  const head = (
    <>
      <Link href={`/clients/${clientId}`} className={s.back}>← {c.name}</Link>
      <h1 className={s.title}>{c.name}’s annual review</h1>
      <p className={s.lead}>
        {info.due ? <>Policy anniversary <strong>{dateWords(info.due.cycleDate, { year: true })}</strong> · {dueWords(info.due.daysLeft)}</> : 'Add a policy date to start.'}
      </p>
    </>
  )

  if (!info.due || !c.anniversary_confirmed) {
    return <div className={s.page}>{head}<Note tone="info" action={<Button size="sm" href={`/clients/${clientId}`}>Add the policy date</Button>}>Add and confirm {c.name}’s policy date first.</Note></div>
  }

  // ── Not prepared yet ──
  if (!cur?.video_id || !vid) {
    const hasDocs = info.documents.length > 0
    return (
      <div className={s.page} data-testid="prepare-review">
        {head}
        <div className={s.stack}>
          <Card>
            <p className={s.label}>1 · This year’s statement</p>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.csv,.xlsx" style={{ display: 'none' }} aria-label="Choose this year’s statement"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = '' }} />
            {file ? (
              <div className={s.item}>
                <span className={s.itemIcon}><FileText size={20} /></span>
                <span className={s.itemBody}><p className={s.itemTitle}>{file.name}</p><p className={s.itemSub}>This year’s numbers</p></span>
                <button type="button" className="kit-icon-btn" aria-label="Remove file" onClick={() => setFile(null)}><X size={18} /></button>
              </div>
            ) : (
              <button type="button" className={s.drop} onClick={() => fileRef.current?.click()} disabled={!!stages}>
                <Upload size={20} aria-hidden="true" />
                <strong>Upload this year’s statement</strong>
                <span>PDF or Word · optional if you reuse last year’s</span>
              </button>
            )}
          </Card>

          <Card>
            <p className={s.label}>2 · Last year’s document</p>
            {hasDocs ? (
              <div className={s.stack} style={{ gap: 8 }}>
                <label className={s.check}>
                  <input type="checkbox" checked={useLast} onChange={(e) => setUseLast(e.target.checked)} disabled={!!stages} />
                  {file ? 'Compare with last year’s document' : 'Reuse last year’s document'}
                </label>
                {useLast && info.documents.map((d) => (
                  <label key={d.videoId} className={s.choice}>
                    <input type="radio" name="last" checked={lastId === d.videoId} onChange={() => setLastId(d.videoId)} disabled={!!stages} />
                    <span><p className={s.choiceTitle}>{d.title}</p><p className={s.choiceText}>Made {new Date(d.madeAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p></span>
                  </label>
                ))}
              </div>
            ) : (
              <p className={s.small}>No earlier video for {c.name} has its document saved. Upload this year’s statement above.</p>
            )}
          </Card>

          <Note tone="info">
            {file && useLast && hasDocs
              ? 'We’ll put last year’s numbers next to this year’s, in a short “Your year in review” video.'
              : 'We’ll start a short “Your year in review” video from this document.'}
            {' '}You check the story next. Nothing is charged until you press <strong>Make it</strong> (the normal price{file && useLast && hasDocs ? ', with the second document' : ''}).
          </Note>

          {stages && <Card><Stages stages={stages} current={stageIdx} label="Preparing the review" /></Card>}
          {error && <Note tone="stop">{error}</Note>}

          <div className={s.actions}>
            <Button onClick={() => void prepare()} disabled={!!stages || (!file && !(useLast && lastId))}>{stages ? 'Preparing…' : 'Prepare the review →'}</Button>
            {cur && cur.status !== 'skipped' && <Button variant="quiet" onClick={() => patch('skip')} disabled={busy}>Skip this year</Button>}
          </div>
        </div>
      </div>
    )
  }

  // ── Prepared: the video, then the send day ──
  const made = vid.status === 'completed'
  return (
    <div className={s.page} data-testid="review-hub">
      {head}
      <div className={s.stack}>
        <Card>
          <div className={s.spread}>
            <div>
              <p className={s.label}>The review video</p>
              <p className={s.itemTitle} style={{ whiteSpace: 'normal' }}>{vid.title || 'Your year in review'}</p>
            </div>
            <Chip tone={cur.status === 'sent' ? 'ok' : cur.status === 'send_failed' ? 'stop' : made ? 'info' : 'neutral'}>
              {made ? REVIEW_STATUS_WORDS[cur.status] ?? cur.status : vid.status === 'draft' ? 'Draft — not made yet' : vid.status === 'failed' ? 'Didn’t finish' : 'Being made…'}
            </Chip>
          </div>
          <div className={s.actions} style={{ marginTop: 12 }}>
            {vid.status === 'draft'
              ? <Button href={resumeUrl(vid.id, 4)}>Check the story and make it</Button>
              : <Button variant="secondary" href={`/videos/${vid.id}`}>Open the video</Button>}
          </div>
        </Card>

        {made && cur.status !== 'sent' && (
          <Card>
            <p className={s.label}><CalendarCheck size={13} style={{ verticalAlign: '-2px' }} /> When should it go out?</p>
            {cur.status === 'scheduled' ? (
              <>
                <p className={s.small}>Emails to <strong>{cur.send_to}</strong> on the morning of <strong>{dateWords(cur.send_on!, { year: true })}</strong>, through your normal Send.</p>
                {cur.last_error && <Note tone="warn">Last try didn’t go out: {cur.last_error}. We’ll try again tomorrow.</Note>}
                <div className={s.actions} style={{ marginTop: 12 }}>
                  <Button variant="secondary" onClick={() => patch('unschedule')} disabled={busy}>Change or cancel</Button>
                </div>
              </>
            ) : (
              <>
                {cur.status === 'send_failed' && <Note tone="stop">It didn’t send{cur.last_error ? `: ${cur.last_error}` : ''}. Check the email address and pick a day again.</Note>}
                <div className={s.grid2} style={{ marginTop: 8 }}>
                  <label className={s.field}><span>Send day</span>
                    <input className={s.input} type="date" value={sendOn} min={todayIn(tz)} onChange={(e) => setSendOn(e.target.value)} />
                  </label>
                  <label className={s.field}><span>Their email</span>
                    <input className={s.input} type="email" value={sendTo} onChange={(e) => setSendTo(e.target.value)} placeholder="client@example.com" />
                  </label>
                </div>
                <p className={s.muted} style={{ marginTop: 8 }}>It goes out that morning with a short note, the same email as Send. You can change or cancel it until then.</p>
                <div className={s.actions} style={{ marginTop: 12 }}>
                  <Button onClick={() => patch('schedule', { sendOn, sendTo })} disabled={busy || !sendOn || !sendTo}><CalendarHeart size={16} /> Schedule it</Button>
                  <Button variant="quiet" onClick={() => patch('skip')} disabled={busy}>Skip this year</Button>
                </div>
              </>
            )}
          </Card>
        )}

        {cur.status === 'sent' && (
          <Note tone="ok">Sent{cur.sent_at ? ` on ${new Date(cur.sent_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}` : ''} to {cur.send_to}. You’ll see when they watch it on the video’s page.</Note>
        )}
        {cur.status === 'skipped' && <Note tone="info" action={<Button size="sm" variant="secondary" onClick={() => patch('reopen')}>Undo</Button>}>You skipped this year’s review.</Note>}
        {error && <Note tone="stop">{error}</Note>}
      </div>
    </div>
  )
}
