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
    .select('id, user_id, status, progress_pct, video_url, thumbnail_url, slide_urls, error_message, created_at, output_type, title, draft_data')
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
    scripting: 'processing',
    generating_slides: 'processing',
    generating_audio: 'processing',
    assembling: 'processing',
    rendering: 'processing',
    completed: 'completed',
    failed: 'failed',
  }

  const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://docs2video.com').replace(/\/$/, '')
  const outputType = (data as { output_type?: string }).output_type || 'video'
  const isPresentation = outputType === 'interactive' || outputType === 'deck'
  // An API-generated .pptx deck (create_deck) is also output_type 'deck' but its
  // deliverable is a real downloadable file in video_url — NOT a share page. Tell
  // the two apart by draft_data.kind so we surface the download link.
  const draft = (data as { draft_data?: { kind?: string; source?: string } }).draft_data || {}
  const isApiPptxDeck = draft.kind === 'deck' && draft.source === 'api'

  return NextResponse.json({
    id: data.id,
    status: statusMap[data.status] || data.status,
    output_type: outputType,
    title: (data as { title?: string | null }).title ?? null,
    progress_pct: data.progress_pct ?? 0,
    // For presentations video_url holds the raw HTML artifact — the client-
    // facing deliverable is the share page. For an API .pptx deck it IS the download.
    video_url: (isPresentation && !isApiPptxDeck) ? null : (data.video_url ?? null),
    // Explicit download link for API .pptx decks (create_deck → check_deck reads this).
    download_url: isApiPptxDeck && data.status === 'completed' ? (data.video_url ?? null) : undefined,
    share_url: (data.status === 'completed' && !isApiPptxDeck) ? `${BASE_URL}/watch/${data.id}` : null,
    deck_pdf_url: outputType === 'interactive' && data.status === 'completed' ? `${BASE_URL}/api/public/deck-pdf/${data.id}` : null,
    thumbnail_url: data.thumbnail_url ?? null,
    slide_urls: data.slide_urls ?? null,
    error: data.error_message ?? null,
    created_at: data.created_at,
  })
}
