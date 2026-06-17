import { createAdminClient } from './supabase/admin'

/**
 * Structured error logger. Console + optional webhook (existing behavior) PLUS
 * dedup-upsert into the `error_logs` table that powers the admin Logs view and
 * the fix-advisor. Existing callers — logError('context', err, meta) — keep
 * working unchanged and now automatically feed the admin Logs view.
 */

export type ErrorSource = 'vercel' | 'vps' | 'app'
export type ErrorSeverity = 'error' | 'warning' | 'critical'

export interface LoggedError {
  source: ErrorSource
  severity?: ErrorSeverity
  message: string
  detail?: string | null
  endpoint?: string | null
  videoId?: string | null
  userId?: string | null
}

/**
 * Normalize a message into a stable grouping signature: strip UUIDs, long hex,
 * numbers, and quoted strings so "video abc-123 failed" and "video def-456
 * failed" collapse to ONE signature. This is what dedupes the Logs view.
 */
export function errorSignature(message: string): string {
  return (message || '')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>') // uuid
    .replace(/\b[0-9a-f]{12,}\b/gi, '<hex>')   // long hex / tokens
    .replace(/\b\d+\b/g, '<n>')                // bare numbers
    .replace(/(["'`]).*?\1/g, '<str>')         // quoted strings
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500)
}

/**
 * Upsert an error into error_logs keyed by (signature, source): increments count
 * + bumps last_seen on repeat, inserts on first sight. Never throws (logging
 * must never break the caller).
 */
export async function upsertErrorLog(e: LoggedError): Promise<void> {
  try {
    const admin = createAdminClient()
    const signature = errorSignature(e.message)

    const { data: existing } = await admin
      .from('error_logs')
      .select('id, count')
      .eq('error_signature', signature)
      .eq('source', e.source)
      .maybeSingle()

    if (existing) {
      await admin
        .from('error_logs')
        .update({
          count: (existing.count || 1) + 1,
          last_seen: new Date().toISOString(),
          message: e.message.slice(0, 4000),
          detail: e.detail?.slice(0, 8000) ?? null,
          resolved: false, // a fresh occurrence reopens it
        })
        .eq('id', existing.id)
    } else {
      await admin.from('error_logs').insert({
        source: e.source,
        severity: e.severity || 'error',
        error_signature: signature,
        message: e.message.slice(0, 4000),
        detail: e.detail?.slice(0, 8000) ?? null,
        endpoint: e.endpoint ?? null,
        video_id: e.videoId ?? null,
        user_id: e.userId ?? null,
      })
    }
  } catch (err) {
    console.error('[error-logger] failed to record error:', err instanceof Error ? err.message : err)
  }
}

/**
 * Existing API — preserved. Logs to console, optional webhook, AND now upserts
 * into error_logs. Fire-and-forget on the DB write so it never blocks/throws.
 *
 *   logError('generate-video', err, { videoId, userId })
 */
export function logError(context: string, error: unknown, metadata?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined

  const payload = {
    timestamp: new Date().toISOString(),
    context,
    message,
    stack,
    metadata,
  }

  console.error('[error]', JSON.stringify(payload))

  // Fire-and-forget webhook if configured (unchanged behavior).
  if (process.env.ERROR_WEBHOOK_URL) {
    fetch(process.env.ERROR_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `[${context}] ${message}`, ...payload }),
    }).catch(() => {})
  }

  // Fire-and-forget DB upsert so this error appears in the admin Logs view.
  const videoId = (metadata?.videoId as string | undefined) ?? null
  const userId = (metadata?.userId as string | undefined) ?? null
  void upsertErrorLog({
    source: 'app',
    message,
    detail: stack ?? (metadata ? JSON.stringify(metadata) : undefined),
    endpoint: context,
    videoId,
    userId,
  })
}
