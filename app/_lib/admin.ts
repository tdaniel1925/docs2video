/**
 * Admin email list — fallback for when DB check fails.
 */
const FALLBACK_ADMIN_EMAILS = [
  'trenttdaniel@gmail.com',
  'tdaniel@botmakers.ai',
  'phil@valorfs.com',
]

export function isAdmin(email: string | null | undefined): boolean {
  return FALLBACK_ADMIN_EMAILS.includes(email ?? '')
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
