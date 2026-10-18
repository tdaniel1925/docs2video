import type { ReactNode } from 'react'

/*
 * A NOTE — one line (or a few) that tells the customer something, coloured by
 * what it means (app/kit.css):
 *   info  — good to know          ok   — it worked / it's done
 *   warn  — check this            stop — this blocks you
 * `action` is the one button that fixes it ("Update card"), at the right.
 * Words are always the dark ink; only the edge and the tint carry the meaning,
 * so the note stays readable whatever the tone.
 */
export type NoteTone = 'info' | 'ok' | 'warn' | 'stop'

export default function Note({
  tone = 'info',
  title,
  children,
  action,
  className = '',
}: {
  tone?: NoteTone
  /** A bold lead-in, e.g. "Out of credits." */
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  // stop/warn are announced; info/ok wait their turn.
  const role = tone === 'stop' || tone === 'warn' ? 'alert' : 'status'
  return (
    <div className={`kit-note kit-note--${tone} ${className}`.trim()} role={role}>
      <div className="kit-note-body">
        <p>
          {title != null && <><strong className="kit-note-title">{title}</strong>{' '}</>}
          {children}
        </p>
      </div>
      {action != null && <div className="kit-note-action">{action}</div>}
    </div>
  )
}
