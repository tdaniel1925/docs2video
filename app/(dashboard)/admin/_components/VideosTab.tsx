'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, Chip, Tabs } from '../../../_components/kit'
import { RetryButton, ReviewButtons } from './VideoActions'

interface AdminVideoRow {
  id: string
  user_id: string
  title: string | null
  status: string
  created_at: string
  updated_at: string
  owner_email: string | null
  views: number
  plays: number
  reason: string | null
  technical: string | null
}

type Filter = '' | 'completed' | 'failed' | 'running' | 'review_required'
const FILTERS: { key: Filter; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'review_required', label: 'Waiting for your OK' },
  { key: 'failed', label: 'Didn’t finish' },
  { key: 'running', label: 'Being made' },
  { key: 'completed', label: 'Finished' },
]

const STATUS: Record<string, { tone: 'ok' | 'stop' | 'warn' | 'info' | 'neutral'; label: string }> = {
  completed: { tone: 'ok', label: 'Finished' },
  failed: { tone: 'stop', label: 'Didn’t finish' },
  review_required: { tone: 'warn', label: 'Waiting for your OK' },
}

/**
 * Videos tab: filtered and paged on the server. Filters live in the address
 * (?filter=failed&since=24h) so the "What needs you" links land right here.
 */
export default function VideosTab() {
  const router = useRouter()
  const params = useSearchParams()
  const filter = (params.get('filter') || '') as Filter
  const since = params.get('since') === '24h' ? '24h' : ''
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<{ videos: AdminVideoRow[]; total: number; size: number } | null>(null)

  const setParams = (next: { filter?: Filter; since?: string }) => {
    const f = next.filter ?? filter
    const s = next.since ?? since
    const sp = new URLSearchParams({ tab: 'videos' })
    if (f) sp.set('filter', f)
    if (s) sp.set('since', s)
    setPage(0)
    router.replace(`/admin?${sp.toString()}`)
  }

  const load = useCallback(() => {
    setData(null)
    fetch(`/api/admin/videos?page=${page}&status=${filter}&since=${since}&q=${encodeURIComponent(query)}`)
      .then((r) => r.json()).then(setData).catch(() => setData({ videos: [], total: 0, size: 25 }))
  }, [page, filter, since, query])
  useEffect(() => { load() }, [load])
  useEffect(() => { const t = setTimeout(() => { setPage(0); setQuery(q.trim()) }, 300); return () => clearTimeout(t) }, [q])

  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1
  return (
    <div>
      <Tabs label="Show" tabs={FILTERS} current={filter} onSelect={(k) => setParams({ filter: k })} />
      <div className="admin-toolbar" style={{ marginTop: 12 }}>
        <div className="admin-choice-row" role="radiogroup" aria-label="When" style={{ margin: 0 }}>
          <button type="button" role="radio" aria-checked={!since} className={`admin-choice ${!since ? 'is-on' : ''}`} onClick={() => setParams({ since: '' })}>Any time</button>
          <button type="button" role="radio" aria-checked={since === '24h'} className={`admin-choice ${since === '24h' ? 'is-on' : ''}`} onClick={() => setParams({ since: '24h' })}>Last 24 hours</button>
        </div>
        <input className="input" placeholder="Search by title…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search videos" />
        {data && <span className="admin-muted">{data.total.toLocaleString('en-US')} videos</span>}
      </div>
      <div className="admin-list">
        {!data && <div className="admin-row admin-muted">Loading…</div>}
        {data?.videos.length === 0 && <div className="admin-row admin-muted">No videos here.</div>}
        {data?.videos.map((v) => {
          const st = STATUS[v.status] ?? { tone: 'info' as const, label: v.status.replace(/_/g, ' ') }
          return (
            <div key={v.id} className="admin-row">
              <div className="admin-row-main">
                <span className="admin-row-title">{v.title || 'Untitled'}</span>
                <span className="admin-row-sub">
                  <Link href={`/admin/users/${v.user_id}`} className="admin-link">{v.owner_email ?? 'unknown'}</Link>
                  {' · '}{new Date(v.updated_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  {v.status === 'completed' ? ` · ${v.views} views · ${v.plays} plays` : ''}
                </span>
                {v.reason && <span className="admin-row-reason">{v.reason}</span>}
                {v.technical && <details className="admin-tech"><summary>Technical details</summary><pre>{v.technical}</pre></details>}
              </div>
              <div className="admin-row-meta"><Chip tone={st.tone}>{st.label}</Chip></div>
              <div className="admin-actions">
                {v.status === 'completed' && <Button size="sm" variant="secondary" href={`/watch/${v.id}`} external>Watch</Button>}
                {v.status === 'failed' && <RetryButton videoId={v.id} title={v.title || 'Untitled'} onDone={load} />}
                {v.status === 'review_required' && <ReviewButtons videoId={v.id} title={v.title || 'Untitled'} onDone={load} />}
              </div>
            </div>
          )
        })}
      </div>
      {data && data.total > data.size && (
        <div className="admin-pager">
          <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Back</Button>
          <span>Page {page + 1} of {pages}</span>
          <Button size="sm" variant="secondary" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next →</Button>
        </div>
      )}
    </div>
  )
}
