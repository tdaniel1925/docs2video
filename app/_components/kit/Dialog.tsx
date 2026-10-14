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
  /**
   * PAYMENT pop-ups only: `false` keeps the rest of the page clickable. A
   * modal <dialog> makes everything outside it inert and sits in the browser's
   * top layer — and Stripe opens the bank's security check (3D Secure) and
   * wallet windows OUTSIDE our pop-up, so they were frozen behind it. A
   * non-modal one sits on its own dimmed layer (above the top bar) instead;
   * Escape and a click on the dim still close it, and focus still starts
   * inside and goes back to the button that opened it.
   */
  modal?: boolean
  /** Wider box (payment forms). */
  wide?: boolean
}

export default function Dialog(props: DialogProps) {
  if (!props.open) return null
  return props.modal === false ? <FreeDialog {...props} /> : <OpenDialog {...props} />
}

function DialogHead({ titleId, subId, title, sub, closeLabel, onClose }: {
  titleId: string; subId: string; title: ReactNode; sub?: ReactNode; closeLabel: string; onClose: () => void
}) {
  return (
    <div className="kit-dialog-head">
      <div>
        <h2 id={titleId} className="kit-dialog-title">{title}</h2>
        {sub != null && <p id={subId} className="kit-dialog-sub">{sub}</p>}
      </div>
      <button type="button" className="kit-icon-btn" onClick={onClose} aria-label={closeLabel}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}

function FreeDialog({ onClose, title, sub, children, footer, closeLabel = 'Close', wide }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const subId = useId()
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const d = ref.current
    // Focus the first thing inside (the close button at worst).
    const first = d?.querySelector<HTMLElement>('input, select, textarea, button:not(.kit-icon-btn), [href]') ?? d?.querySelector<HTMLElement>('button')
    first?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [])

  return (
    <div className="kit-dialog-layer" onMouseDown={(e) => { if (e.target === e.currentTarget) onCloseRef.current() }}>
      <dialog
        ref={ref}
        open
        aria-modal="true"
        className={`kit-dialog kit-dialog--free${wide ? ' kit-dialog--wide' : ''}`}
        aria-labelledby={titleId}
        aria-describedby={sub ? subId : undefined}
      >
        <DialogHead titleId={titleId} subId={subId} title={title} sub={sub} closeLabel={closeLabel} onClose={() => onCloseRef.current()} />
        <div className="kit-dialog-body">{children}</div>
        {footer != null && <div className="kit-dialog-foot">{footer}</div>}
      </dialog>
    </div>
  )
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
    const handle = () => {
      // The browser sends 'close' a moment AFTER close(). When React runs this
      // effect twice (development's strict mode: set up, clean up, set up),
      // the clean-up's close arrives at the NEW listener and used to shut the
      // dialog the instant it opened. A close we made ourselves is ignored.
      if (d.dataset.selfClose) { delete d.dataset.selfClose; return }
      onCloseRef.current()
    }
    d.addEventListener('close', handle)
    if (!d.open) d.showModal()
    return () => {
      d.removeEventListener('close', handle)
      // Closed by the parent (e.g. a new screen): close properly first so the
      // browser hands focus back to the button that opened it.
      if (d.open) { d.dataset.selfClose = '1'; d.close() }
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
