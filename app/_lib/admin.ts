/**
 * Admin email list — fallback for when DB check fails.
 * The pure check lives in admin-emails.ts (client-safe; this module can't be
 * imported by 'use client' files because requireAdmin pulls in next/headers).
 */
export { isAdmin } from './admin-emails'

// DB-driven check (use in server components/API routes)
export async function isAdminDB(userId: string): Promise<boolean> {
  const { createAdminClient } = await import('./supabase/admin')
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('is_admin').eq('id', userId).single()
  return data?.is_admin === true
}

/** True when the sign-in has a confirmed email address. */
export function emailConfirmed(user: { email_confirmed_at?: string | null; confirmed_at?: string | null } | null | undefined): boolean {
  return !!(user && (user.email_confirmed_at || user.confirmed_at))
}

/**
 * Authoritative admin check for API routes and the /admin pages.
 *
 * Audit 2026-10-09: an email address alone is NOT enough. Admin means BOTH a
 * confirmed email on the sign-in AND profiles.is_admin = true. (It used to be
 * "on the email list OR flagged" — so anyone who could get a session for a
 * listed address, confirmed or not, was an admin.) The email list (isAdmin)
 * is now only a hint for page layout, never a permission.
 * Fails closed: an unreadable profile is not an admin.
 */
export async function isAdminRequest(
  user: { id: string; email?: string | null; email_confirmed_at?: string | null; confirmed_at?: string | null } | null | undefined,
): Promise<boolean> {
  if (!user) return false
  if (!emailConfirmed(user)) return false
  try {
    return await isAdminDB(user.id)
  } catch {
    return false
  }
}

export async function isBetaOrAdmin(userId: string): Promise<boolean> {
  const { createAdminClient } = await import('./supabase/admin')
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('is_admin, is_beta').eq('id', userId).single()
  return data?.is_admin === true || data?.is_beta === true
}

/**
 * One-call admin gate for API routes (review Q3). Replaces the
 * getUser + isAdminRequest boilerplate that ~38 admin routes each
 * re-implemented — and that drift made possible (some routes checked only the
 * email list, others only the DB flag; both classes locked out real admins).
 * Returns the authenticated admin user, or null (caller returns 401/403).
 *
 *   const admin = await requireAdmin()
 *   if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
 */
export async function requireAdmin(): Promise<{ id: string; email?: string | null } | null> {
  const { createClient } = await import('./supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return (await isAdminRequest(user)) ? user : null
}
