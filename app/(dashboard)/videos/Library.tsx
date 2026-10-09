'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, FileText, Film, GalleryVerticalEnd, Image as ImageIcon, LayoutGrid, List, Presentation, Search, Send, Trash2, X, type LucideIcon } from 'lucide-react'
import { Button, Dialog, EmptyState } from '../../_components/kit'
import { useToast } from '../../_components/Toast'
import { NAMES, type LibraryKind } from '../../_lib/names'
import LibraryTable from './LibraryTable'
import CardMenu from './CardMenu'
import {
  PAGE_SIZES, SORTS, VIEW_KEY, openHref, searchAndSort, sendHref, shortDate, statusLine,
  type LibraryItem, type SortId,
} from './library-items'
import s from './library.module.css'

/*
 * THE LIBRARY — VidWiz's picture cards (round A, 2026-10).
 *
 * Before: a seven-column table. On a phone it showed bare titles, so you
 * couldn't tell a finished video from a failed one, and Delete sat in every
 * row one slip from a click. Now:
 *  - cards with a picture, the title, one coloured status line in plain words
 *    ("Ready to send · 1:30", "Making… 65%", "Didn't finish"), the date, and a
 *    Send button on ready ones that opens the result page's send panel;
 *  - search, sort and a grid/list switch (the list is the old table, kept);
 *    the switch is remembered in this browser only;
 *  - Delete lives in each card's "…" menu and always asks first.
 * Everything is already on the page (one query per table on the server), so
 * search, sort and paging cost no extra database work.
 */
export default function Library({ items, emptyLabel = null }: { items: LibraryItem[]; emptyLabel?: string | null }) {
  const router = useRouter()
  const notify = useToast()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortId>('newest')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0])
  const [page, setPage] = useState(1)
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<LibraryItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  // The grid/list choice is a per-browser convenience. Storage can be missing
  // or blocked (private windows) — then it's just the grid.
  useEffect(() => {
    try { if (window.localStorage.getItem(VIEW_KEY) === 'list') setView('list') } catch { /* grid */ }
  }, [])
  const chooseView = (next: 'grid' | 'list') => {
    setView(next)
    try { window.localStorage.setItem(VIEW_KEY, next) } catch { /* not remembered, still switched */ }
  }

  // A new search or order starts from page 1.
  useEffect(() => { setPage(1) }, [query, sort, pageSize])

  // The "…" menu closes on a click elsewhere or Escape.
  useEffect(() => {
    if (!menuFor) return
    const close = (e: MouseEvent) => {
      if (!(e.target as Element | null)?.closest?.('[data-card-menu]')) setMenuFor(null)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuFor(null) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', onKey) }
  }, [menuFor])

  const live = useMemo(() => items.filter((i) => !removed.has(i.id)), [items, removed])
  const shown = useMemo(() => searchAndSort(live, query, sort), [live, query, sort])
  const total = shown.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const from = (safePage - 1) * pageSize
  const rows = shown.slice(from, from + pageSize)

  async function confirmDelete() {
    const item = confirming
    if (!item?.videoId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/videos/${item.videoId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Delete failed')
      setRemoved((prev) => new Set(prev).add(item.id))
      setConfirming(null)
      notify('Deleted.', 'success')
      router.refresh()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Delete failed', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const askDelete = (item: LibraryItem) => { setMenuFor(null); setConfirming(item) }

  if (live.length === 0) {
    return (
      <EmptyState
        title={emptyLabel ? `No ${emptyLabel} yet` : 'Nothing here yet'}
        actions={<Button href="/create/start">{NAMES.newButton}</Button>}
      >
        Everything you make shows up here — videos, presentations and commercials.
      </EmptyState>
    )
  }

  return (
    <div>
      <div className={s.toolbar}>
        <label className={s.search}>
          <Search size={16} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or client"
            aria-label="Search your library"
          />
          {query && (
            <button type="button" className={s.clear} onClick={() => setQuery('')} aria-label="Clear search"><X size={16} /></button>
          )}
        </label>
        <select className={s.sort} value={sort} onChange={(e) => setSort(e.target.value as SortId)} aria-label="Order">
          {SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <span className={s.count}>{total} {total === 1 ? 'item' : 'items'}</span>
        <div className={s.viewToggle} role="group" aria-label="Show as">
          <button type="button" aria-pressed={view === 'grid'} onClick={() => chooseView('grid')} aria-label="Cards" title="Cards"><LayoutGrid size={16} /></button>
          <button type="button" aria-pressed={view === 'list'} onClick={() => chooseView('list')} aria-label="List" title="List"><List size={16} /></button>
        </div>
      </div>

      {total === 0 ? (
        <EmptyState title={`Nothing matches “${query}”.`} actions={<Button variant="secondary" onClick={() => setQuery('')}>Clear search</Button>}>
          Try part of the title or the client’s name.
        </EmptyState>
      ) : view === 'grid' ? (
        <ul className={s.grid} aria-label="Your work">
          {rows.map((item) => (
            <LibraryCard
              key={item.id}
              item={item}
              menuOpen={menuFor === item.id}
              onMenu={() => setMenuFor(menuFor === item.id ? null : item.id)}
              onDelete={() => askDelete(item)}
            />
          ))}
        </ul>
      ) : (
        <LibraryTable
          rows={rows}
          menuFor={menuFor}
          onMenu={(id) => setMenuFor(menuFor === id ? null : id)}
          onDelete={askDelete}
        />
      )}

      {total > 0 && (
        <div className={s.pager}>
          <div className={s.pagerSide}>
            <span>Showing {from + 1}–{Math.min(from + pageSize, total)} of {total}</span>
            <span className={s.perPage}>
              Per page:
              {PAGE_SIZES.map((n) => (
                <button key={n} type="button" className={`kit-tab ${s.small}`} aria-pressed={pageSize === n} aria-current={pageSize === n ? 'page' : undefined} onClick={() => setPageSize(n)}>{n}</button>
              ))}
            </span>
          </div>
          <div className={s.pagerSide}>
            <Button variant="secondary" size="sm" disabled={safePage <= 1} onClick={() => setPage(Math.max(1, safePage - 1))}><ChevronLeft size={16} />Previous</Button>
            <span>Page {safePage} / {totalPages}</span>
            <Button variant="secondary" size="sm" disabled={safePage >= totalPages} onClick={() => setPage(Math.min(totalPages, safePage + 1))}>Next<ChevronRight size={16} /></Button>
          </div>
        </div>
      )}

      <Dialog
        open={!!confirming}
        onClose={() => { if (!deleting) setConfirming(null) }}
        title="Delete this for good?"
        sub="This can’t be undone. Any link you sent stops working."
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirming(null)} disabled={deleting}>Cancel</Button>
            <button type="button" className="kit-btn btn-danger" onClick={confirmDelete} disabled={deleting}>
              <Trash2 size={16} />{deleting ? 'Deleting…' : 'Delete'}
            </button>
          </>
        }
      >
        <p className={s.confirmTitle}>{confirming?.title ?? 'Untitled'}</p>
      </Dialog>
    </div>
  )
}

/** The picture when there is none yet: an icon and the kind, never a broken image. */
const KIND_ICON: Record<LibraryKind, LucideIcon> = {
  video: Film,
  presentation: Presentation,
  deck: GalleryVerticalEnd,
  graphic: ImageIcon,
}

export function Placeholder({ item }: { item: LibraryItem }) {
  const Icon = item.kind ? KIND_ICON[item.kind] : FileText
  return (
    <span className={s.placeholder} data-kind={item.kind ?? 'other'}>
      <Icon size={20} />
      <span>{item.status === 'draft' ? 'Not made yet' : item.label}</span>
    </span>
  )
}

/** A picture that falls back to the placeholder if it fails to load. */
function Thumb({ item }: { item: LibraryItem }) {
  const [failed, setFailed] = useState(false)
  const ref = useRef<HTMLImageElement>(null)
  // A picture that failed before the page woke up never fires onError.
  useEffect(() => {
    const img = ref.current
    if (img && img.complete && img.naturalWidth === 0) setFailed(true)
  }, [])
  if (!item.picture || failed) return <Placeholder item={item} />
  // The placeholder sits underneath, so a big picture that is still loading
  // shows the kind of thing, not an empty box.
  return (
    <>
      <Placeholder item={item} />
      {/* eslint-disable-next-line @next/next/no-img-element -- stored pictures on many hosts; a plain lazy img keeps the Library light */}
      <img ref={ref} className={s.thumb} data-kind={item.kind ?? 'other'} src={item.picture} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
    </>
  )
}

/*
 * One card. The whole card is one link (an invisible layer over it, VidWiz's
 * "library-hit"); Send and the "…" menu sit above that layer so they can be
 * pressed on their own.
 */
function LibraryCard({ item, menuOpen, onMenu, onDelete }: {
  item: LibraryItem
  menuOpen: boolean
  onMenu: () => void
  onDelete: () => void
}) {
  const status = statusLine(item)
  const send = sendHref(item)
  const external = item.type !== 'video'
  const title = item.title ?? 'Untitled'
  return (
    <li className={`${s.card} ${menuOpen ? s.cardRaised : ''}`} data-status={status.tone}>
      <Link
        className={s.hit}
        href={openHref(item)}
        aria-label={`Open ${title}`}
        // No prefetch: 24 cards each warming a project page at once kept the
        // browser's few connections to our site busy and slowed every click.
        prefetch={false}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      />
      <div className={s.media}>
        <Thumb item={item} />
        <span className={s.kind}>{item.label}</span>
        {send && (
          <Link className={s.send} href={send} prefetch={false} aria-label={`Send ${title}`}>
            <Send size={16} /><span>Send</span>
          </Link>
        )}
      </div>
      <div className={s.body}>
        <strong className={s.title} title={title}>{title}</strong>
        <span className={s.status} data-tone={status.tone}>{status.words}</span>
        <span className={s.meta}>
          {shortDate(item.createdAt)}{item.recipient ? ` · for ${item.recipient}` : ''}
        </span>
        <CardMenu item={item} open={menuOpen} onMenu={onMenu} onDelete={onDelete} />
      </div>
    </li>
  )
}
