import { createAdminClient } from './supabase/admin'

/**
 * If a job was created via the public API with a webhook_url, POST the final
 * job payload to it once on completion/failure. Best-effort: never throws,
 * never blocks the caller's own response on a slow external endpoint.
 *
 * Reads the webhook URL from videos.draft_data.apiWebhookUrl (set by
 * POST /api/v1/videos). No-op for non-API jobs.
 */
export async function fireApiWebhook(videoId: string): Promise<void> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('videos')
      .select('id, status, progress_pct, video_url, thumbnail_url, slide_urls, error_message, created_at, draft_data')
      .eq('id', videoId)
      .single()
    if (!data) return

    const url = (data.draft_data as any)?.apiWebhookUrl as string | undefined
    if (!url) return

    const statusMap: Record<string, string> = {
      completed: 'completed',
      failed: 'failed',
    }
    const payload = {
      id: data.id,
      status: statusMap[data.status] || data.status,
      progress_pct: data.progress_pct ?? 0,
      video_url: data.video_url ?? null,
      thumbnail_url: data.thumbnail_url ?? null,
      slide_urls: data.slide_urls ?? null,
      error: data.error_message ?? null,
      created_at: data.created_at,
    }

    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'docs2video-webhook/1' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    }).catch((e) => console.error(`[api-webhook] callback to ${url} failed:`, e))
  } catch (e) {
    console.error(`[api-webhook] error for video ${videoId}:`, e)
  }
}
