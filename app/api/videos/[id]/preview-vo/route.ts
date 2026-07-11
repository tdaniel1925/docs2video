import { NextResponse } from 'next/server'
import { createClient } from '../../../../_lib/supabase/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * Poll target for the Fix-a-Scene preview: returns the scene_preview_url the VPS
 * writes when a preview voiceover clip is ready. Client polls this after asking
 * for a preview. Best-effort — returns { url: null } if not ready / column absent.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ url: null }, { status: 401 })
  const admin = createAdminClient()
  try {
    const { data } = await admin.from('videos').select('scene_preview_url').eq('id', id).eq('user_id', user.id).single()
    return NextResponse.json({ url: (data as any)?.scene_preview_url ?? null })
  } catch {
    return NextResponse.json({ url: null })
  }
}
