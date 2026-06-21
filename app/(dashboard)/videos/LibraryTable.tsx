'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import InlineConfirm from '../../_components/InlineConfirm'
import { useToast } from '../../_components/Toast'

export type LibraryItem = {
  id: string
  videoId: string | null   // real videos.id for deletion / open
  type: string
  title: string | null
  recipient: string | null
  fileUrl: string | null
  status: string | null
  progressPct: number | null
  creditsUsed: number | null
  createdAt: string
}

const TYPE_LABELS: Record<string, string> = {
  video: 'Video', deck: 'Deck', logo: 'Logo', 'business-card': 'Card',
  flyer: 'Flyer', infographic: 'Infographic', 'social-kit': 'Social', other: 'Other',
}

const PAGE_SIZES = [25, 50, 100]

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function LibraryTable({ items }: { items: LibraryItem[] }) {
  const router = useRouter()
  const notify = useToast()
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(1)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [removed, setRemoved] = useState<Set<string>>(new Set())

  const visible = useMemo(() => items.filter(i => !removed.has(i.id)), [items, removed])
  const total = visible.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const from = (safePage - 1) * pageSize
  const rows = visible.slice(from, from + pageSize)

  async function del(item: LibraryItem) {
    if (!item.videoId) { notify('Only videos can be deleted here.', 'info'); return }
    setDeleting(item.id)
    try {
      const res = await fetch(`/api/videos/${item.videoId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Delete failed')
      setRemoved(prev => new Set(prev).add(item.id))
      notify('Deleted.', 'success')
      router.refresh()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Delete failed', 'error')
    } finally {
      setDeleting(null)
    }
  }

  function openHref(item: LibraryItem): string {
    if (item.type === 'video') return `/videos/${item.videoId ?? item.id}`
    return item.fileUrl ?? '#'
  }

  if (total === 0) {
    return (
      <div style={{ background: 'white', border: '1px dashed var(--border)', borderRadius: 10, padding: '64px 32px', textAlign: 'center' }}>
        <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>No creations yet</p>
        <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 18 }}>Create content first — videos, decks, and more</p>
        <Link href="/create/start" className="btn btn-primary">Create content →</Link>
      </div>
    )
  }

  const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-light)', padding: '10px 16px', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '10px 16px', fontSize: 13, borderTop: '1px solid var(--border-light)', verticalAlign: 'middle' }

  return (
    <div>
      <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--bg-soft)' }}>
            <tr>
              <th style={th}>Title</th>
              <th style={th}>Type</th>
              <th style={th}>Recipient</th>
              <th style={th}>Status</th>
              <th style={{ ...th, textAlign: 'right' }}>Credits</th>
              <th style={{ ...th, textAlign: 'right' }}>Created</th>
              <th style={{ ...th, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(item => {
              const isVideo = item.type === 'video'
              const done = item.status === 'completed' || !isVideo
              return (
                <tr key={item.id} style={{ transition: 'background 0.1s' }}>
                  <td style={{ ...td, maxWidth: 320 }}>
                    <Link href={openHref(item)} {...(isVideo ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                      style={{ color: 'var(--ink)', textDecoration: 'none', fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title ?? 'Untitled'}
                    </Link>
                  </td>
                  <td style={td}><span className="tag peach" style={{ fontSize: 11 }}>{TYPE_LABELS[item.type] ?? item.type}</span></td>
                  <td style={{ ...td, color: 'var(--ink-soft)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.recipient || '—'}
                  </td>
                  <td style={td}>
                    {!isVideo ? <span style={{ color: 'var(--ink-light)' }}>—</span>
                      : done ? <span className="tag mint" style={{ fontSize: 11 }}>Ready</span>
                      : item.status === 'failed' ? <span className="tag rose" style={{ fontSize: 11 }}>Failed</span>
                      : <span className="tag peach" style={{ fontSize: 11 }}>{item.progressPct ? `${item.progressPct}%` : 'Processing'}</span>}
                  </td>
                  <td style={{ ...td, textAlign: 'right', color: 'var(--ink-soft)', fontVariantNumeric: 'tabular-nums' }}>
                    {item.creditsUsed != null ? item.creditsUsed : '—'}
                  </td>
                  <td style={{ ...td, textAlign: 'right', color: 'var(--ink-light)', whiteSpace: 'nowrap' }}>{fmtDate(item.createdAt)}</td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Link href={openHref(item)} {...(isVideo ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                      className="btn btn-soft btn-sm" style={{ marginRight: 6 }}>Open</Link>
                    {isVideo && (
                      <InlineConfirm message="Delete?" confirmLabel="Delete" onConfirm={() => del(item)}>
                        <button className="btn btn-danger btn-sm" disabled={deleting === item.id}>
                          {deleting === item.id ? '…' : 'Delete'}
                        </button>
                      </InlineConfirm>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footer: page size + pagination */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, padding: '12px 16px', background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ink-soft)' }}>
          <span>Showing {total === 0 ? 0 : from + 1}–{Math.min(from + pageSize, total)} of {total}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Per page:
            {PAGE_SIZES.map(s => (
              <button key={s} onClick={() => { setPageSize(s); setPage(1) }}
                className={`btn btn-sm ${pageSize === s ? 'btn-primary' : 'btn-soft'}`}>{s}</button>
            ))}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-soft btn-sm" disabled={safePage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>← Previous</button>
          <span style={{ fontSize: 13, color: 'var(--ink-soft)', alignSelf: 'center' }}>Page {safePage} / {totalPages}</span>
          <button className="btn btn-soft btn-sm" disabled={safePage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next →</button>
        </div>
      </div>
    </div>
  )
}
