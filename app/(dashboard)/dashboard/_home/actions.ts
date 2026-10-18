'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'

/** "Got it" on "Finished while you were away": mark those "ready" notices
 *  read (the same flag the bell uses), so the list clears. Only the user's own. */
export async function dismissFinished(videoIds: string[]): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !Array.isArray(videoIds) || videoIds.length === 0) return
  await createAdminClient().from('notifications').update({ read: true })
    .eq('user_id', user.id).eq('type', 'video_ready')
    .in('link', videoIds.slice(0, 20).map((id) => `/videos/${id}`))
  revalidatePath('/dashboard')
}

/** Delete one of the signed-in user's drafts. Only ever touches a row that is
 *  theirs AND still a draft — a finished project can't be removed from here. */
export async function discardDraft(videoId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !videoId) return
  await createAdminClient().from('videos').delete()
    .eq('id', videoId).eq('user_id', user.id).eq('status', 'draft')
  revalidatePath('/dashboard')
}
