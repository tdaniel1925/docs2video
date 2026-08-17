'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type Design = { id: string; sizeId: string; label: string; w: number; h: number; url: string; createdAt: string }
type Project = { id: string; title: string; pinned: boolean; updatedAt: string; totalDesigns: number; designs: Design[] }

const PAGE_SIZE = 8

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return '' }
}

export default function LibraryBrowser() {
  const [projects, setProjects] = useState<Project[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const load = useCallback(async (p: number, append: boolean) => {
    setLoading(true); setError(null)
    try {
      const r = await fetch(`/api/flyer-library?page=${p}&pageSize=${PAGE_SIZE}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || 'Could not load your library')
      const incoming: Project[] = j.projects || []
      setProjects((prev) => append ? [...prev, ...incoming] : incoming)
      setHasMore(!!j.hasMore)
      setPage(p)
      // open the first project on the first load so the page isn't a wall of closed rows
      if (!append && incoming[0]) setOpen({ [incoming[0].id]: true })
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(0, false) }, [load])

  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }))

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 4px' }}>
      <div className="page-head">
        <h1 className="page-title">My Library</h1>
        <Link href="/flyer" className="btn btn-mint btn-sm">Make something new</Link>
      </div>
      <p style={{ color: 'var(--ink-light)', marginTop: -6, marginBottom: 20, fontSize: 14 }}>
        Every design you&apos;ve made, kept by project. Click a project to see its files.
      </p>

      {error && (
        <div className="card" style={{ borderColor: '#e6b0b0', color: '#8a3b3b' }}>
          {error} <button className="btn btn-sm btn-outlined" style={{ marginLeft: 10 }} onClick={() => load(0, false)}>Try again</button>
        </div>
      )}

      {!error && !loading && projects.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-light)' }}>
          <p style={{ fontSize: 16, marginBottom: 12 }}>Nothing here yet.</p>
          <Link href="/flyer" className="btn btn-mint">Make your first design</Link>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {projects.map((proj) => {
          const isOpen = !!open[proj.id]
          return (
            <div key={proj.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* accordion header */}
              <button
                onClick={() => toggle(proj.id)}
                aria-expanded={isOpen}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '16px 18px', background: 'transparent', border: 'none', cursor: 'pointer',
                  textAlign: 'left', font: 'inherit',
                }}
              >
                <span style={{ fontSize: 14, color: 'var(--ink-light)', transition: 'transform .15s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
                <span style={{ fontWeight: 600, color: 'var(--ink)', flex: 1 }}>
                  {proj.pinned && <span title="Pinned" style={{ marginRight: 6 }}>📌</span>}
                  {proj.title}
                </span>
                <span className="badge-mint" style={{ fontSize: 12 }}>{proj.totalDesigns} {proj.totalDesigns === 1 ? 'file' : 'files'}</span>
                <span style={{ fontSize: 12, color: 'var(--ink-light)', minWidth: 88, textAlign: 'right' }}>{fmtDate(proj.updatedAt)}</span>
              </button>

              {/* accordion body — design grid */}
              {isOpen && (
                <div style={{ padding: '4px 18px 18px' }}>
                  {proj.designs.length === 0 ? (
                    <p style={{ color: 'var(--ink-light)', fontSize: 13, margin: '8px 0' }}>No files in this project yet.</p>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                        {proj.designs.map((d) => (
                          <a key={d.id} href={d.url} target="_blank" rel="noreferrer"
                             title={`${d.label} — open full size`}
                             style={{ display: 'block', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, overflow: 'hidden', background: '#faf8f4', textDecoration: 'none' }}>
                            <div style={{ aspectRatio: `${d.w} / ${d.h}`, background: '#efece6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={d.url} alt={d.label} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            </div>
                            <div style={{ padding: '6px 8px', fontSize: 12, color: 'var(--ink)' }}>{d.label}</div>
                          </a>
                        ))}
                      </div>
                      {proj.totalDesigns > proj.designs.length && (
                        <p style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 10 }}>
                          Showing {proj.designs.length} of {proj.totalDesigns}.{' '}
                          <Link href={`/flyer?chat=${proj.id}`} style={{ color: 'var(--mint-deep, #4a7c2f)', fontWeight: 600 }}>Open the project</Link> to see them all.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {loading && <p style={{ textAlign: 'center', color: 'var(--ink-light)', padding: 20 }}>Loading…</p>}

      {!loading && hasMore && (
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button className="btn btn-outlined" onClick={() => load(page + 1, true)}>Load more projects</button>
        </div>
      )}
    </div>
  )
}
