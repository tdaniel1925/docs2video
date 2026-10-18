'use client'

import Link from 'next/link'
import type { LeftItem } from './whats-left'

/**
 * "What's left" — small chips above Send for things that would make the
 * client's page better and are missing (see whats-left.ts for the list and
 * why each one is checkable). Each chip goes straight to the fix: a box on
 * this panel, or the right Settings tab. Nothing missing → a quiet "all set".
 * Deliberately not a live region: the panel's one status line is the
 * "Sent to …" confirmation.
 */
export default function WhatsLeft({ items }: { items: LeftItem[] }) {
  return (
    <div className="rts-left" data-testid="whats-left">
      <div className="rts-eyebrow">What’s left</div>
      {items.length === 0 ? (
        <div className="rts-row-hint rts-left-done">✓ All set — their page has everything.</div>
      ) : (
        <ul className="rts-left-list">
          {items.map((item) => (
            <li key={item.key}>
              {'focus' in item.fix ? (
                <button
                  type="button"
                  className="rts-left-chip"
                  data-left={item.key}
                  onClick={() => {
                    const el = document.getElementById((item.fix as { focus: string }).focus)
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    el?.focus()
                  }}
                >
                  + {item.label}
                </button>
              ) : (
                <Link href={item.fix.href} className="rts-left-chip" data-left={item.key}>+ {item.label} →</Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
