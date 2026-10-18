import { createClient } from '../../_lib/supabase/server'
import AccountShell from './AccountShell'

/**
 * Server half of the account area: reads whether this person has the AI
 * Social add-on today (the same profile flag the avatar menu reads), then
 * draws the menu around the page. Used by the layout.tsx of /settings,
 * /analytics and /affiliate.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  let hasSocial = false
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase.from('profiles').select('social_addon_active').eq('id', user.id).single()
      hasSocial = !!(data as { social_addon_active?: boolean } | null)?.social_addon_active
    }
  } catch { /* menu without AI Social */ }
  return <AccountShell hasSocial={hasSocial}>{children}</AccountShell>
}
