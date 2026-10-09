'use client'

import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Dialog, Button, Note } from '../../../_components/kit'

/*
 * ONE way to ask "are you sure?" in the admin — the kit pop-up, never the
 * browser's own confirm() box. Every risky admin button calls `ask(...)` and
 * only acts when it resolves `{ ok: true }` (guard: tests/admin-fixes.test.ts).
 *
 *   const [ask, confirmDialog] = useConfirm()
 *   const r = await ask({ title: 'Make Jane an admin?', body: '…', confirmLabel: 'Make admin' })
 *   if (!r.ok) return
 *   …render {confirmDialog} somewhere in the screen.
 *
 * Options:
 *   reasonLabel — shows a required "Why?" box; the words come back as `reason`
 *   typeToConfirm — the person must type this word first (very risky actions)
 *   danger — red-edged warning note + the button says it plainly
 */
export interface ConfirmOptions {
  title: ReactNode
  body?: ReactNode
  confirmLabel: string
  danger?: boolean
  /** A warning shown in a note above the buttons. */
  warning?: ReactNode
  reasonLabel?: string
  typeToConfirm?: string
}

export interface ConfirmResult { ok: boolean; reason: string }

export function useConfirm(): [(o: ConfirmOptions) => Promise<ConfirmResult>, ReactNode] {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const [reason, setReason] = useState('')
  const [typed, setTyped] = useState('')
  const resolver = useRef<((r: ConfirmResult) => void) | null>(null)

  const ask = useCallback((o: ConfirmOptions) => {
    setReason('')
    setTyped('')
    setOpts(o)
    return new Promise<ConfirmResult>((resolve) => { resolver.current = resolve })
  }, [])

  const finish = (ok: boolean) => {
    resolver.current?.({ ok, reason: reason.trim() })
    resolver.current = null
    setOpts(null)
  }

  const reasonOk = !opts?.reasonLabel || reason.trim().length >= 3
  const typedOk = !opts?.typeToConfirm || typed.trim().toLowerCase() === opts.typeToConfirm.toLowerCase()

  const dialog = (
    <Dialog
      open={!!opts}
      onClose={() => finish(false)}
      title={opts?.title}
      footer={
        <div className="admin-dialog-buttons">
          <Button variant="quiet" onClick={() => finish(false)}>Cancel</Button>
          <Button
            variant="primary"
            className={opts?.danger ? 'admin-btn-danger' : ''}
            disabled={!reasonOk || !typedOk}
            disabledReason={!reasonOk ? 'Write a short reason first.' : !typedOk ? `Type ${opts?.typeToConfirm} first.` : undefined}
            onClick={() => finish(true)}
          >
            {opts?.confirmLabel}
          </Button>
        </div>
      }
    >
      {opts?.body != null && <div className="admin-dialog-text">{opts.body}</div>}
      {opts?.warning != null && <Note tone={opts.danger ? 'stop' : 'warn'}>{opts.warning}</Note>}
      {opts?.reasonLabel && (
        <label className="admin-field">
          <span className="admin-field-label">{opts.reasonLabel}</span>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Refund for a broken video" autoFocus />
        </label>
      )}
      {opts?.typeToConfirm && (
        <label className="admin-field">
          <span className="admin-field-label">Type <b>{opts.typeToConfirm}</b> to confirm</span>
          <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </label>
      )}
    </Dialog>
  )
  return [ask, dialog]
}
