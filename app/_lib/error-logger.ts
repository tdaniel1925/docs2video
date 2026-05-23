/**
 * Simple structured error logger with optional webhook support.
 * Set ERROR_WEBHOOK_URL env var to forward errors to Slack/Discord.
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

  // Fire-and-forget webhook if configured
  if (process.env.ERROR_WEBHOOK_URL) {
    fetch(process.env.ERROR_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `[${context}] ${message}`, ...payload }),
    }).catch(() => {}) // never let webhook failure propagate
  }
}
