'use client'

import { useEffect, useState } from 'react'
import { MessageCircleQuestion } from 'lucide-react'
import { Chip, EmptyState, Note, type ChipTone } from '../kit'
import { QUESTION_STATUS_WORDS } from '../../_lib/client-questions'
import s from './ar.module.css'

// The list of client questions — on /questions (all of them) and on a video's
// result page (that video's, when there are any). Each row opens the reply
// screen. Hidden quietly before the feature is switched on.

type Row = { id: string; video_id: string; video_title?: string; question: string; asker_name: string | null; asker_email: string | null; status: string; created_at: string }

const TONE: Record<string, ChipTone> = { new: 'neutral', drafted: 'info', needs_reply: 'warn', approved: 'ok', calling: 'strong', later: 'neutral' }
const ago = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`
}

export default function QuestionList({ videoId, compact = false }: { videoId?: string; compact?: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [off, setOff] = useState(false)

  useEffect(() => {
    let live = true
    fetch(`/api/questions${videoId ? `?videoId=${encodeURIComponent(videoId)}` : ''}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!live) return
        if (!j || j.available === false) { setOff(true); setRows([]); return }
        setRows(j.questions ?? [])
      })
      .catch(() => { if (live) setRows([]) })
    return () => { live = false }
  }, [videoId])

  if (rows === null) return compact ? null : <span className="spinner" />
  if (off) return compact ? null : <Note tone="info">Client questions aren’t switched on yet. Questions are still emailed to you.</Note>
  if (!rows.length) {
    return compact ? null : (
      <EmptyState title="No questions yet.">When a client asks a question under one of your videos, it shows up here with an answer drafted from their document — ready for you to check.</EmptyState>
    )
  }
  const waiting = rows.filter((r) => ['new', 'drafted', 'needs_reply'].includes(r.status)).length
  return (
    <section aria-labelledby={compact ? 'vq-title' : undefined} data-testid="question-list">
      {compact && (
        <div className={s.spread} style={{ marginBottom: 10 }}>
          <h2 id="vq-title" className="kit-label" style={{ margin: 0 }}>Client questions</h2>
          {waiting > 0 && <Chip tone="warn">{waiting} waiting on you</Chip>}
        </div>
      )}
      <ul className={s.list}>
        {rows.map((r) => (
          <li key={r.id}>
            <a href={`/questions/${r.id}`} className={s.item}>
              <span className={s.itemIcon}><MessageCircleQuestion size={20} /></span>
              <span className={s.itemBody}>
                <p className={s.itemTitle}>{r.question}</p>
                <p className={s.itemSub}>
                  {r.asker_name || r.asker_email || 'A viewer'} · {ago(r.created_at)}{!videoId && r.video_title ? ` · ${r.video_title}` : ''}
                </p>
              </span>
              <Chip tone={TONE[r.status] ?? 'neutral'}>{QUESTION_STATUS_WORDS[r.status] ?? r.status}</Chip>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
