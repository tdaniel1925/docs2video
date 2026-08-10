import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'

// =============================================================================
// Turn finished slides into something you can actually present.
//
// A folder of PNGs is not a deck. What people need is one file they can open in
// PowerPoint or Keynote, or a PDF to email — so this assembles the images that
// were already generated and paid for into both.
//
// FREE. The slides were charged for when they were drawn; charging again to put
// them in a container would be charging twice for one piece of work.
//
// The images are placed FULL BLEED, one per slide, with no text layer over the
// top. The lettering is already part of the artwork — that is the whole point
// of this tool — so adding an editable text box would double every word.
// =============================================================================

export const runtime = 'nodejs'
export const maxDuration = 120

/** 16:9 at the size PowerPoint calls widescreen. */
const SLIDE_W = 13.333
const SLIDE_H = 7.5

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await req.json().catch(() => null) as {
    designIds?: string[]
    title?: string
    format?: 'pptx' | 'pdf'
  } | null

  const ids = (body?.designIds ?? []).filter((s) => /^[0-9a-f-]{36}$/i.test(String(s)))
  if (!ids.length) return NextResponse.json({ error: 'No slides to export' }, { status: 400 })
  if (ids.length > 60) return NextResponse.json({ error: 'Up to 60 slides at a time' }, { status: 400 })

  const format = body?.format === 'pdf' ? 'pdf' : 'pptx'
  const title = String(body?.title ?? 'Deck').slice(0, 120)

  const admin = createAdminClient()

  // OWNERSHIP, NOT JUST EXISTENCE. The ids come from the browser, and without
  // this check anyone could assemble a deck out of somebody else's designs by
  // guessing. Filtering by user_id makes a guessed id return nothing rather
  // than someone else's work.
  const { data: rows, error } = await admin
    .from('flyer_designs')
    .select('id, image_path, width, height, created_at, flyer_rounds!inner(user_id)')
    .in('id', ids)
    .eq('flyer_rounds.user_id', user.id)

  if (error) {
    console.error('[deck-export] lookup failed:', error.message)
    return NextResponse.json({ error: 'Could not read those slides.' }, { status: 500 })
  }
  if (!rows?.length) return NextResponse.json({ error: 'Those slides are not yours, or no longer exist.' }, { status: 404 })

  // KEEP THE ORDER THE CUSTOMER GAVE. The database returns rows in whatever
  // order it likes, and a deck whose slides are shuffled is worthless — the
  // closing slide landing third is not a small cosmetic problem.
  const byId = new Map(rows.map((r) => [r.id, r]))
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as typeof rows

  // Fetch every image once, in parallel.
  const images = await Promise.all(ordered.map(async (r) => {
    const { data, error: dlErr } = await admin.storage.from('creation-assets').download(r.image_path)
    if (dlErr || !data) return null
    return Buffer.from(await data.arrayBuffer())
  }))

  const usable = images.filter(Boolean) as Buffer[]
  if (!usable.length) return NextResponse.json({ error: 'The slide images could not be read.' }, { status: 500 })
  // Say so rather than quietly shipping a short deck — a missing slide is the
  // sort of thing you discover in front of the room.
  const dropped = images.length - usable.length

  try {
    const file = format === 'pdf'
      ? await buildPdf(usable)
      : await buildPptx(usable, title)

    const path = `${user.id}/decks/${Date.now()}-${title.replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}.${format}`
    const { error: upErr } = await admin.storage.from('creation-assets').upload(path, file, {
      contentType: format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      upsert: true,
    })
    if (upErr) throw new Error(upErr.message)

    const { data: signed } = await admin.storage
      .from('creation-assets').createSignedUrl(path, 60 * 60)

    return NextResponse.json({ url: signed?.signedUrl, slides: usable.length, dropped })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[deck-export] build failed:', msg)
    return NextResponse.json({ error: 'Could not build the file. Try again in a moment.' }, { status: 500 })
  }
}

/** One image per slide, edge to edge, no text layer over the top. */
async function buildPptx(images: Buffer[], title: string): Promise<Buffer> {
  const PptxGenJS = (await import('pptxgenjs')).default
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.title = title

  for (const img of images) {
    const slide = pptx.addSlide()
    slide.addImage({
      data: `data:image/png;base64,${img.toString('base64')}`,
      x: 0, y: 0, w: SLIDE_W, h: SLIDE_H,
    })
  }
  return await pptx.write({ outputType: 'nodebuffer' }) as Buffer
}

/** Each page is exactly the size of its image, so nothing is letterboxed. */
async function buildPdf(images: Buffer[]): Promise<Buffer> {
  const { PDFDocument } = await import('pdf-lib')
  const sharp = (await import('sharp')).default
  const pdf = await PDFDocument.create()

  for (const img of images) {
    // pdf-lib embeds PNG and JPEG only, and a very large PNG makes an enormous
    // file — a twelve-slide deck of 13 MB pages is not emailable, which is the
    // main reason anyone wants the PDF.
    const jpeg = await sharp(img).jpeg({ quality: 90 }).toBuffer()
    const embedded = await pdf.embedJpg(jpeg)
    const page = pdf.addPage([embedded.width, embedded.height])
    page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height })
  }
  return Buffer.from(await pdf.save())
}
