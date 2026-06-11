import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { verifyCronAuth } from '../../../_lib/cron-auth'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * Cron job: deletes expired draft videos.
 * Removes all video records where status='draft' and draft_expires_at < now().
 *
 * Runs daily at 4 AM UTC via Vercel Cron.
 * GET /api/cron/cleanup-drafts
 */
export async function GET(request: Request) {
  // Verify cron secret — required in production
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: expiredDrafts, error: fetchError } = await admin
    .from('videos')
    .select('id')
    .eq('status', 'draft')
    .lt('draft_expires_at', now)

  if (fetchError) {
    console.error('[cleanup-drafts] Failed to fetch expired drafts:', fetchError)
    return NextResponse.json({ error: 'Failed to fetch expired drafts' }, { status: 500 })
  }

  if (!expiredDrafts || expiredDrafts.length === 0) {
    console.log('[cleanup-drafts] No expired drafts found')
    return NextResponse.json({ deleted: 0 })
  }

  const ids = expiredDrafts.map((d) => d.id)

  const { error: deleteError } = await admin
    .from('videos')
    .delete()
    .in('id', ids)

  if (deleteError) {
    console.error('[cleanup-drafts] Failed to delete expired drafts:', deleteError)
    return NextResponse.json({ error: 'Failed to delete expired drafts' }, { status: 500 })
  }

  console.log(`[cleanup-drafts] Cleaned up ${ids.length} expired draft(s)`)
  return NextResponse.json({ deleted: ids.length })
}
