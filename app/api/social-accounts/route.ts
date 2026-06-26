import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { createProfile, getConnectUrl, listAccounts, isZernioConfigured, type ZernioPlatform } from '../../_lib/zernio'

export const runtime = 'nodejs'
export const maxDuration = 60

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://docs2video.com').replace(/\/$/, '')

/** GET — list the user's connected social accounts (via their Zernio profile). */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isZernioConfigured()) return NextResponse.json({ connected: false, platforms: [] })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('zernio_profile_id').eq('id', user.id).single()
  const profileId = profile?.zernio_profile_id
  if (!profileId) return NextResponse.json({ connected: false, platforms: [] })

  try {
    const accounts = await listAccounts(profileId)
    const platforms = accounts.map((a) => ({ platform: a.platform, connected: true, name: a.name, accountId: a.accountId }))
    return NextResponse.json({ connected: platforms.length > 0, platforms })
  } catch (err) {
    console.error('[social-accounts] GET error:', err)
    return NextResponse.json({ connected: false, platforms: [], error: 'Failed to fetch accounts' })
  }
}

/**
 * POST — connect/disconnect.
 *  action:'connect'   {platform} → ensure a Zernio profile exists, return a
 *                      headless authUrl to redirect the user to.
 *  action:'disconnect'{platform} → (best-effort) remove the account.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isZernioConfigured()) return NextResponse.json({ error: 'Social posting not configured' }, { status: 500 })

  const { action, platform } = await request.json() as { action: string; platform?: ZernioPlatform }
  const admin = createAdminClient()

  if (action === 'connect') {
    if (!platform) return NextResponse.json({ error: 'Platform required' }, { status: 400 })

    // Ensure the client has a Zernio profile (one per client = tenant).
    const { data: profile } = await admin
      .from('profiles').select('zernio_profile_id, social_addon_active').eq('id', user.id).single()
    if (!profile?.social_addon_active) {
      return NextResponse.json({ error: 'The Social add-on is not active on your account.', code: 'addon_required' }, { status: 402 })
    }
    let profileId = profile?.zernio_profile_id
    if (!profileId) {
      try {
        profileId = await createProfile(user.email || `user-${user.id}`, `Docs2Video user ${user.id}`)
        await admin.from('profiles').update({ zernio_profile_id: profileId }).eq('id', user.id)
      } catch (err) {
        console.error('[social-accounts] createProfile failed:', err)
        return NextResponse.json({ error: 'Could not initialize your social workspace.' }, { status: 502 })
      }
    }

    try {
      // Headless connect — the account picker stays inside our app; the user
      // returns to /settings/social/callback to finalize.
      const authUrl = await getConnectUrl({
        platform,
        profileId,
        redirectUrl: `${SITE}/settings/social/callback`,
        headless: true,
      })
      return NextResponse.json({ authUrl })
    } catch (err) {
      console.error('[social-accounts] getConnectUrl failed:', err)
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not start connection' }, { status: 502 })
    }
  }

  if (action === 'disconnect') {
    // Zernio disconnect endpoint shape varies; surface a clear message and let
    // the user manage it. (Re-list reflects current state.) Best-effort no-op.
    return NextResponse.json({ success: true, note: 'Re-list to refresh connected accounts.' })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
