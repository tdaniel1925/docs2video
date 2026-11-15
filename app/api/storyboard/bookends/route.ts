import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { filmEngineFor } from '../../../_lib/film-engine'
import { bookendPlans, storyboardContext, type BookendChoices } from '../../../_lib/storyboard-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/*
 * STEP 7 — the opening and the closing as they will look (storyboard-server.ts bookendPlans).
 *   POST { videoId, choices? }   choices = the photo placement / contact-on-closing being tried in the editor,
 *                                not saved yet. Returns each one's list of what is on it, and (film engine on)
 *                                its one-scene film plan, which the page draws in the browser ($0, no render).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { videoId?: string; choices?: BookendChoices }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  const admin = createAdminClient()
  const { data: row } = await admin.from('videos').select('id, draft_data').eq('id', String(body.videoId || '')).eq('user_id', user.id).maybeSingle()
  if (!row) return NextResponse.json({ error: 'We couldn’t find that project.' }, { status: 404 })
  const draft = (row.draft_data ?? {}) as Record<string, unknown>
  const c = body.choices && typeof body.choices === 'object' ? body.choices : {}
  const choices: BookendChoices = {
    ...(['auto', 'cover', 'closing', 'both', 'none'].includes(String(c.photoPlacement)) ? { photoPlacement: String(c.photoPlacement) } : {}),
    ...(typeof c.showContactClosing === 'boolean' ? { showContactClosing: c.showContactClosing } : {}),
  }
  const ctx = await storyboardContext(admin, user.id, draft)
  const b = bookendPlans(ctx, draft, choices)
  const film = await filmEngineFor(user.id)
  return NextResponse.json({
    cover: { elements: b.cover.elements, plan: film ? b.cover.plan : null },
    closing: { elements: b.closing.elements, plan: film ? b.closing.plan : null },
  })
}
