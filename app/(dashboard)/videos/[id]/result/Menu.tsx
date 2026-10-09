'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * A button that drops a small menu (the kit's menu look, like the avatar
 * menu). Closes on Escape, on a click outside, and after a choice.
 */
export default function Menu({ label, children, variant = 'secondary', align = 'right', testId }: {
  label: ReactNode
  /** Render-prop so items can close the menu after they run. */
  children: (close: () => void) => ReactNode
  variant?: 'primary' | 'secondary'
  align?: 'left' | 'right'
  testId?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <div className="kit-menu-anchor" ref={ref} data-testid={testId}>
      <button
        type="button"
        className={`kit-btn kit-btn--${variant} kit-btn--sm`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {label}<ChevronDown size={16} />
      </button>
      {open && (
        <div className={`kit-menu res-menu${align === 'left' ? ' res-menu--left' : ''}`} role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}
