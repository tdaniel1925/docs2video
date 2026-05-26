import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'

export const runtime = 'nodejs'

const AYRSHARE_API_KEY = process.env.AYRSHARE_API_KEY

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()

  // Try to get per-user profile key
  let profileKey: string | null = null
  try {
    const { data: profile } = await admin
      .from('profiles')
      .select('ayrshare_profile_key')
      .eq('id', user.id)
      .single()
    profileKey = profile?.ayrshare_profile_key ?? null
  } catch {
    // Column may not exist yet (migration not run) — continue with global fallback
  }

  // If user has their own profile key, check that profile
  if (profileKey) {
    try {
      const res = await fetch(`https://app.ayrshare.com/api/profiles/${profileKey}`, {
        headers: { 'Authorization': `Bearer ${AYRSHARE_API_KEY}` },
      })
      const data = await res.json()

      if (data.status === 'error') {
        return NextResponse.json({ connected: true, profileKey, platforms: [], error: data.message })
      }

      const platforms = (data.activeSocialAccounts || []).map((p: string) => ({
        platform: p,
        connected: true,
      }))

      return NextResponse.json({ connected: true, profileKey, platforms, mode: 'user' })
    } catch (err) {
      console.error('[social-accounts] GET profile error:', err)
    }
  }

  // Fallback: check the global Ayrshare account
  if (!AYRSHARE_API_KEY) {
    return NextResponse.json({ connected: false, platforms: [] })
  }

  try {
    const res = await fetch('https://app.ayrshare.com/api/user', {
      headers: { 'Authorization': `Bearer ${AYRSHARE_API_KEY}` },
    })
    const data = await res.json()

    if (data.status === 'error') {
      return NextResponse.json({ connected: false, platforms: [], error: data.message })
    }

    const platforms = (data.activeSocialAccounts || []).map((p: string) => ({
      platform: p,
      connected: true,
    }))

    if (platforms.length > 0) {
      return NextResponse.json({ connected: true, platforms, mode: 'global' })
    }

    return NextResponse.json({ connected: false, platforms: [] })
  } catch (err) {
    console.error('[social-accounts] GET global error:', err)
    return NextResponse.json({ connected: false, platforms: [], error: 'Failed to fetch accounts' })
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  if (!AYRSHARE_API_KEY) {
    return NextResponse.json({ error: 'Social sharing not configured' }, { status: 500 })
  }

  const { action, platform } = await request.json() as { action: string; platform?: string }
  const admin = createAdminClient()

  // Create Ayrshare profile for user
  if (action === 'create-profile') {
    // Check if already has one
    const { data: existing } = await admin
      .from('profiles')
      .select('ayrshare_profile_key')
      .eq('id', user.id)
      .single()

    if (existing?.ayrshare_profile_key) {
      return NextResponse.json({ profileKey: existing.ayrshare_profile_key, alreadyExists: true })
    }

    try {
      const res = await fetch('https://app.ayrshare.com/api/profiles/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AYRSHARE_API_KEY}`,
        },
        body: JSON.stringify({ title: user.email }),
      })
      const data = await res.json()

      if (data.status === 'error') {
        return NextResponse.json({ error: data.message || 'Failed to create profile' }, { status: 500 })
      }

      const profileKey = data.profileKey
      if (!profileKey) {
        return NextResponse.json({ error: 'No profile key returned' }, { status: 500 })
      }

      await admin.from('profiles').update({ ayrshare_profile_key: profileKey }).eq('id', user.id)

      return NextResponse.json({ profileKey, created: true })
    } catch (err) {
      console.error('[social-accounts] create-profile error:', err)
      return NextResponse.json({ error: 'Failed to create Ayrshare profile' }, { status: 500 })
    }
  }

  // Disconnect a platform
  if (action === 'disconnect') {
    if (!platform) {
      return NextResponse.json({ error: 'Platform required' }, { status: 400 })
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('ayrshare_profile_key')
      .eq('id', user.id)
      .single()

    const profileKey = profile?.ayrshare_profile_key
    if (!profileKey) {
      return NextResponse.json({ error: 'No Ayrshare profile' }, { status: 400 })
    }

    try {
      const res = await fetch('https://app.ayrshare.com/api/profiles/social', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AYRSHARE_API_KEY}`,
        },
        body: JSON.stringify({ profileKey, platform }),
      })
      const data = await res.json()

      if (data.status === 'error') {
        return NextResponse.json({ error: data.message || 'Failed to disconnect' }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    } catch (err) {
      console.error('[social-accounts] disconnect error:', err)
      return NextResponse.json({ error: 'Failed to disconnect platform' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
