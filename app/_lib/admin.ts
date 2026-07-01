/**
 * Admin email list — fallback for when DB check fails.
 * The pure check lives in admin-emails.ts (client-safe; this module can't be
 * imported by 'use client' files because requireAdmin pulls in next/headers).
 */
export { isAdmin } from './admin-emails'
import { isAdmin } from './admin-emails'

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
