'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Copy, Ellipsis, Pencil, Share2, Trash2 } from 'lucide-react'
import type { Video } from '../../../../_lib/types'
import { Button, Dialog } from '../../../../_components/kit'
import DownloadsMenu from './DownloadsMenu'
import Menu from './Menu'
import SocialPostsDialog from '../extras/SocialPostsDialog'
import { thingWord } from './output'

type Notice = (n: { type: 'error' | 'success'; message: string }) => void

/**
 * The top of a finished project: its name (click to rename — the name shows
 * on the client's page too), when it was made, and two menus:
 *   Download ▾  — only the files this project really has (downloads.ts)
 *   More ▾      — Rename, Duplicate, Social posts, Delete
 * These used to be ten same-sized buttons under the player, with Delete next
 * to Edit and an older second "Send to Client" among them.
 */
export default function ResultHeader({ video, setVideo, onNotice }: {
  video: Video
  setVideo: (updater: (prev: Video | null) => Video | null) => void
  onNotice: Notice
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [social, setSocial] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const thing = thingWord(video)
  const finished = video.status === 'completed'

  function startRename() { setDraft(video.title ?? ''); setEditing(true) }

  async function saveTitle() {
    const next = draft.trim().slice(0, 120)
    if (!next || next === (video.title ?? '')) { setEditing(false); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/videos/${video.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: next }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'The name was NOT saved — try again.')
      setVideo((prev) => (prev ? ({ ...prev, title: next } as Video) : prev))
      setEditing(false)
    } catch (e) {
      onNotice({ type: 'error', message: e instanceof Error ? e.message : 'The name was NOT saved — try again.' })
    } finally {
      setSaving(false)
    }
  }

  // Through the API, and the answer is CHECKED: a project that can't be
  // deleted (one a campaign still links to) used to be reported as gone.
  async function doDelete() {
    setDeleting(true)
    try {
      const r = await fetch(`/api/videos/${video.id}`, { method: 'DELETE' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        onNotice({ type: 'error', message: d.error || `The ${thing} was NOT deleted — try again.` })
        setDeleting(false); setConfirmDelete(false)
        return
      }
      router.push('/videos')
    } catch {
      onNotice({ type: 'error', message: `The ${thing} was NOT deleted — check your connection and try again.` })
      setDeleting(false); setConfirmDelete(false)
    }
  }

  const duration = video.duration
    ? ` · ${Math.floor(video.duration / 60)}:${Math.round(video.duration % 60).toString().padStart(2, '0')}`
    : ''

  return (
    <header className="res-head">
      <Link href="/videos" className="back-link">&larr; Back to Library</Link>
      <div className="res-head-row">
        <div className="res-head-title">
          {editing ? (
            <div className="res-rename">
              <label htmlFor="res-title" className="kit-sr">Name</label>
              <input
                id="res-title"
                autoFocus
                className="input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditing(false) }}
                maxLength={120}
                placeholder="Name (shows on your client’s page)"
                disabled={saving}
              />
              <Button size="sm" onClick={saveTitle} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
              <Button size="sm" variant="quiet" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
            </div>
          ) : (
            <h1 className="page-title res-title" onClick={startRename} title="Click to rename — the name shows on your client’s page">
              <span className="res-title-text">{video.title ?? 'Untitled'}</span>
              <Pencil size={16} className="res-title-pen" />
            </h1>
          )}
          <div className="res-meta">
            {new Date(video.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {duration}
            {video.brand && (
              <>
                {' · '}
                <span className="res-brand">
                  {video.brand.primary_color && <span className="res-brand-dot" style={{ background: video.brand.primary_color }} />}
                  {video.brand.name}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="res-head-actions">
          {finished && <DownloadsMenu video={video} onNotice={onNotice} />}
          <Menu label={<><Ellipsis size={16} />More</>} testId="more-menu">
            {(close) => (
              <>
                <button type="button" role="menuitem" className="kit-menu-item" onClick={() => { close(); startRename() }}><span className="res-menu-word"><Pencil size={16} />Rename</span></button>
                {finished && (
                  <button type="button" role="menuitem" className="kit-menu-item" onClick={() => { close(); router.push(`/create?duplicate=${video.id}`) }}>
                    <span className="res-menu-word"><Copy size={16} />Duplicate</span>
                  </button>
                )}
                {finished && (
                  <button type="button" role="menuitem" className="kit-menu-item" onClick={() => { close(); setSocial(true) }}><span className="res-menu-word"><Share2 size={16} />Social posts</span></button>
                )}
                <hr className="kit-menu-sep" />
                <button type="button" role="menuitem" className="kit-menu-item res-danger" onClick={() => { close(); setConfirmDelete(true) }}><span className="res-menu-word"><Trash2 size={16} />Delete</span></button>
              </>
            )}
          </Menu>
        </div>
      </div>

      {finished && video.render_note && (
        <div className="kit-note kit-note--warn res-gap" role="status">
          <div className="kit-note-body"><p>{video.render_note}</p></div>
        </div>
      )}

      <SocialPostsDialog videoId={video.id} open={social} onClose={() => setSocial(false)} />
      <Dialog
        open={confirmDelete}
        onClose={() => { if (!deleting) setConfirmDelete(false) }}
        title={`Delete this ${thing}?`}
        sub="This can’t be undone. The link you sent stops working."
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</Button>
            <button type="button" className="kit-btn btn-danger" onClick={doDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</button>
          </>
        }
      >
        <p className="res-hint">{video.title ?? 'Untitled'}</p>
      </Dialog>
    </header>
  )
}
