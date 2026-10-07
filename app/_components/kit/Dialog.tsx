'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'

/*
 * DIALOG — an in-app pop-up, built on the browser's own <dialog>:
 *  - it sits above everything (no z-index fights with the sticky top bar —
 *    the old pop-ups sat UNDER it and their close button couldn't be clicked);
 *  - focus moves inside when it opens and stays inside while it's open;
 *  - Escape closes it, and focus goes back to the button that opened it;
 *  - a click on the dimmed page around it closes it too.
 * The parent owns `open`; every way of closing calls `onClose`.
 *
 * It is only in the page WHILE open. A closed <dialog> left in the page still
 * holds its words, so "find the Save button" found two (the screen's and the
 * pop-up's copy of the steps) and screen-reader search found ghosts.
 */
type DialogProps = {
  open: boolean
  onClose: () => void
  title: ReactNode
  sub?: ReactNode
  children: ReactNode
  footer?: ReactNode
  closeLabel?: string
}

export default function Dialog(props: DialogProps) {
  if (!props.open) return null
  return <OpenDialog {...props} />
}

function OpenDialog({ onClose, title, sub, children, footer, closeLabel = 'Close' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const subId = useId()
  // Keep the latest onClose without re-binding the listener every render.
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    const d = ref.current
    if (!d) return
    const handle = () => onCloseRef.current()
    d.addEventListener('close', handle)
    if (!d.open) d.showModal()
    return () => {
      d.removeEventListener('close', handle)
      // Closed by the parent (e.g. a new screen): close properly first so the
      // browser hands focus back to the button that opened it.
      if (d.open) d.close()
    }
  }, [])

  return (
    <dialog
      ref={ref}
      className="kit-dialog"
      aria-labelledby={titleId}
      aria-describedby={sub ? subId : undefined}
      // The dialog box itself has no padding, so a click whose target is the
      // <dialog> element landed on the dimmed backdrop around it.
      onClick={(e) => { if (e.target === ref.current) ref.current?.close() }}
    >
      <div className="kit-dialog-head">
        <div>
          <h2 id={titleId} className="kit-dialog-title">{title}</h2>
          {sub != null && <p id={subId} className="kit-dialog-sub">{sub}</p>}
        </div>
        <button type="button" className="kit-icon-btn" onClick={() => ref.current?.close()} aria-label={closeLabel}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="kit-dialog-body">{children}</div>
      {footer != null && <div className="kit-dialog-foot">{footer}</div>}
    </dialog>
  )
}
