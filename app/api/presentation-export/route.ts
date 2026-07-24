import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { templateTokens, type PresentationScene } from '../../_lib/presentation'

export const runtime = 'nodejs'
export const maxDuration = 60

const hexNoHash = (h: string) => (h.startsWith('#') ? h.slice(1) : h)
const hexToRgb = (h: string): [number, number, number] => {
  const s = hexNoHash(h)
  return [parseInt(s.slice(0, 2), 16) / 255, parseInt(s.slice(2, 4), 16) / 255, parseInt(s.slice(4, 6), 16) / 255]
}
const wrap = (text: string, max: number): string[] => {
  const words = text.split(/\s+/); const lines: string[] = []; let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) { if (cur) lines.push(cur); cur = w } else cur = (cur + ' ' + w).trim()
  }
  if (cur) lines.push(cur)
  return lines
}

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
    .select('id, title, output_type, video_style, draft_data')
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
  const tok = templateTokens((video.video_style as string) || (draft.presentationTemplate as string) || 'heritage')
  const title = (video.title as string) || 'Presentation'
  const safeName = title.replace(/[^a-zA-Z0-9-_ ]/g, '').slice(0, 60) || 'Presentation'

  try {
    if (kind === 'pptx') {
      const PptxGenJS = (await import('pptxgenjs')).default
      const pptx = new PptxGenJS()
      pptx.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 })
      pptx.layout = 'WIDE'
      pptx.title = title
      scenes.forEach((s, i) => {
        const slide = pptx.addSlide()
        slide.background = { color: hexNoHash(tok.paper) }
        // accent rule
        slide.addShape('rect', { x: 0.9, y: 1.05, w: 0.55, h: 0.045, fill: { color: hexNoHash(tok.accent) } })
        slide.addText(s.title || (i === 0 ? title : `Section ${i}`), {
          x: 0.9, y: 1.2, w: 11.5, h: 1.3, fontSize: i === 0 ? 40 : 30, bold: true,
          color: hexNoHash(tok.ink), fontFace: 'Georgia',
        })
        slide.addText(s.narration || '', {
          x: 0.9, y: 2.7, w: 10.5, h: 3.8, fontSize: 16, color: hexNoHash(tok.soft),
          lineSpacingMultiple: 1.3, valign: 'top',
        })
        slide.addText(`${i + 1} / ${scenes.length}`, {
          x: 12.0, y: 6.95, w: 1.0, h: 0.35, fontSize: 10, color: hexNoHash(tok.soft), align: 'right',
        })
        slide.addNotes(s.narration || '')
      })
      const buf = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'Content-Disposition': `attachment; filename="${safeName}.pptx"`,
        },
      })
    }

    // ── PDF: one 16:9 page per scene, drawn with pdf-lib (vector text) ──
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
    const doc = await PDFDocument.create()
    const serif = await doc.embedFont(StandardFonts.TimesRomanBold)
    const sans = await doc.embedFont(StandardFonts.Helvetica)
    const W = 960, H = 540
    const [pr, pg, pb] = hexToRgb(tok.paper)
    const [ir, ig, ib] = hexToRgb(tok.ink)
    const [ar, ag, ab] = hexToRgb(tok.accent)
    const [sr, sg, sb] = hexToRgb(tok.soft)
    scenes.forEach((s, i) => {
      const page = doc.addPage([W, H])
      page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(pr, pg, pb) })
      page.drawRectangle({ x: 64, y: H - 96, width: 44, height: 3.5, color: rgb(ar, ag, ab) })
      const heading = s.title || (i === 0 ? title : `Section ${i}`)
      const hSize = i === 0 ? 34 : 27
      wrap(heading, 46).slice(0, 2).forEach((line, li) => {
        page.drawText(line, { x: 64, y: H - 140 - li * (hSize + 6), size: hSize, font: serif, color: rgb(ir, ig, ib) })
      })
      wrap(s.narration || '', 92).slice(0, 11).forEach((line, li) => {
        page.drawText(line, { x: 64, y: H - 225 - li * 20, size: 13, font: sans, color: rgb(sr, sg, sb) })
      })
      page.drawText(`${i + 1} / ${scenes.length}`, { x: W - 84, y: 26, size: 9, font: sans, color: rgb(sr, sg, sb) })
      page.drawText(title, { x: 64, y: 26, size: 9, font: sans, color: rgb(sr, sg, sb) })
    })
    const bytes = await doc.save()
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
