import { redirect } from 'next/navigation'
import { createClient } from '../_lib/supabase/server'
import { createAdminClient } from '../_lib/supabase/admin'
import Header from '../_components/Header'
import HelpChatWidget from '../_components/HelpChatWidget'
import ImpersonationBanner from '../_components/ImpersonationBanner'
import type { Profile } from '../_lib/types'
import { getBrand } from '../_lib/brand-server'
import { CREDIT_COSTS } from '../_lib/credits'
import { ThemeSync } from '../_components/theme'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Use admin client to bypass RLS for profile lookup/creation
  const admin = createAdminClient()

  let { data: profile } = await admin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Auto-create profile if trigger didn't fire
  if (!profile) {
    const { data: newProfile } = await admin
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email!,
        full_name: user.user_metadata?.full_name ?? null,
      })
      .select()
      .single()

    profile = newProfile
  }

  if (!profile) {
    await supabase.auth.signOut()
    redirect('/login')
  }

  // Which storefront the visitor came in through decides the header's name and
  // nav. On docs2video.com getBrand() returns the Docs2Video brand, which is
  // Header's default — so nothing changes there.
  const brand = await getBrand()

  // LIGHT START (2026-10, light-start.ts): new people are NOT sent through the
  // setup wizard any more. It used to stand between signup and Home (and sent
  // anyone without a card to the card page first), so nobody saw what the app
  // makes before giving a card and filling in five pages. Their brand is now
  // added inside the first project (step 3, "Add your brand"), and the voice
  // and look are picked there too. The wizard is still at /setup for anyone
  // who wants it (Settings → "Re-run Setup Wizard").

  return (
    // .app-themed: the screens that follow the light/dark choice (Docs2Video
    // only — Text2Art keeps its own look). Pages not ready for dark carry
    // <LightOnly /> (globals.css, "DARK MODE").
    <div className={brand.id === 'docs2video' ? 'app-themed' : undefined} style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)' }}>
      {brand.id === 'docs2video' && <ThemeSync />}
      <ImpersonationBanner />
      {/* The credit chip turns amber below one standard video's worth. */}
      <Header profile={profile as Profile} brand={brand} lowCreditsAt={CREDIT_COSTS.videoStandard} />
      <main className="container" style={{ paddingTop: 40, paddingBottom: 40 }}>
        {children}
      </main>
      <HelpChatWidget />
    </div>
  )
}
