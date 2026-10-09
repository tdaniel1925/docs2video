import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { verifyCronAuth } from '../../../_lib/cron-auth'
import { recordCronRun } from '../../../_lib/cron-heartbeat'
import { isOwnedStoragePath } from '../../../_lib/wizard-draft'

export const runtime = 'nodejs'
export const maxDuration = 30

/** A draft with a written script is real work. It is kept for this long after
 *  it was last touched, instead of the 24 hours a bare draft gets. */
const SCRIPTED_DRAFT_KEEP_DAYS = 14

const SOURCE_BUCKET = 'creation-assets'

/**
 * Cron job: deletes expired draft videos.
 * Removes video records where status='draft' and draft_expires_at < now().
 *
 * DRAFTS WITH A SCRIPT ARE KEPT LONGER. Every draft used to vanish 24 hours
 * after its last edit — including ones with a finished, hand-edited script,
 * with no warning. Of the two fixes (warn by email first, or keep them longer)
 * keeping them is the safer and simpler one: nothing to send, nothing to miss,
 * and a script is never lost to a weekend away. A draft with scenes now lives
 * SCRIPTED_DRAFT_KEEP_DAYS days past its last edit; a bare draft still goes
 * after a day.
 *
 * The uploaded source PDFs of deleted drafts are removed too — they are kept
 * after reading so the client can download the original (H6), and would
 * otherwise pile up for drafts nobody finished.
 *
 * Runs daily at 4 AM UTC via Vercel Cron.
 * GET /api/cron/cleanup-drafts
 */
export async function GET(request: Request) {
  // Verify cron secret — required in production
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Heartbeat: the health cron emails Trent if this stops running (audit 2026-10-09).
  await recordCronRun('cleanup-drafts')

  const admin = createAdminClient()
  const nowMs = Date.now()
  const now = new Date(nowMs).toISOString()

  const { data: expiredDrafts, error: fetchError } = await admin
    .from('videos')
    .select('id, user_id, draft_data, draft_expires_at')
    .eq('status', 'draft')
    .lt('draft_expires_at', now)
    .limit(500)

  if (fetchError) {
    console.error('[cleanup-drafts] Failed to fetch expired drafts:', fetchError)
    return NextResponse.json({ error: 'Failed to fetch expired drafts' }, { status: 500 })
  }

  if (!expiredDrafts || expiredDrafts.length === 0) {
    console.log('[cleanup-drafts] No expired drafts found')
    return NextResponse.json({ deleted: 0, kept: 0 })
  }

  // draft_expires_at = last edit + 24h, so "last edit within N days" is
  // "expired less than N-1 days ago".
  const keepCutoffMs = nowMs - (SCRIPTED_DRAFT_KEEP_DAYS - 1) * 24 * 60 * 60 * 1000
  const toDelete: typeof expiredDrafts = []
  let kept = 0
  for (const d of expiredDrafts) {
    const dd = (d.draft_data || {}) as Record<string, unknown>
    const hasScript = Array.isArray(dd.scenes) && dd.scenes.length > 0
    const expiredMs = d.draft_expires_at ? new Date(d.draft_expires_at).getTime() : 0
    if (hasScript && expiredMs > keepCutoffMs) { kept++; continue }
    toDelete.push(d)
  }

  if (toDelete.length === 0) {
    return NextResponse.json({ deleted: 0, kept })
  }

  const ids = toDelete.map((d) => d.id)

  const { error: deleteError } = await admin
    .from('videos')
    .delete()
    .in('id', ids)
    .eq('status', 'draft')

  if (deleteError) {
    console.error('[cleanup-drafts] Failed to delete expired drafts:', deleteError)
    return NextResponse.json({ error: 'Failed to delete expired drafts' }, { status: 500 })
  }

  // Remove their kept source PDFs — only files inside each owner's own folder.
  const pdfs = new Set<string>()
  for (const d of toDelete) {
    type Doc = { data?: { _sourcePdfPath?: unknown } } | null
    const dd = (d.draft_data || {}) as { sourcePdfPath?: unknown; extractedData?: { _sourcePdfPath?: unknown }; extractedDocs?: unknown }
    const candidates = [
      dd.sourcePdfPath,
      dd.extractedData?._sourcePdfPath,
      ...(Array.isArray(dd.extractedDocs) ? (dd.extractedDocs as Doc[]).map((x) => x?.data?._sourcePdfPath) : []),
    ]
    for (const p of candidates) if (isOwnedStoragePath(p, d.user_id)) pdfs.add(p)
  }
  if (pdfs.size) {
    const { error: rmErr } = await admin.storage.from(SOURCE_BUCKET).remove([...pdfs])
    if (rmErr) console.warn('[cleanup-drafts] source PDF cleanup failed:', rmErr.message)
  }

  console.log(`[cleanup-drafts] Cleaned up ${ids.length} expired draft(s), kept ${kept} with a script, removed ${pdfs.size} source PDF(s)`)
  return NextResponse.json({ deleted: ids.length, kept, sourcePdfsRemoved: pdfs.size })
}
