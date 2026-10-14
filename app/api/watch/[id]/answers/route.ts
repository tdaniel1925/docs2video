import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'
import { publicAnswers, type QuestionRow } from '../../../../_lib/client-questions'
import { isMissingSchema } from '../../../../_lib/feature-tables'

export const runtime = 'nodejs'

/**
 * GET /api/watch/{videoId}/answers — public. The answers the agent APPROVED
 * for this video, shown under the video on the share page.
 *
 * Its own request (not part of /api/public/watch) on purpose: if the
 * questions table hasn't been made yet, this returns an empty list and the
 * share page is untouched — never a 404 for the whole page.
 *
 * Only approved + published rows are read, and publicAnswers() filters again:
 * an AI draft the agent hasn't approved can never reach this page, and who
 * asked is never sent.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id || '')) return NextResponse.json({ answers: [] })
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('client_questions')
    .select('id, question, status, published, final_answer, answered_at, ai_draft, ai_citations')
    .eq('video_id', id)
    .eq('status', 'approved')
    .eq('published', true)
    .order('answered_at', { ascending: false })
    .limit(20)
  if (error) {
    if (!isMissingSchema(error)) console.error('[watch/answers] read failed:', error.message)
    return NextResponse.json({ answers: [] })
  }
  return NextResponse.json(
    { answers: publicAnswers((data ?? []) as QuestionRow[]) },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
