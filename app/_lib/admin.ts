/**
 * Admin email list — fallback for when DB check fails.
 * Reads from ADMIN_EMAILS env var (comma-separated).
 */
const HARDCODED_ADMINS = ['trenttdaniel@gmail.com', 'tdaniel@botmakers.ai']

const FALLBACK_ADMIN_EMAILS: string[] = [
  ...HARDCODED_ADMINS,
  ...(process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
]

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return FALLBACK_ADMIN_EMAILS.includes(email.toLowerCase())
}

// DB-driven check (use in server components/API routes)
export async function isAdminDB(userId: string): Promise<boolean> {
  const { createAdminClient } = await import('./supabase/admin')
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('is_admin').eq('id', userId).single()
  return data?.is_admin === true
}

export async function isBetaOrAdmin(userId: string): Promise<boolean> {
  const { createAdminClient } = await import('./supabase/admin')
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('is_admin, is_beta').eq('id', userId).single()
  return data?.is_admin === true || data?.is_beta === true
}
