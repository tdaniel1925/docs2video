import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'
import { authenticateApiKey } from '../../../../_lib/api-auth'

export const runtime = 'nodejs'

/**
 * GET /api/v1/videos/{job_id}
 * Public-safe job status. Ownership is checked against the API key's owner.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await authenticateApiKey(request)
  if (!caller) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
  }

  const { id } = await params
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('videos')
    .select('id, user_id, status, progress_pct, video_url, thumbnail_url, slide_urls, error_message, created_at')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }
  if (data.user_id !== caller.userId) {
    // Don't leak existence to other keys.
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // Map internal statuses to a stable public vocabulary.
  const statusMap: Record<string, string> = {
    draft: 'queued',
    queued: 'queued',
    processing: 'processing',
    rendering: 'processing',
    completed: 'completed',
    failed: 'failed',
  }

  return NextResponse.json({
    id: data.id,
    status: statusMap[data.status] || data.status,
    progress_pct: data.progress_pct ?? 0,
    video_url: data.video_url ?? null,
    thumbnail_url: data.thumbnail_url ?? null,
    slide_urls: data.slide_urls ?? null,
    error: data.error_message ?? null,
    created_at: data.created_at,
  })
}
