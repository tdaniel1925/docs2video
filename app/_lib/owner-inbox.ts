/**
 * THE ONE INBOX the owner's alerts go to.
 *
 * The 6-hourly health check (via /api/internal/error-report) emailed
 * tdaniel@botmakers.ai, while the daily digest emailed a different address
 * plus everyone in ADMIN_EMAILS. Now both read this: the env value
 * OWNER_ALERT_EMAIL if it is set, else the address the health check always
 * used. ADMIN_EMAILS is who may open /admin — it is NOT a mailing list.
 */
export const DEFAULT_OWNER_ALERT_EMAIL = 'tdaniel@botmakers.ai'

export function ownerAlertEmail(): string {
  const v = (process.env.OWNER_ALERT_EMAIL || '').trim()
  return v && v.includes('@') ? v : DEFAULT_OWNER_ALERT_EMAIL
}
