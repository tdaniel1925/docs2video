/**
 * Admin email list — these users have full admin access and no limits.
 */
export const ADMIN_EMAILS = [
  'trenttdaniel@gmail.com',
  'tdaniel@botmakers.ai',
  'phil@valorfs.com',
  'darrell.wolfe@3mark.com',
  'Johnathon.Bunch@3mark.com',
]

export function isAdmin(email: string | null | undefined): boolean {
  return ADMIN_EMAILS.includes(email ?? '')
}
