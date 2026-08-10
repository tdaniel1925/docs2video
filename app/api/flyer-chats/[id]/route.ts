import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'

// =============================================================================
// Pin or delete a project chat.
//
// PATCH  { pinned: boolean }  — keep a job at the top of the sidebar
// DELETE                      — remove the chat, its rounds, its designs and
//                               the image files behind them
// =============================================================================

export const runtime = 'nodejs'

/** Both verbs need the same answer: is this chat yours? */
async function ownedChat(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) }
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  }

  const admin = createAdminClient()
  const { data: chat } = await admin
    .from('flyer_chats').select('id, user_id').eq('id', id).maybeSingle()

  // Same answer for "does not exist" and "not yours", so this cannot be used
  // to discover whether a given id is a real chat.
  if (!chat || chat.user_id !== user.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  }
  return { user, admin }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const owned = await ownedChat(id)
  if ('error' in owned) return owned.error

  const body = await req.json().catch(() => null) as { pinned?: boolean } | null
  if (typeof body?.pinned !== 'boolean') {
    return NextResponse.json({ error: 'pinned must be true or false' }, { status: 400 })
  }

  // Pinning must NOT bump updated_at — that would reorder the list every time
  // someone pinned something, which is the opposite of what pinning is for.
  const { error } = await owned.admin
    .from('flyer_chats').update({ pinned: body.pinned }).eq('id', id)
  if (error) {
    console.error('[flyer-chats] pin failed:', error.message)
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, pinned: body.pinned })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const owned = await ownedChat(id)
  if ('error' in owned) return owned.error
  const { admin, user } = owned

  // THE FILES FIRST, while the rows that name them still exist. Deleting the
  // chat first cascades the designs away and takes the storage paths with
  // them, leaving the images orphaned in the bucket forever with nothing left
  // pointing at them.
  const { data: rounds } = await admin.from('flyer_rounds').select('id').eq('chat_id', id)
  const roundIds = (rounds ?? []).map((r) => r.id)

  // COLLECT EVERYTHING BEFORE DELETING ANYTHING. The design rows carry both the
  // storage paths and the ids the library entries are keyed on, and they
  // cascade away with the chat — so asking for them afterwards returns nothing
  // and both the files and the library rows are stranded.
  let paths: string[] = []
  let designIds: string[] = []
  if (roundIds.length) {
    const { data: designs } = await admin
      .from('flyer_designs').select('id, image_path').in('round_id', roundIds)
    paths = (designs ?? []).map((d) => d.image_path).filter(Boolean)
    designIds = (designs ?? []).map((d) => d.id)
  }

  if (paths.length) {
    const { error: rmErr } = await admin.storage.from('creation-assets').remove(paths)
    // A failed file delete must not block the chat delete — the customer asked
    // for it gone, and a leftover file is our problem, not theirs.
    if (rmErr) console.error(`[flyer-chats] ${paths.length} file(s) left behind for chat ${id}:`, rmErr.message)
  }

  // The library listing is separate and does NOT cascade, so its entries would
  // survive as rows pointing at files that no longer exist.
  if (designIds.length) {
    const { error: libErr } = await admin.from('creations').delete()
      .eq('user_id', user.id).eq('type', 'flyer')
      .in('file_url', designIds.map((d) => `/api/flyer-file/${d}`))
    if (libErr) console.error('[flyer-chats] library tidy failed:', libErr.message)
  }

  // Rounds and designs cascade from the chat row.
  const { error } = await admin.from('flyer_chats').delete().eq('id', id)
  if (error) {
    console.error('[flyer-chats] delete failed:', error.message)
    return NextResponse.json({ error: 'Could not delete that.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, deletedDesigns: designIds.length })
}
