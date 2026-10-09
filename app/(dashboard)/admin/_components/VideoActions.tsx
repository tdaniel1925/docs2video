'use client'

import { useState } from 'react'
import { RotateCcw, Check, X } from 'lucide-react'
import { Button } from '../../../_components/kit'
import { useToast } from '../../../_components/Toast'
import { useConfirm } from './useConfirm'

/*
 * Retry / Approve / Reject for one video. Retry and Approve first ask the
 * server what it will charge (same price functions generate-video charges
 * with) and SAY it in the confirm box — "This will charge … 1,000 credits" —
 * before anything runs.
 */

async function quoteWords(videoId: string): Promise<string> {
  try {
    const r = await fetch(`/api/admin/retry-video?videoId=${encodeURIComponent(videoId)}`)
    const d = await r.json()
    if (!r.ok) return 'The price could not be worked out just now — it is charged like a normal video.'
    return d.words as string
  } catch {
    return 'The price could not be worked out just now — it is charged like a normal video.'
  }
}

export function RetryButton({ videoId, title, onDone }: { videoId: string; title: string; onDone: () => void }) {
  const notify = useToast()
  const [ask, dialog] = useConfirm()
  const [busy, setBusy] = useState(false)

  async function retry() {
    setBusy(true)
    const words = await quoteWords(videoId)
    setBusy(false)
    const r = await ask({ title: `Try “${title}” again?`, body: <p><b>{words}</b> It runs again with the same document, story and look.</p>, confirmLabel: 'Try again' })
    if (!r.ok) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/retry-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Could not start it')
      notify('Started again.', 'success')
      onDone()
    } catch (e) { notify(e instanceof Error ? e.message : 'Could not start it', 'error') }
    setBusy(false)
  }

  return (
    <>
      <Button size="sm" variant="secondary" disabled={busy} onClick={retry}><RotateCcw size={14} aria-hidden="true" /> {busy ? '…' : 'Retry'}</Button>
      {dialog}
    </>
  )
}

export function ReviewButtons({ videoId, title, onDone }: { videoId: string; title: string; onDone: () => void }) {
  const notify = useToast()
  const [ask, dialog] = useConfirm()
  const [busy, setBusy] = useState(false)

  async function act(action: 'approve' | 'reject') {
    let ok = false
    if (action === 'approve') {
      setBusy(true)
      const words = await quoteWords(videoId)
      setBusy(false)
      ok = (await ask({
        title: `Approve “${title}”?`,
        body: <p>Only approve if you checked the numbers against the customer’s document. <b>{words}</b> The video is made straight away.</p>,
        confirmLabel: 'Approve and make it',
      })).ok
    } else {
      ok = (await ask({
        title: `Reject “${title}”?`,
        body: <p>The video is not made. The customer sees “Not approved after review” and is not charged.</p>,
        danger: true,
        confirmLabel: 'Reject',
      })).ok
    }
    if (!ok) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/review-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId, action }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'That didn’t work')
      notify(action === 'approve' ? 'Approved — it is being made now.' : 'Rejected.', 'success')
      onDone()
    } catch (e) { notify(e instanceof Error ? e.message : 'That didn’t work', 'error') }
    setBusy(false)
  }

  return (
    <>
      <Button size="sm" disabled={busy} onClick={() => act('approve')}><Check size={14} aria-hidden="true" /> Approve</Button>
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => act('reject')}><X size={14} aria-hidden="true" /> Reject</Button>
      {dialog}
    </>
  )
}
