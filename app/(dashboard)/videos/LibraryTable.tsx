'use client'

import Link from 'next/link'
import CardMenu from './CardMenu'
import { openHref, sendHref, shortDate, statusLine, type LibraryItem } from './library-items'
import s from './library.module.css'

/*
 * THE LIST VIEW — the Library's old table, kept for people who like rows
 * (the grid/list switch is remembered per browser). Paging, search and sort
 * happen in Library.tsx; this only draws the rows it is given.
 *
 * Delete is no longer a red button in every row: it sits in the "…" menu and
 * asks first, the same as on the cards. On a phone the table keeps the title,
 * the status and the actions (the other columns fold away) so it never
 * scrolls sideways.
 */
export default function LibraryTable({ rows, menuFor, onMenu, onDelete }: {
  rows: LibraryItem[]
  menuFor: string | null
  onMenu: (id: string) => void
  onDelete: (item: LibraryItem) => void
}) {
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>
            <th>Title</th>
            <th className={s.wide}>Type</th>
            <th className={s.wide}>Recipient</th>
            <th className={s.statusCol}>Status</th>
            <th className={`${s.wide} ${s.num}`}>Credits</th>
            <th className={`${s.wide} ${s.num}`}>Created</th>
            <th className={s.num}><span className="kit-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => {
            const external = item.type !== 'video'
            const status = statusLine(item)
            const send = sendHref(item)
            return (
              <tr key={item.id}>
                <td className={s.titleCell}>
                  <Link href={openHref(item)} prefetch={false} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                    {item.title ?? 'Untitled'}
                  </Link>
                  {/* Phones: the status sits under the title (its column folds away). */}
                  <span className={`${s.status} ${s.phoneStatus}`} data-tone={status.tone}>{status.words}</span>
                </td>
                <td className={s.wide}><span className="kit-chip kit-chip--neutral">{item.label}</span></td>
                <td className={`${s.wide} ${s.soft}`}>{item.recipient || '—'}</td>
                <td className={s.statusCol}><span className={s.status} data-tone={status.tone}>{status.words}</span></td>
                <td className={`${s.wide} ${s.num} ${s.soft}`}>{item.creditsUsed != null ? item.creditsUsed : '—'}</td>
                <td className={`${s.wide} ${s.num} ${s.soft}`}>{shortDate(item.createdAt)}</td>
                <td className={s.num}>
                  <span className={s.rowActions}>
                    {send
                      ? <Link href={send} prefetch={false} className="kit-btn kit-btn--secondary kit-btn--sm">Send</Link>
                      : <Link href={openHref(item)} className="kit-btn kit-btn--secondary kit-btn--sm" prefetch={false} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>Open</Link>}
                    <CardMenu item={item} open={menuFor === item.id} onMenu={() => onMenu(item.id)} onDelete={() => onDelete(item)} flat />
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
