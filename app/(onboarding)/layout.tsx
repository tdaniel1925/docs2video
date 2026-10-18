import { redirect } from 'next/navigation'
import { Archivo, DM_Sans } from 'next/font/google'
import { createClient } from '../_lib/supabase/server'
import { getBrand } from '../_lib/brand-server'
import { ThemeSync } from '../_components/theme'
import '../d2v-app.css'

/* The redesign's two faces, as in the dashboard layout (2026-10-18). */
const d2vDisplay = Archivo({ subsets: ['latin'], variable: '--d2v-display', display: 'swap' })
const d2vBody = DM_Sans({ subsets: ['latin'], variable: '--d2v-body', display: 'swap' })

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

  // Same navy-and-blue skin and light/dark choice as the rest of the signed-in
  // app (the redesign, 2026-10-18), so setup no longer looks like an older app.
  return (
    <div
      className={brand.id === 'docs2video' ? `app-themed d2v-app ${d2vDisplay.variable} ${d2vBody.variable}` : undefined}
      style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      {brand.id === 'docs2video' && <ThemeSync />}
      <div style={{ width: '100%', maxWidth: 640 }}>{children}</div>
    </div>
  )
}
