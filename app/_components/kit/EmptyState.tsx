import type { ReactNode } from 'react'

/*
 * EMPTY STATE — what a list says when there's nothing in it yet. Always says
 * what WILL be here and gives the one way to fill it, so an empty screen is a
 * start, not a dead end.
 */
export default function EmptyState({
  title,
  children,
  actions,
  className = '',
}: {
  title: ReactNode
  children?: ReactNode
  /** One or two kit Buttons. */
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={`kit-empty ${className}`.trim()}>
      <p className="kit-empty-title">{title}</p>
      {children != null && <p className="kit-empty-text">{children}</p>}
      {actions != null && <div className="kit-empty-actions">{actions}</div>}
    </div>
  )
}
