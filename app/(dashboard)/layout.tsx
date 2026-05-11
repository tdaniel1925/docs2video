import { redirect } from 'next/navigation'
import { createClient } from '../_lib/supabase/server'
import { createAdminClient } from '../_lib/supabase/admin'
import Header from '../_components/Header'
import HelpChatWidget from '../_components/HelpChatWidget'
import type { Profile } from '../_lib/types'

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

  // Redirect to onboarding if not completed
  if (!(profile as Profile).onboarding_completed) {
    redirect('/setup')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)' }}>
      <Header profile={profile as Profile} />
      <main className="container" style={{ paddingTop: 40, paddingBottom: 40 }}>
        {children}
      </main>
      <HelpChatWidget />
    </div>
  )
}
