'use client'

import Link from 'next/link'
import { Ellipsis, FolderOpen, Send, Trash2 } from 'lucide-react'
import { canDelete, openHref, sendHref, type LibraryItem } from './library-items'
import s from './library.module.css'

/** The "…" menu, shared by the cards and the list. */
export default function CardMenu({ item, open, onMenu, onDelete, flat = false }: {
  item: LibraryItem
  open: boolean
  onMenu: () => void
  onDelete: () => void
  flat?: boolean
}) {
  const external = item.type !== 'video'
  const send = sendHref(item)
  return (
    <div className={`kit-menu-anchor ${flat ? s.menuFlat : s.menu}`} data-card-menu>
      <button type="button" className={s.more} onClick={onMenu} aria-haspopup="menu" aria-expanded={open} aria-label={`More for ${item.title ?? 'Untitled'}`}>
        <Ellipsis size={16} />
      </button>
      {open && (
        <div className={`kit-menu ${s.menuPanel}`} role="menu">
          <Link role="menuitem" className="kit-menu-item" href={openHref(item)} {...(external ? { target: '_blank', rel: 'noopener noreferrer', prefetch: false } : {})}>
            <span className={s.menuWord}><FolderOpen size={16} />Open</span>
          </Link>
          {send && (
            <Link role="menuitem" className="kit-menu-item" href={send}>
              <span className={s.menuWord}><Send size={16} />Send</span>
            </Link>
          )}
          {canDelete(item) && (
            <>
              <hr className="kit-menu-sep" />
              <button type="button" role="menuitem" className={`kit-menu-item ${s.danger}`} onClick={onDelete}>
                <span className={s.menuWord}><Trash2 size={16} />Delete…</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

