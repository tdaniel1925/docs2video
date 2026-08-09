import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'

// =============================================================================
// A permanent address for a saved design.
//
// The files sit in a private bucket, so the only way to show one is a signed
// link — and a signed link expires. Storing one in the library would leave the
// thumbnail working for a while and then quietly breaking, which is the worst
// kind of bug: nobody notices until the customer does.
//
// So the library stores THIS address instead. It never expires, it checks the
// design is yours, and it mints a fresh signed link on the spot.
// =============================================================================

export const runtime = 'nodejs'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const admin = createAdminClient()
  const { data: design } = await admin
    .from('flyer_designs')
    .select('image_path, user_id')
    .eq('id', id)
    .maybeSingle()

  // Same answer for "does not exist" and "not yours" — otherwise this endpoint
  // reports whether a given id is a real design.
  if (!design || design.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data, error } = await admin.storage
    .from('creation-assets')
    .createSignedUrl(design.image_path, 300)
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'File unavailable' }, { status: 404 })
  }
  return NextResponse.redirect(data.signedUrl)
}
