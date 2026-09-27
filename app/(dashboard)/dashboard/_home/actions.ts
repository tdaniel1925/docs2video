'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'

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
