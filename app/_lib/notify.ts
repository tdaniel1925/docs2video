import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Send a notification to a user.
 * Call from any API route using the admin client.
 */
export async function sendNotification(
  admin: SupabaseClient,
  userId: string,
  opts: {
    type: string
    title: string
    message?: string
    link?: string
  }
) {
  await admin.from('notifications').insert({
    user_id: userId,
    type: opts.type,
    title: opts.title,
    message: opts.message ?? null,
    link: opts.link ?? null,
  })
}

/**
 * Create or update a job tracker.
 */
export async function createJob(
  admin: SupabaseClient,
  userId: string,
  opts: {
    type: string
    title: string
    metadata?: Record<string, unknown>
  }
): Promise<string | null> {
  const { data } = await admin.from('jobs').insert({
    user_id: userId,
    type: opts.type,
    title: opts.title,
    status: 'queued',
    progress: 0,
    metadata: opts.metadata ?? {},
  }).select('id').single()
  return data?.id ?? null
}

export async function updateJobProgress(
  admin: SupabaseClient,
  jobId: string,
  progress: number,
  status?: 'running' | 'completed' | 'failed',
  extras?: { result_url?: string; error_message?: string }
) {
  const update: Record<string, unknown> = { progress: Math.min(100, Math.max(0, progress)) }
  if (status) update.status = status
  if (status === 'completed') update.completed_at = new Date().toISOString()
  if (extras?.result_url) update.result_url = extras.result_url
  if (extras?.error_message) update.error_message = extras.error_message
  await admin.from('jobs').update(update).eq('id', jobId)
}
