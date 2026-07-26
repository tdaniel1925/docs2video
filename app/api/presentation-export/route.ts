import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { type PresentationScene } from '../../_lib/presentation'

export const runtime = 'nodejs'
export const maxDuration = 60

/** POST { videoId, kind: 'pptx' | 'pdf' } → native TEXT export of an
 *  interactive presentation / slide deck: real editable PowerPoint, or a
 *  crisp vector PDF — both drawn from the scenes + template tokens (no
 *  screenshots, no Chromium). */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const videoId: string | undefined = body.videoId
  const kind: 'pptx' | 'pdf' = body.kind === 'pdf' ? 'pdf' : 'pptx'
  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 })

  const { data: video } = await supabase
    .from('videos')
    .select('id, title, output_type, draft_data')
    .eq('id', videoId)
    .eq('user_id', user.id)
    .single()
  if (!video) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (video.output_type !== 'interactive' && video.output_type !== 'deck') {
    return NextResponse.json({ error: 'Not a presentation.' }, { status: 400 })
  }

  const draft = (video.draft_data ?? {}) as Record<string, unknown>
  const scenes = (draft.scenes ?? []) as PresentationScene[]
  if (!scenes.length) return NextResponse.json({ error: 'No scenes.' }, { status: 400 })
  const tokId = ((draft.presentationTemplate as string) || 'heritage')
  // The brand accent the HTML deck resolved to — so the export matches the
  // deck instead of falling back to the template's own color.
  const accent = draft.resolvedAccent as string | undefined
  const title = (video.title as string) || 'Presentation'
  const safeName = title.replace(/[^a-zA-Z0-9-_ ]/g, '').slice(0, 60) || 'Presentation'

  try {
    if (kind === 'pptx') {
      const { buildDeckPptx } = await import('../../_lib/presentation-exports')
      const buf = await buildDeckPptx(title, scenes, tokId, accent)
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'Content-Disposition': `attachment; filename="${safeName}.pptx"`,
        },
      })
    }
    const { buildDeckPdf } = await import('../../_lib/presentation-exports')
    const bytes = await buildDeckPdf(title, scenes, tokId, accent)
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
      },
    })
  } catch (err) {
    console.error('[presentation-export]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Export failed' }, { status: 500 })
  }
}
