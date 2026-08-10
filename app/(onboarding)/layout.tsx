import { redirect } from 'next/navigation'
import { createClient } from '../_lib/supabase/server'
import { getBrand } from '../_lib/brand-server'

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // The setup wizard is a VIDEO wizard — narrator voice, slide style, sample
  // narration. Signup pushes everyone here from the client, so this server gate
  // is the reliable place to keep a Text2Art customer out of it and send them
  // to the tool they actually signed up for. No-op on docs2video.com.
  const brand = await getBrand()
  if (!brand.showVideoFeatures) redirect(brand.home)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 640 }}>{children}</div>
    </div>
  )
}
