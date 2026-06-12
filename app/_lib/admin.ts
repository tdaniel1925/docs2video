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

/**
 * Authoritative admin check for API routes. True if the user is in the
 * hardcoded/email-list admins OR has profiles.is_admin = true. Most admin
 * routes historically checked ONLY the email list, which locked out
 * flag-based admins (e.g. Phil). Use this everywhere instead of isAdmin(email).
 */
export async function isAdminRequest(user: { id: string; email?: string | null } | null | undefined): Promise<boolean> {
  if (!user) return false
  if (isAdmin(user.email)) return true
  return isAdminDB(user.id)
}

export async function isBetaOrAdmin(userId: string): Promise<boolean> {
  const { createAdminClient } = await import('./supabase/admin')
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('is_admin, is_beta').eq('id', userId).single()
  return data?.is_admin === true || data?.is_beta === true
}
