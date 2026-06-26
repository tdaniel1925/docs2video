import { NextResponse } from 'next/server'
import { createClient } from '../../../../_lib/supabase/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'
import { listSelectablePages, selectPage, type ZernioPlatform } from '../../../../_lib/zernio'

export const runtime = 'nodejs'
export const maxDuration = 60

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://docs2video.com').replace(/\/$/, '')

/**
 * Headless connect CALLBACK. The user returns here from Zernio's OAuth with
 * { profileId, tempToken, userProfile (url-encoded JSON), step, platform }.
 * We finalize by auto-selecting the (single) available page/account, then
 * redirect back to Settings. If a platform offers multiple pages we pick the
 * first — a future enhancement can show a picker.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const platform = url.searchParams.get('platform') as ZernioPlatform | null
  const profileId = url.searchParams.get('profileId')
  const tempToken = url.searchParams.get('tempToken')
  const userProfileRaw = url.searchParams.get('userProfile')

  const back = (status: string) => NextResponse.redirect(`${SITE}/settings?tab=social&connect=${status}`)

  // Must be the signed-in user (defense-in-depth; the profile is theirs).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${SITE}/login`)

  if (!platform || !profileId || !tempToken) return back('error')

  // Confirm this profile belongs to the signed-in user.
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('zernio_profile_id').eq('id', user.id).single()
  if (profile?.zernio_profile_id !== profileId) return back('error')

  let userProfile: unknown = {}
  try { userProfile = userProfileRaw ? JSON.parse(decodeURIComponent(userProfileRaw)) : {} } catch { /* leave {} */ }

  try {
    const pages = await listSelectablePages({ platform, profileId, tempToken })
    const first = pages[0]
    const pageId = first?.id || first?.pageId || first?.page_id
    if (!pageId) return back('nopages')

    await selectPage({
      platform, profileId, pageId, tempToken, userProfile,
      redirectUrl: `${SITE}/settings?tab=social&connect=done`,
    })
    return back('done')
  } catch (err) {
    console.error('[social/callback] finalize failed:', err)
    return back('error')
  }
}
