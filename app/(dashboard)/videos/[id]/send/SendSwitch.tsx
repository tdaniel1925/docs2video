'use client'

import type { ReactNode } from 'react'

/**
 * One on/off row in the "Ready to send" panel.
 *
 * The switch shows the SAVED value. While a change is saving it says so; if
 * the save fails it stays where it was and the error is shown under it — it
 * never flips to "on" for a change that did not save.
 */
export default function SendSwitch({
  label, hint, on, saving, error, disabled, onToggle, children,
}: {
  label: string
  hint?: ReactNode
  on: boolean
  saving?: boolean
  error?: string | null
  disabled?: boolean
  onToggle: () => void
  children?: ReactNode
}) {
  const off = disabled || saving
  return (
    <div className="rts-row">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="rts-row-label">{label}</div>
          {hint && <div className="rts-row-hint">{hint}</div>}
        </div>
        {saving && <span className="rts-row-hint" style={{ margin: 0 }}>Saving…</span>}
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={label}
          disabled={off}
          onClick={onToggle}
          className={`rts-switch${on ? ' on' : ''}`}
        >
          <span className="rts-knob" />
        </button>
      </div>
      {error && <div role="alert" className="rts-error">{error}</div>}
      {children}
    </div>
  )
}
