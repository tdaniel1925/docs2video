'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

/*
 * TABS — one row of choices that switch what the screen shows.
 *  - Give each tab an `href` when the choice belongs in the address (the
 *    Library keeps its tab in the URL so a refresh keeps it). They render as
 *    links; the current one carries aria-current="page".
 *  - Otherwise pass `onSelect` and they render as buttons in a tablist.
 */
export type Tab<K extends string> = { key: K; label: ReactNode; href?: string }

export default function Tabs<K extends string>({
  tabs,
  current,
  onSelect,
  label,
  className = '',
}: {
  tabs: Tab<K>[]
  current: K
  onSelect?: (key: K) => void
  /** What the row is, read out by screen readers ("Show"). */
  label: string
  className?: string
}) {
  const asLinks = tabs.every((t) => t.href)
  if (asLinks) {
    return (
      <nav className={`kit-tabs ${className}`.trim()} aria-label={label}>
        {tabs.map((t) => (
          <Link key={t.key} href={t.href!} className="kit-tab" aria-current={t.key === current ? 'page' : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>
    )
  }
  return (
    <div className={`kit-tabs ${className}`.trim()} role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          className="kit-tab"
          aria-selected={t.key === current}
          onClick={() => onSelect?.(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
