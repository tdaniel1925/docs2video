import { redirect } from 'next/navigation'
import { createClient } from '../_lib/supabase/server'
import { createAdminClient } from '../_lib/supabase/admin'
import Header from '../_components/Header'
import HelpChatWidget from '../_components/HelpChatWidget'
import ImpersonationBanner from '../_components/ImpersonationBanner'
import type { Profile } from '../_lib/types'
import { getBrand } from '../_lib/brand-server'

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

  // Redirect to onboarding if not completed.
  //
  // The setup wizard is entirely about VIDEO — pick a narrator voice, pick a
  // slide style, hear a sample. Forcing a Text2Art customer through it would be
  // both confusing and a lie about what they bought, so brands without the
  // video product skip it and go straight to their tool. The flag stays false,
  // which is correct: if that same account ever signs in on docs2video.com it
  // still gets the setup it never did.
  if (brand.showVideoFeatures && !(profile as Profile).onboarding_completed) {
    redirect('/setup')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)' }}>
      <ImpersonationBanner />
      <Header profile={profile as Profile} brand={brand} />
      <main className="container" style={{ paddingTop: 40, paddingBottom: 40 }}>
        {children}
      </main>
      <HelpChatWidget />
    </div>
  )
}
