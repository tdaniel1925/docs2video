import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '../../../../_lib/supabase/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'
import type { WizardDraft } from '../../../../_lib/types'

export const runtime = 'nodejs'

/**
 * THE LAST-GASP SAVE, for a tab that is closing.
 *
 * WHY THIS EXISTS RATHER THAN REUSING PATCH. navigator.sendBeacon is the only
 * way to get a request out of a page the browser is tearing down — an
 * ordinary fetch in a beforeunload handler is killed mid-flight — and a
 * beacon can only ever be a POST. The draft route's POST already means
 * "create a draft", so this is its own address rather than a flag on that
 * one.
 *
 * IT IS A NET, NOT A SAVE PATH. The script editor saves properly as you
 * type, 800ms after you stop. This catches the case where the tab closes
 * inside that window. Nothing depends on it succeeding, and nothing can:
 * a beacon is fire-and-forget, with no way to read the response.
 *
 * WHICH IS EXACTLY WHY IT IS WRITTEN DEFENSIVELY. Nobody is watching this
 * run. It can never throw, it never creates a row, and it refuses anything
 * it does not fully recognise — the alternative is a silent path that
 * corrupts a draft on the way out of the door.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    /* No session: say nothing useful. Nobody reads this response, and a
       closing page is not a place to leak whether a video exists. */
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })

    const body = await request.json().catch(() => null) as
      | { videoId?: string; updates?: Partial<WizardDraft> }
      | null
    const videoId = body?.videoId
    const updates = body?.updates
    if (!videoId || !updates) return NextResponse.json({ ok: false }, { status: 400 })

    /*
     * ONLY `scenes`, AND ONLY AN ARRAY.
     *
     * The PATCH route merges whatever it is handed. That is right for a
     * deliberate save from a live page; it is wrong for an unattended one
     * that nobody can see fail. This accepts the single field the unload
     * handler sends and drops everything else, so a stray or malformed
     * beacon cannot quietly rewrite a draft.
     */
    const scenes = (updates as { scenes?: unknown }).scenes
    if (!Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const admin = createAdminClient()

    /* Ownership, same as PATCH. The service-role client bypasses row-level
       security, so this check IS the security on this route. */
    const { data: video, error } = await admin
      .from('videos')
      .select('id, user_id, draft_data')
      .eq('id', videoId)
      .single()
    if (error || !video) return NextResponse.json({ ok: false }, { status: 404 })
    if (video.user_id !== user.id) return NextResponse.json({ ok: false }, { status: 403 })

    const existing = (video.draft_data as WizardDraft) || { step: 1, outputType: 'video' as const }

    await admin
      .from('videos')
      .update({
        draft_data: { ...existing, scenes },
        /* Keep the draft alive for another day — somebody who just closed a
           tab mid-edit is the likeliest person to come back to it. */
        draft_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('id', videoId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    /* Never throw. A 500 from a page that no longer exists helps nobody, and
       an unhandled rejection here would be invisible. */
    console.error('[draft/beacon] failed:', err)
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
