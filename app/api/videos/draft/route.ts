import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import type { WizardDraft } from '../../../_lib/types'

export const runtime = 'nodejs'

/**
 * POST /api/videos/draft
 * Creates a new video record in draft status with 24h expiry.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: { outputType?: string; purpose?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { outputType, purpose } = body
  if (!outputType || !['video', 'pptx', 'pdf'].includes(outputType)) {
    return NextResponse.json({ error: 'outputType must be video, pptx, or pdf' }, { status: 400 })
  }

  const draftData: WizardDraft = {
    step: 1,
    outputType: outputType as 'video' | 'pptx' | 'pdf',
    purpose,
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('videos')
    .insert({
      user_id: user.id,
      status: 'draft',
      output_type: outputType,
      draft_data: draftData,
      draft_expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[draft] Failed to create draft:', error)
    return NextResponse.json({ error: 'Failed to create draft' }, { status: 500 })
  }

  return NextResponse.json({ videoId: data.id })
}

/**
 * PATCH /api/videos/draft
 * Merges updates into existing draft_data and resets expiry.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: { videoId?: string; updates?: Partial<WizardDraft> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { videoId, updates } = body
  if (!videoId || !updates) {
    return NextResponse.json({ error: 'videoId and updates are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Ownership check
  const { data: video, error: fetchError } = await admin
    .from('videos')
    .select('id, user_id, draft_data')
    .eq('id', videoId)
    .single()

  if (fetchError || !video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  if (video.user_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  // Merge updates into existing draft_data
  const existingDraft = (video.draft_data as WizardDraft) || { step: 1, outputType: 'video' }
  const mergedDraft: WizardDraft = { ...existingDraft, ...updates }

  const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { error: updateError } = await admin
    .from('videos')
    .update({
      draft_data: mergedDraft,
      draft_expires_at: newExpiresAt,
    })
    .eq('id', videoId)

  if (updateError) {
    console.error('[draft] Failed to update draft:', updateError)
    return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

/**
 * GET /api/videos/draft?videoId=xxx
 * Loads a draft for resuming the wizard.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const videoId = request.nextUrl.searchParams.get('videoId')
  if (!videoId) {
    return NextResponse.json({ error: 'videoId query parameter is required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: video, error } = await admin
    .from('videos')
    .select('*')
    .eq('id', videoId)
    .single()

  if (error || !video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  if (video.user_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  return NextResponse.json(video)
}

/**
 * DELETE /api/videos/draft?videoId=xxx
 * Discards a draft by deleting the video record.
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const videoId = request.nextUrl.searchParams.get('videoId')
  if (!videoId) {
    return NextResponse.json({ error: 'videoId query parameter is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Ownership check
  const { data: video, error: fetchError } = await admin
    .from('videos')
    .select('id, user_id, status')
    .eq('id', videoId)
    .single()

  if (fetchError || !video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  if (video.user_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  if (video.status !== 'draft') {
    return NextResponse.json({ error: 'Only drafts can be discarded' }, { status: 400 })
  }

  const { error: deleteError } = await admin
    .from('videos')
    .delete()
    .eq('id', videoId)

  if (deleteError) {
    console.error('[draft] Failed to delete draft:', deleteError)
    return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
