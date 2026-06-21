'use client'

import { createContext, useCallback, useContext, useState } from 'react'

/**
 * App-wide inline notice system (replaces blocking window.alert popups).
 * Non-blocking banners stacked top-right; auto-dismiss. Usage:
 *   const notify = useToast()
 *   notify('Saved!')                       // success (default)
 *   notify('Could not save', 'error')      // error
 *   notify('Heads up…', 'info')            // info
 */
type ToastKind = 'success' | 'error' | 'info'
type ToastItem = { id: number; message: string; kind: ToastKind }

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

let _nextId = 1

const STYLES: Record<ToastKind, { bg: string; border: string; fg: string; icon: string }> = {
  success: { bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.35)', fg: '#15803d', icon: '✓' },
  error: { bg: 'rgba(220,38,38,0.10)', border: 'rgba(220,38,38,0.35)', fg: '#b91c1c', icon: '!' },
  info: { bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.35)', fg: '#1d4ed8', icon: 'i' },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const notify = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = _nextId++
    setToasts((t) => [...t, { id, message, kind }])
    // Auto-dismiss; errors linger a bit longer so they're readable.
    setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 4000)
  }, [dismiss])

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: 'fixed', top: 16, right: 16, zIndex: 4000,
          display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 380,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => {
          const s = STYLES[t.kind]
          return (
            <div
              key={t.id}
              role="alert"
              onClick={() => dismiss(t.id)}
              style={{
                pointerEvents: 'auto', cursor: 'pointer',
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '12px 16px', borderRadius: 10,
                background: '#fff', border: `1.5px solid ${s.border}`,
                boxShadow: '0 8px 28px rgba(0,0,0,0.12)',
                fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: 'var(--ink, #1a1714)',
              }}
            >
              <span style={{
                flex: '0 0 auto', width: 20, height: 20, borderRadius: 6,
                display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800,
                background: s.bg, color: s.fg,
              }}>{s.icon}</span>
              <span>{t.message}</span>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
