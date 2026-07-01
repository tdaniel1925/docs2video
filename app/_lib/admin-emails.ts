/**
 * CLIENT-SAFE admin email check — no server-only imports. Split out of
 * admin.ts because requireAdmin() there pulls in supabase/server
 * (next/headers), which cannot enter a 'use client' bundle; the two admin
 * dashboard pages that check the email list import from HERE instead.
 * Note: this is a UX convenience only — real authorization happens
 * server-side via requireAdmin()/isAdminRequest() on every admin API route.
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
