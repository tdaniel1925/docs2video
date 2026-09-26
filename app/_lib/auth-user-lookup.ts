import type { SupabaseClient, User } from '@supabase/supabase-js'

/**
 * Find a sign-in account by its SIGN-IN email (the one Supabase Auth holds),
 * using the admin (service-role) client.
 *
 * Why not `profiles.email`? Anyone can type any address into their own
 * profile, so matching a paying buyer by it could hand their purchase to a
 * stranger's account. The sign-in email can only change after the owner clicks
 * a confirmation link, so it is the one we trust.
 *
 * Supabase has no "get user by email" admin call, so this pages through the
 * user list. Capped so a huge user base can't make a webhook time out; a miss
 * past the cap returns null and the caller decides what to do.
 */
export async function findAuthUserByEmail(
  admin: SupabaseClient,
  email: string,
  opts: { perPage?: number; maxPages?: number } = {},
): Promise<User | null> {
  const target = email.trim().toLowerCase()
  if (!target) return null
  const perPage = opts.perPage ?? 1000
  const maxPages = opts.maxPages ?? 50

  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`auth user lookup failed: ${error.message}`)
    const users = data?.users ?? []
    const hit = users.find(u => (u.email ?? '').toLowerCase() === target)
    if (hit) return hit
    if (users.length < perPage) return null // last page
  }
  return null
}

/** True when the owner has proven they control the sign-in email. */
export function isEmailConfirmed(user: Pick<User, 'email_confirmed_at'>): boolean {
  return !!user.email_confirmed_at
}
