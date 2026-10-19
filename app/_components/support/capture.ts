'use client'

import { LIMITS, redact } from '../../_lib/support/report-rules'

/*
 * What the app logged, kept so a report can carry it: the last few console
 * errors, uncaught errors and failed network calls. Installed once, in the
 * browser, by the "Something not working?" tab. Every line is redacted as it
 * is kept (emails, phones, keys), and only the path of a failed call is kept,
 * never its query string or body.
 */

const errors: string[] = []
const failed: string[] = []
let installed = false

const keep = (list: string[], line: string) => {
  list.push(redact(line).slice(0, LIMITS.logItemMax))
  if (list.length > LIMITS.logItems) list.shift()
}

const pathOf = (input: RequestInfo | URL): string => {
  try {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const u = new URL(raw, window.location.origin)
    return u.origin === window.location.origin ? u.pathname : `${u.host}${u.pathname}`
  } catch { return '(unknown)' }
}

export function installCapture(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  const origError = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    try { keep(errors, args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : typeof a === 'string' ? a : safeJson(a))).join(' ')) } catch { /* never break logging */ }
    origError(...args)
  }
  window.addEventListener('error', (e) => keep(errors, `Uncaught: ${e.message}${e.filename ? ` (${pathOnly(e.filename)}:${e.lineno})` : ''}`))
  window.addEventListener('unhandledrejection', (e) => {
    const r = (e as PromiseRejectionEvent).reason
    keep(errors, `Unhandled: ${r instanceof Error ? `${r.name}: ${r.message}` : safeJson(r)}`)
  })

  const origFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
    try {
      const res = await origFetch(input, init)
      // Our own report call is never logged as a failure in the next report.
      if (!res.ok && !pathOf(input).startsWith('/api/support/')) keep(failed, `${method} ${pathOf(input)} → ${res.status}`)
      return res
    } catch (err) {
      keep(failed, `${method} ${pathOf(input)} → network error`)
      throw err
    }
  }
}

function pathOnly(u: string): string {
  try { return new URL(u).pathname } catch { return u }
}

function safeJson(v: unknown): string {
  try { return JSON.stringify(v)?.slice(0, LIMITS.logItemMax) ?? String(v) } catch { return String(v) }
}

export function capturedLogs(): { consoleErrors: string[]; failedCalls: string[] } {
  return { consoleErrors: [...errors], failedCalls: [...failed] }
}

/** For tests. */
export function __resetCapture() { errors.length = 0; failed.length = 0; installed = false }
