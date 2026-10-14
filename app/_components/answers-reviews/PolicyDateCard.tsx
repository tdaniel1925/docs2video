'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarHeart } from 'lucide-react'
import { Button, Chip, Note } from '../kit'
import { dateWords, dueWords, REVIEW_STATUS_WORDS } from '../../_lib/annual-review'
import s from './ar.module.css'

// The policy date on a client's page: set it, confirm one we read from their
// document, and jump to this year's review. Hidden until annual reviews are on.

type Info = {
  available: boolean
  client: { id: string; anniversary_date: string | null; anniversary_confirmed: boolean | null; anniversary_source: string | null }
  due: { cycleDate: string; daysLeft: number; due: boolean } | null
  current: { status: string; video_id: string | null } | null
  suggestedDate: string | null
}

export default function PolicyDateCard({ clientId }: { clientId: string }) {
  const [info, setInfo] = useState<Info | null>(null)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'stop'; text: string } | null>(null)

  const load = useCallback(() => {
    fetch(`/api/reviews?clientId=${encodeURIComponent(clientId)}`).then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (j?.available) { setInfo(j); setValue(j.client.anniversary_date ?? j.suggestedDate ?? '') }
      else setInfo(null)
    }).catch(() => {})
  }, [clientId])
  useEffect(load, [load])

  async function save(date: string | null, source: 'agent' | 'document' = 'agent') {
    setBusy(true); setMsg(null)
    try {
      const r = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anniversary_date: date, anniversary_source: source, anniversary_confirmed: date ? true : false, anniversary_tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j.warning) setMsg({ tone: 'stop', text: j.error || j.warning || 'That didn’t save.' })
      else { setMsg({ tone: 'ok', text: date ? 'Policy date saved.' : 'Policy date removed.' }); setEditing(false); load() }
    } finally { setBusy(false) }
  }

  if (!info) return null
  const c = info.client
  return (
    <div className="settings-card" style={{ marginBottom: 20 }} data-testid="policy-date-card">
      <div className={s.spread}>
        <div>
          <h3 className={s.boxTitle}><CalendarHeart size={18} aria-hidden="true" /> Policy date &amp; annual review</h3>
          <p className={s.small} style={{ marginTop: 6 }}>
            {c.anniversary_date
              ? <>Policy date: <strong>{dateWords(c.anniversary_date, { year: true })}</strong>{c.anniversary_source === 'document' ? ' (read from their document)' : ''}</>
              : 'No policy date yet. Add one and we’ll remind you a month before each anniversary.'}
          </p>
          {info.due && c.anniversary_confirmed && (
            <div className={s.due}>
              <Chip tone={info.due.due ? (info.due.daysLeft <= 7 ? 'warn' : 'info') : 'neutral'}>
                {info.due.due ? dueWords(info.due.daysLeft) : `Next anniversary ${dateWords(info.due.cycleDate)}`}
              </Chip>
              {info.current && <Chip tone="neutral">{REVIEW_STATUS_WORDS[info.current.status] ?? info.current.status}</Chip>}
            </div>
          )}
        </div>
        <div className={s.actions}>
          {c.anniversary_confirmed && info.due && <Button size="sm" href={`/clients/${clientId}/review`}>{info.current?.video_id ? 'Open review' : 'Prepare review'}</Button>}
          {!editing && <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>{c.anniversary_date ? 'Change date' : 'Add policy date'}</Button>}
        </div>
      </div>

      {c.anniversary_date && !c.anniversary_confirmed && !editing && (
        <Note tone="warn" action={<Button size="sm" onClick={() => save(c.anniversary_date, 'document')} disabled={busy}>Yes, that’s right</Button>}>
          We read <strong>{dateWords(c.anniversary_date, { year: true })}</strong> from their document. Is that the policy date? Reviews start once you confirm.
        </Note>
      )}
      {!c.anniversary_date && info.suggestedDate && !editing && (
        <Note tone="info" action={<Button size="sm" variant="secondary" onClick={() => save(info.suggestedDate, 'document')} disabled={busy}>Use this date</Button>}>
          Their document says the policy was issued on <strong>{dateWords(info.suggestedDate, { year: true })}</strong>.
        </Note>
      )}
      {editing && (
        <div className={s.row} style={{ marginTop: 12 }}>
          <label className={s.field}><span>Policy date</span>
            <input className={s.input} type="date" value={value} onChange={(e) => setValue(e.target.value)} />
          </label>
          <div className={s.actions} style={{ alignSelf: 'flex-end' }}>
            <Button size="sm" onClick={() => save(value || null)} disabled={busy || !value}>Save</Button>
            {c.anniversary_date && <Button size="sm" variant="quiet" onClick={() => save(null)} disabled={busy}>Remove</Button>}
            <Button size="sm" variant="quiet" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      )}
      {msg && <div style={{ marginTop: 10 }}><Note tone={msg.tone}>{msg.text}</Note></div>}
    </div>
  )
}
