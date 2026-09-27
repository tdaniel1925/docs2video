import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import type { WizardDraft } from '../../../_lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isOwnedStoragePath, mergeDraft, mergeExtractedDocs } from '../../../_lib/wizard-draft'

export const runtime = 'nodejs'
export const maxDuration = 30

/** Statuses whose draft may still be edited: a draft, or a failed video about
 *  to be retried. Never one that is running or finished. */
const DRAFT_EDITABLE_STATUSES = ['draft', 'failed']

async function ownsBrand(admin: SupabaseClient, userId: string, brandId: string): Promise<boolean> {
  const { data } = await admin.from('brands').select('id').eq('id', brandId).eq('user_id', userId).maybeSingle()
  return !!data
}
async function ownsClient(admin: SupabaseClient, userId: string, clientId: string): Promise<boolean> {
  const { data } = await admin.from('clients').select('id').eq('id', clientId).eq('user_id', userId).maybeSingle()
  return !!data
}

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

  let body: { outputType?: string; purpose?: string; extractedData?: Record<string, unknown>; contentMethod?: string; autoBrandInfo?: Record<string, unknown>; classification?: Record<string, unknown>; recipientName?: string; clientId?: string; extractedDocs?: WizardDraft['extractedDocs']; combineInstruction?: string; sourcePdfPath?: string; sourcePdfName?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { outputType, purpose, extractedData, contentMethod, autoBrandInfo, classification, recipientName, clientId, extractedDocs, combineInstruction, sourcePdfPath, sourcePdfName } = body
  if (!outputType || !['video', 'pptx', 'pdf', 'interactive', 'deck'].includes(outputType)) {
    return NextResponse.json({ error: 'outputType must be video, pptx, pdf, interactive, or deck' }, { status: 400 })
  }
  if (clientId && !(await ownsClient(createAdminClient(), user.id, clientId))) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // Multi-file: fold EVERY file into extractedData (H7) — it used to be a copy
  // of file #1 only, so the other files were charged for and never used.
  const merged = extractedDocs && extractedDocs.length > 1 ? mergeExtractedDocs(extractedDocs) : null

  const draftData: WizardDraft = {
    step: 1,
    outputType: outputType as WizardDraft['outputType'],
    purpose,
    contentMethod: contentMethod as WizardDraft['contentMethod'],
    extractedData: merged || extractedData || undefined,
    ...(extractedDocs && extractedDocs.length ? { extractedDocs } : {}),
    ...(combineInstruction ? { combineInstruction } : {}),
    ...(classification ? { classification } : {}),
    ...(recipientName ? { recipientName } : {}),
    ...(clientId ? { clientId } : {}),
    // The uploaded source PDF (H6) — it was dropped here, so a brand-new draft
    // could never offer the "download the original PDF" option. Only a path
    // inside this user's own storage folder is accepted.
    ...(isOwnedStoragePath(sourcePdfPath, user.id)
      ? { sourcePdfPath, sourcePdfName: typeof sourcePdfName === 'string' ? sourcePdfName.slice(0, 200) : undefined }
      : {}),
  }

  // Store auto-detected brand info for the brand step
  if (autoBrandInfo) {
    draftData.inlineBrand = {
      name: (autoBrandInfo.name as string) || '',
      primaryColor: (autoBrandInfo.primary_color as string) || undefined,
    }
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
      ...(clientId ? { client_id: clientId } : {}),
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

  if (typeof updates !== 'object' || Array.isArray(updates)) {
    return NextResponse.json({ error: 'updates must be an object' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Ownership check
  const { data: video, error: fetchError } = await admin
    .from('videos')
    .select('id, user_id, status, draft_data')
    .eq('id', videoId)
    .single()

  if (fetchError || !video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  if (video.user_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  // Only a video that is not running and not finished can have its draft
  // edited: a 'draft', or a 'failed' one the user is about to retry. Editing
  // the draft of a finished or in-progress video could swap its brand or
  // source after the fact.
  if (!DRAFT_EDITABLE_STATUSES.includes(String(video.status))) {
    return NextResponse.json({ error: 'This video has already been made and can’t be changed here.' }, { status: 409 })
  }

  // The brand and client must be the user's OWN (the admin client bypasses row
  // security, so this check IS the protection).
  const u = updates as Record<string, unknown>
  if (u.brandId && !(await ownsBrand(admin, user.id, String(u.brandId)))) {
    return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
  }
  if (u.clientId && !(await ownsClient(admin, user.id, String(u.clientId)))) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }
  // Source PDF: only a path inside this user's own storage folder (H6). null
  // clears it (the source is no longer a PDF).
  if ('sourcePdfPath' in u && u.sourcePdfPath !== null && !isOwnedStoragePath(u.sourcePdfPath, user.id)) {
    return NextResponse.json({ error: 'Invalid source file' }, { status: 400 })
  }
  if ('sourcePdfPath' in u && u.sourcePdfPath === null) {
    u.sourcePdfName = null
    u.allowSourceDownload = false
  }
  // Multi-file: every file feeds extractedData (H7). An empty list means the
  // project is back to a single source — drop the list so it isn't charged.
  if (Array.isArray(u.extractedDocs)) {
    if (u.extractedDocs.length > 1) {
      const merged = mergeExtractedDocs(u.extractedDocs as WizardDraft['extractedDocs'])
      if (merged) u.extractedData = merged
    } else {
      u.extractedDocs = null
    }
  }

  // Merge updates into existing draft_data. When the SOURCE changed (new
  // document, new text, new purpose), the old brief and script are dropped so
  // the next steps rebuild them — they used to go stale silently.
  const existingDraft = (video.draft_data as WizardDraft) || { step: 1, outputType: 'video' }
  const mergedDraft = mergeDraft(existingDraft as unknown as Record<string, unknown>, u) as unknown as WizardDraft

  const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  // Build update payload — also update video-level fields if provided
  const updatePayload: Record<string, unknown> = {
    draft_data: mergedDraft,
    draft_expires_at: newExpiresAt,
  }
  // brandId: null is a deliberate "no brand" (Skip) — clear the column too, so
  // a skipped auto-detected brand is never used later.
  if ('brandId' in u) updatePayload.brand_id = u.brandId || null
  if (updates.outputType) updatePayload.output_type = updates.outputType
  if (updates.detailLevel) updatePayload.detail_level = updates.detailLevel
  if (updates.clientId) updatePayload.client_id = updates.clientId

  const { error: updateError } = await admin
    .from('videos')
    .update(updatePayload)
    .eq('id', videoId)
    .in('status', DRAFT_EDITABLE_STATUSES)

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
