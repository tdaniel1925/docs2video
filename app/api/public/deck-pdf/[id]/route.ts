import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'
import { buildDeckPdf } from '../../../../_lib/presentation-exports'
import type { PresentationScene } from '../../../../_lib/presentation'

export const runtime = 'nodejs'
export const maxDuration = 60

/** GET → the client-facing deck PDF for a shared interactive presentation.
 *  Link-gated like the share page itself: knowing the video id (the share
 *  URL) is the credential. Only completed interactive rows serve. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: video } = await admin
    .from('videos')
    .select('id, title, status, output_type, draft_data')
    .eq('id', id)
    .single()
  if (!video || video.status !== 'completed' || video.output_type !== 'interactive') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const draft = (video.draft_data ?? {}) as Record<string, unknown>
  const scenes = (draft.scenes ?? []) as PresentationScene[]
  if (!scenes.length) return NextResponse.json({ error: 'Not available' }, { status: 404 })

  const title = (video.title as string) || 'Presentation'
  const safeName = title.replace(/[^a-zA-Z0-9-_ ]/g, '').slice(0, 60) || 'Presentation'
  const bytes = await buildDeckPdf(title, scenes,
    (draft.presentationTemplate as string) || 'heritage')
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
      'Cache-Control': 'private, max-age=300',
    },
  })
}
