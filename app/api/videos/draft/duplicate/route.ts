import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '../../../../_lib/supabase/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'
import { isOwnedStoragePath } from '../../../../_lib/wizard-draft'
import { copyDraft, copyLandingUrl, hasContentToCopy } from './copy-draft'

export const runtime = 'nodejs'
export const maxDuration = 30

const SOURCE_BUCKET = 'creation-assets'

async function ownsBrand(admin: SupabaseClient, userId: string, brandId: string): Promise<boolean> {
  const { data } = await admin.from('brands').select('id').eq('id', brandId).eq('user_id', userId).maybeSingle()
  return !!data
}
async function ownsClient(admin: SupabaseClient, userId: string, clientId: string): Promise<boolean> {
  const { data } = await admin.from('clients').select('id').eq('id', clientId).eq('user_id', userId).maybeSingle()
  return !!data
}

/**
 * Give the copy its OWN copy of the uploaded source PDF. Sharing one file
 * would let the nightly clean-up of an abandoned copy delete the original's
 * PDF. If the copy fails, the new draft simply has no PDF to offer.
 */
async function copySourcePdf(admin: SupabaseClient, userId: string, path: unknown): Promise<string | null> {
  if (!isOwnedStoragePath(path, userId)) return null
  const to = `${userId}/doc-uploads/${crypto.randomUUID()}.pdf`
  const { error } = await admin.storage.from(SOURCE_BUCKET).copy(path, to)
  if (error) {
    console.warn('[draft/duplicate] source PDF not copied:', error.message)
    return null
  }
  return to
}

/**
 * POST /api/videos/draft/duplicate  { videoId }
 * Makes a new draft from one of the signed-in user's own projects and says
 * where to open it. See copy-draft.ts for what is and isn't copied.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: { videoId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const videoId = typeof body.videoId === 'string' ? body.videoId.trim() : ''
  if (!videoId) return NextResponse.json({ error: 'videoId is required' }, { status: 400 })

  const admin = createAdminClient()
  // select('*'): naming a column the live database doesn't have fails the
  // whole read, and this only needs what is there.
  const { data: source } = await admin
    .from('videos')
    .select('*')
    .eq('id', videoId)
    .eq('user_id', user.id) // owner only — someone else's id reads as "not found"
    .maybeSingle()
  if (!source) return NextResponse.json({ error: 'We couldn’t find that project.' }, { status: 404 })

  const draft = (source.draft_data || {}) as Record<string, unknown>
  if (!hasContentToCopy(draft)) {
    return NextResponse.json({
      error: 'This one wasn’t made from a document or a story, so there’s nothing to copy.',
    }, { status: 422 })
  }

  // The brand and client come along only while they are still the user's own.
  const rawBrand = 'brandId' in draft ? draft.brandId : (source.brand_id ?? undefined)
  let brandId: string | null | undefined
  if (rawBrand === null) brandId = null
  else if (typeof rawBrand === 'string' && rawBrand && await ownsBrand(admin, user.id, rawBrand)) brandId = rawBrand
  else brandId = undefined

  const rawClient = typeof draft.clientId === 'string' && draft.clientId ? draft.clientId : (source.client_id ?? undefined)
  const clientId = typeof rawClient === 'string' && rawClient && await ownsClient(admin, user.id, rawClient) ? rawClient : undefined

  const pdfFrom = draft.sourcePdfPath ?? source.source_pdf_path
  const pdfName = draft.sourcePdfName ?? source.source_pdf_name
  const pdfPath = await copySourcePdf(admin, user.id, pdfFrom)

  const copy = copyDraft({
    draft,
    outputType: source.output_type,
    rowDetailLevel: source.detail_level,
    brandId,
    clientId,
    pdf: pdfPath ? { path: pdfPath, name: typeof pdfName === 'string' ? pdfName : null } : null,
  })

  const { data: created, error } = await admin
    .from('videos')
    .insert({
      user_id: user.id,
      status: 'draft',
      output_type: copy.outputType,
      draft_data: copy.draftData,
      draft_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      ...(copy.detailLevel ? { detail_level: copy.detailLevel } : {}),
      ...(typeof brandId === 'string' ? { brand_id: brandId } : {}),
      ...(clientId ? { client_id: clientId } : {}),
    })
    .select('id')
    .single()

  if (error || !created) {
    console.error('[draft/duplicate] Failed to create the copy:', error)
    if (pdfPath) await admin.storage.from(SOURCE_BUCKET).remove([pdfPath]).catch(() => {})
    return NextResponse.json({ error: 'We couldn’t copy that project just now.' }, { status: 500 })
  }

  return NextResponse.json({ videoId: created.id, next: copyLandingUrl(created.id) })
}
